import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Bill, BillItem, Category, InventoryItem, Purchase } from '../types';
import * as XLSX from 'xlsx';
import { getLocalBills, getLocalBillItems, mergeBills } from './localBillStore';

export interface ReportFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  category?: string;
  orderType?: string;
  priceType?: string;
}

export interface ItemWiseReportRow {
  itemCode: string;
  itemName: string;
  categoryName?: string;
  quantitySold: number;
  orderCount: number;
  unitPrice?: number; // Only for permitted financial view
  salesValue?: number; // Only for permitted financial view
}

export interface CategoryWiseReportRow {
  categoryName: string;
  totalQuantity: number;
  orderCount: number;
  totalSalesValue?: number; // Only for permitted financial view
}

export interface DailySummaryRow {
  date: string;
  billCount: number;
  totalQuantity: number;
  totalSales?: number; // Only for permitted financial view
  cancelledCount: number;
}

export class ReportEngine {
  /**
   * Fetches bills within date range
   */
  static async fetchBillsInRange(startDate: string, endDate: string): Promise<Bill[]> {
    let remoteBills: Bill[] = [];
    try {
      const q = query(
        collection(db, 'bills'),
        where('businessDate', '>=', startDate),
        where('businessDate', '<=', endDate),
        orderBy('businessDate', 'asc'),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      remoteBills = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Bill));
    } catch (e) {
      console.warn('Firestore fetchBillsInRange notice (using local bills):', e);
    }

    const localBills = getLocalBills().filter(
      (b) => b.businessDate >= startDate && b.businessDate <= endDate
    );

    return mergeBills(remoteBills, localBills);
  }

  /**
   * Fetches all bill items for completed bills within date range
   */
  static async fetchBillItemsInRange(billIds: string[]): Promise<BillItem[]> {
    if (!billIds || billIds.length === 0) return [];
    
    const allItems: BillItem[] = [];
    const foundBillIds = new Set<string>();

    try {
      // Firestore where in is limited to 30 per batch, so fetch in chunks
      const chunks: string[][] = [];
      for (let i = 0; i < billIds.length; i += 30) {
        chunks.push(billIds.slice(i, i + 30));
      }

      for (const chunk of chunks) {
        const q = query(
          collection(db, 'bill_items'),
          where('billId', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.docs.forEach((doc) => {
          const item = { id: doc.id, ...doc.data() } as BillItem;
          allItems.push(item);
          foundBillIds.add(item.billId);
        });
      }
    } catch (e) {
      console.warn('Firestore fetchBillItemsInRange notice (using local bill items):', e);
    }

    // For any billId not retrieved from remote Firestore, get from local store
    for (const id of billIds) {
      if (!foundBillIds.has(id)) {
        const localItems = getLocalBillItems(id);
        if (localItems && localItems.length > 0) {
          allItems.push(...localItems);
        }
      }
    }

    return allItems;
  }

  /**
   * Generates Item-wise sales report
   */
  static async generateItemWiseReport(
    startDate: string, 
    endDate: string, 
    hasFinancialPermission: boolean
  ): Promise<ItemWiseReportRow[]> {
    const bills = await ReportEngine.fetchBillsInRange(startDate, endDate);
    const completedBills = bills.filter((b) => b.status === 'COMPLETED');
    const billIds = completedBills.map((b) => b.id);
    
    const items = await ReportEngine.fetchBillItemsInRange(billIds);

    const itemMap = new Map<string, ItemWiseReportRow>();

    items.forEach((item) => {
      const key = item.itemCode || item.itemName;
      const existing = itemMap.get(key) || {
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantitySold: 0,
        orderCount: 0,
        unitPrice: hasFinancialPermission ? item.unitPrice : undefined,
        salesValue: hasFinancialPermission ? 0 : undefined
      };

      existing.quantitySold += item.quantity;
      existing.orderCount += 1;
      if (hasFinancialPermission) {
        existing.salesValue = (existing.salesValue || 0) + (item.totalPrice || (item.unitPrice * item.quantity));
      }

      itemMap.set(key, existing);
    });

    return Array.from(itemMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
  }

  /**
   * Generates Category-wise sales report
   */
  static async generateCategoryWiseReport(
    startDate: string, 
    endDate: string,
    categories: Category[],
    hasFinancialPermission: boolean
  ): Promise<CategoryWiseReportRow[]> {
    const itemReport = await ReportEngine.generateItemWiseReport(startDate, endDate, hasFinancialPermission);
    const catMap = new Map<string, CategoryWiseReportRow>();

    // Map item codes to category
    itemReport.forEach((item) => {
      const catName = 'General / All';
      const existing = catMap.get(catName) || {
        categoryName: catName,
        totalQuantity: 0,
        orderCount: 0,
        totalSalesValue: hasFinancialPermission ? 0 : undefined
      };

      existing.totalQuantity += item.quantitySold;
      existing.orderCount += item.orderCount;
      if (hasFinancialPermission && item.salesValue) {
        existing.totalSalesValue = (existing.totalSalesValue || 0) + item.salesValue;
      }
      catMap.set(catName, existing);
    });

    return Array.from(catMap.values());
  }

  /**
   * Generates Daily / Periodic summary report
   */
  static async generateDailySummaryReport(
    startDate: string,
    endDate: string,
    hasFinancialPermission: boolean
  ): Promise<DailySummaryRow[]> {
    const bills = await ReportEngine.fetchBillsInRange(startDate, endDate);
    const dayMap = new Map<string, DailySummaryRow>();

    bills.forEach((bill) => {
      const date = bill.businessDate;
      const existing = dayMap.get(date) || {
        date,
        billCount: 0,
        totalQuantity: 0,
        totalSales: hasFinancialPermission ? 0 : undefined,
        cancelledCount: 0
      };

      if (bill.status === 'COMPLETED') {
        existing.billCount += 1;
        if (hasFinancialPermission) {
          existing.totalSales = (existing.totalSales || 0) + bill.grandTotal;
        }
      } else if (bill.status === 'CANCELLED') {
        existing.cancelledCount += 1;
      }

      dayMap.set(date, existing);
    });

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generates real formatted Excel (.xlsx) file and triggers download in browser
   */
  static exportToExcel(data: Record<string, any>[], fileName: string, sheetName = 'Report'): void {
    if (!data || data.length === 0) {
      alert('No data to export.');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Auto-fit column widths
    const keys = Object.keys(data[0]);
    worksheet['!cols'] = keys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((row) => String(row[key] || '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }
}
