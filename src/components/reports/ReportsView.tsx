import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  Calendar, 
  TrendingUp, 
  Layers, 
  FileSpreadsheet, 
  Ban, 
  Boxes, 
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ReportEngine, ItemWiseReportRow, CategoryWiseReportRow } from '../../services/reportEngine';
import { Bill, RestaurantSettings, Category } from '../../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MonthlyCalendarPicker } from '../common/MonthlyCalendarPicker';
import { getLocalBills, mergeBills } from '../../services/localBillStore';

interface ReportsViewProps {
  settings?: RestaurantSettings;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ settings }) => {
  const { isOwner, hasPermission } = useAuth();
  const hasFinancialPermission = isOwner || hasPermission('reports.financial');

  const [reportType, setReportType] = useState<'item-wise' | 'category-wise' | 'daily' | 'cancelled' | 'inventory'>('item-wise');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [loading, setLoading] = useState(false);
  const [itemData, setItemData] = useState<ItemWiseReportRow[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryWiseReportRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cancelledBills, setCancelledBills] = useState<Bill[]>([]);
  const [inventorySummary, setInventorySummary] = useState<any[]>([]);

  useEffect(() => {
    // Load categories for categorization
    getDocs(collection(db, 'categories')).then((snap) => {
      const list: Category[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Category));
      setCategories(list);
    }).catch((e) => console.warn('Categories report load notice:', e));
  }, []);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Process Item-Wise Report
      const itemRows = await ReportEngine.generateItemWiseReport(startDate, endDate, hasFinancialPermission);
      setItemData(itemRows);

      // Process Category-Wise Report
      const catRows = await ReportEngine.generateCategoryWiseReport(startDate, endDate, categories, hasFinancialPermission);
      setCategoryData(catRows);

      // Fetch Cancelled Bills
      const allBills = await ReportEngine.fetchBillsInRange(startDate, endDate);
      setCancelledBills(allBills.filter((b) => b.status === 'CANCELLED'));

      // Fetch Inventory Snapshot
      try {
        const invSnap = await getDocs(collection(db, 'inventory_items'));
        const invList: any[] = [];
        invSnap.forEach((d) => invList.push({ id: d.id, ...d.data() }));
        setInventorySummary(invList);
      } catch (e) {
        console.warn('Inventory fetch report notice:', e);
      }
    } catch (err) {
      console.error('Error generating report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [startDate, endDate]);

  const handleExportXLSX = () => {
    if (reportType === 'item-wise') {
      ReportEngine.exportToExcel(
        itemData.map((i) => ({
          'Item Code': i.itemCode,
          'Dish Name': i.itemName,
          'Quantity Sold': i.quantitySold,
          'Total Revenue (₹)': i.salesValue,
          'Orders': i.orderCount
        })),
        `Item_Sales_Report_${startDate}_to_${endDate}`
      );
    } else if (reportType === 'category-wise') {
      ReportEngine.exportToExcel(
        categoryData.map((c) => ({
          'Category': c.categoryName,
          'Quantity Sold': c.totalQuantity,
          'Total Revenue (₹)': c.totalSalesValue,
          'Orders': c.orderCount
        })),
        `Category_Sales_Report_${startDate}_to_${endDate}`
      );
    } else if (reportType === 'cancelled') {
      ReportEngine.exportToExcel(
        cancelledBills.map((b) => ({
          'Bill Number': b.billNumber,
          'Date': b.businessDate,
          'Total (₹)': b.grandTotal,
          'Reason': b.cancelReason || 'Cancelled',
          'Cancelled By': b.cancelledBy || 'Staff'
        })),
        `Cancelled_Bills_${startDate}_to_${endDate}`
      );
    } else if (reportType === 'inventory') {
      ReportEngine.exportToExcel(
        inventorySummary.map((inv) => ({
          'Item Code': inv.itemCode,
          'Item Name': inv.itemName,
          'Current Stock': inv.currentStock,
          'Unit': inv.unit,
          'Low Stock Threshold': inv.minimumStock || 5
        })),
        `Inventory_Snapshot_${new Date().toISOString().split('T')[0]}`
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalRevenue = itemData.reduce((s, i) => s + (i.salesValue || 0), 0);
  const totalQuantity = itemData.reduce((s, i) => s + i.quantitySold, 0);

  return (
    <div className="flex flex-col min-h-full bg-slate-100/90 text-slate-800 p-2 sm:p-4 gap-3 sm:gap-4 overflow-y-auto pb-24 md:pb-6 font-sans">
      
      {/* 1. Report Header & Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-2xs shrink-0">
            <BarChart3 className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base tracking-tight text-slate-900 uppercase leading-none">
                Sales & Operational Reports
              </h2>
              <span className="hidden sm:inline-block text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Live Data
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Item-wise revenue, category breakdown, cancellation logs, and inventory balances
            </p>
          </div>
        </div>

        {/* Date Range & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <MonthlyCalendarPicker
            startDate={startDate}
            endDate={endDate}
            onChange={({ startDate: s, endDate: e }) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />

          <button
            type="button"
            onClick={loadReportData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportXLSX}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export Excel (.xlsx)</span>
            <span className="sm:hidden">Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* 2. Report Types Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white border border-slate-200 p-1.5 rounded-xl shadow-2xs text-xs scrollbar-thin shrink-0">
        <button
          type="button"
          onClick={() => setReportType('item-wise')}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
            reportType === 'item-wise' ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" /> Item-Wise Sales
        </button>

        <button
          type="button"
          onClick={() => setReportType('category-wise')}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
            reportType === 'category-wise' ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Category-Wise Sales
        </button>

        <button
          type="button"
          onClick={() => setReportType('cancelled')}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
            reportType === 'cancelled' ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Ban className="w-3.5 h-3.5" /> Cancelled Bills
        </button>

        <button
          type="button"
          onClick={() => setReportType('inventory')}
          className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
            reportType === 'inventory' ? 'bg-amber-500 text-slate-950 font-black shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" /> Inventory Balances
        </button>
      </div>

      {/* 3. Summary KPI Cards */}
      {(reportType === 'item-wise' || reportType === 'category-wise') && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
          {hasFinancialPermission && (
            <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
              <span className="text-[11px] text-slate-500 uppercase font-bold">Total Sales Revenue</span>
              <div className="text-xl sm:text-2xl font-mono font-black text-emerald-700 mt-1">
                ₹{totalRevenue.toLocaleString()}
              </div>
            </div>
          )}
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-slate-500 uppercase font-bold">Total Items Sold</span>
            <div className="text-xl sm:text-2xl font-mono font-black text-amber-800 mt-1">
              {totalQuantity} qty
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-500 uppercase font-bold">Unique Menu Products</span>
            <div className="text-xl sm:text-2xl font-mono font-black text-blue-700 mt-1">
              {itemData.length} items
            </div>
          </div>
        </div>
      )}

      {/* 4. Report Tables Container */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          
          {/* 1. Item-Wise Sales Table */}
          {reportType === 'item-wise' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-3">Dish Name</th>
                  <th className="py-2.5 px-3 text-center">Qty Sold</th>
                  <th className="py-2.5 px-3 text-center">Order Count</th>
                  {hasFinancialPermission && <th className="py-2.5 px-3 text-right">Revenue (₹)</th>}
                  {hasFinancialPermission && <th className="py-2.5 px-3 text-right">% Share</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No sales recorded in this date range.
                    </td>
                  </tr>
                ) : (
                  itemData.map((item, idx) => {
                    const pct = totalRevenue > 0 && item.salesValue ? ((item.salesValue / totalRevenue) * 100).toFixed(1) : '0';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-800">#{item.itemCode}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{item.itemName}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">{item.quantitySold}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500">{item.orderCount}</td>
                        {hasFinancialPermission && (
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700">
                            ₹{item.salesValue || 0}
                          </td>
                        )}
                        {hasFinancialPermission && (
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">{pct}%</td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* 2. Category-Wise Sales Table */}
          {reportType === 'category-wise' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3 text-center">Total Quantity Sold</th>
                  <th className="py-2.5 px-3 text-center">Order Count</th>
                  {hasFinancialPermission && <th className="py-2.5 px-3 text-right">Total Revenue (₹)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No sales data in this date range.
                    </td>
                  </tr>
                ) : (
                  categoryData.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-extrabold text-slate-900">{cat.categoryName}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-800">{cat.totalQuantity}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{cat.orderCount}</td>
                      {hasFinancialPermission && (
                        <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 text-sm">
                          ₹{cat.totalSalesValue || 0}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 3. Cancelled Bills Table */}
          {reportType === 'cancelled' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Bill Number</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3">Cancellation Reason</th>
                  <th className="py-2.5 px-3 text-right">Cancelled By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cancelledBills.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No cancelled bills recorded.
                    </td>
                  </tr>
                ) : (
                  cancelledBills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-red-600">#{b.billNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">{b.businessDate}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-800">₹{b.grandTotal}</td>
                      <td className="py-2.5 px-3 text-red-700 font-medium">{b.cancelReason || 'No reason provided'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{b.cancelledBy || 'Staff'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* 4. Inventory Balances Table */}
          {reportType === 'inventory' && (
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Item Code</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventorySummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  inventorySummary.map((item) => {
                    const isLow = (item.currentStock || 0) <= (item.minimumStock || 5);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-800">#{item.itemCode || 'ITEM'}</td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">{item.itemName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unit || 'Units'}</td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black ${isLow ? 'text-red-600' : 'text-emerald-700'}`}>
                          {item.currentStock || 0}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isLow ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {isLow ? 'LOW STOCK' : 'OPTIMAL'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

        </div>
      </div>

    </div>
  );
};
