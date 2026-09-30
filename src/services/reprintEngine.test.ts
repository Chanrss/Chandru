import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReprintEngine } from './reprintEngine';
import { Bill, BillItem } from '../types';

vi.mock('./firebase', () => ({
  db: {}
}));

const mockBills: Record<string, Bill> = {
  bill_001: {
    id: 'bill_001',
    billNumber: '01',
    businessDate: '2026-08-28',
    orderType: 'DINE_IN',
    priceType: 'NON_AC',
    subtotal: 120,
    discount: 0,
    grandTotal: 120,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    createdAt: 1724800000000,
    reprintCount: 0
  }
};

const mockBillItems: Record<string, BillItem[]> = {
  bill_001: [
    {
      id: 'bi_1',
      billId: 'bill_001',
      itemId: 'm1',
      itemName: 'Masala Dosa',
      itemCode: '101',
      quantity: 1,
      unitPrice: 70,
      totalPrice: 70,
      priceType: 'NON_AC',
      businessDate: '2026-08-28',
      createdAt: 1724800000000
    },
    {
      id: 'bi_2',
      billId: 'bill_001',
      itemId: 'm2',
      itemName: 'Filter Coffee',
      itemCode: '102',
      quantity: 1,
      unitPrice: 50,
      totalPrice: 50,
      priceType: 'NON_AC',
      businessDate: '2026-08-28',
      createdAt: 1724800000000
    }
  ]
};

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, col, id) => ({ id, path: `${col}/${id}` })),
  getDoc: vi.fn(async (docRef) => {
    const id = docRef.id;
    if (mockBills[id]) {
      return {
        exists: () => true,
        data: () => mockBills[id]
      };
    }
    return { exists: () => false, data: () => null };
  }),
  getDocs: vi.fn(async (q) => {
    // Return items for getBillItems or query for findBill
    return {
      empty: false,
      docs: [
        {
          id: 'bill_001',
          data: () => mockBills['bill_001']
        }
      ]
    };
  }),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  updateDoc: vi.fn(async (_docRef, updates) => {
    if (mockBills['bill_001']) {
      Object.assign(mockBills['bill_001'], updates);
    }
  })
}));

describe('ReprintEngine (Duplicate Audit & Receipt Retrieval)', () => {
  beforeEach(() => {
    mockBills['bill_001'].reprintCount = 0;
    vi.clearAllMocks();
  });

  it('retrieves bill by direct bill ID including its items', async () => {
    // Spy on getBillItems to supply mock items
    vi.spyOn(ReprintEngine, 'getBillItems').mockResolvedValue(mockBillItems['bill_001']);

    const bill = await ReprintEngine.findBill('bill_001');
    expect(bill).not.toBeNull();
    expect(bill?.billNumber).toBe('01');
    expect(bill?.items).toBeDefined();
    expect(bill?.items?.length).toBe(2);
  });

  it('standardizes search input number padding (e.g. "1" -> queries "01")', async () => {
    vi.spyOn(ReprintEngine, 'getBillItems').mockResolvedValue(mockBillItems['bill_001']);
    const bill = await ReprintEngine.findBill('1');
    expect(bill).not.toBeNull();
    expect(bill?.billNumber).toBe('01');
  });

  it('records reprint event and increments duplicate count', async () => {
    expect(mockBills['bill_001'].reprintCount).toBe(0);
    const newCount = await ReprintEngine.recordReprint('bill_001', 'Cashier User');
    expect(newCount).toBe(1);
    expect(mockBills['bill_001'].reprintCount).toBe(1);

    const secondCount = await ReprintEngine.recordReprint('bill_001', 'Manager');
    expect(secondCount).toBe(2);
  });

  it('returns null for blank or empty query', async () => {
    const bill = await ReprintEngine.findBill('   ');
    expect(bill).toBeNull();
  });
});
