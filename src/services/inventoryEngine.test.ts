import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryEngine } from './inventoryEngine';
import { InventoryItem } from '../types';

vi.mock('./firebase', () => ({
  db: {},
  sanitizeForFirestore: (data: any) => data
}));

const mockInventoryStore: Record<string, InventoryItem> = {
  inv_rice: {
    id: 'inv_rice',
    itemCode: 'RAW-01',
    itemName: 'Ponni Boiled Rice',
    unit: 'KG',
    minimumStock: 25,
    currentStock: 50,
    active: true,
    createdAt: 1724000000000,
    updatedAt: 1724000000000
  },
  inv_urad: {
    id: 'inv_urad',
    itemCode: 'RAW-02',
    itemName: 'Urad Dal',
    unit: 'KG',
    minimumStock: 15,
    currentStock: 10, // Below minimum threshold
    active: true,
    createdAt: 1724000000000,
    updatedAt: 1724000000000
  }
};

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: vi.fn(async (docRef) => {
    const item = mockInventoryStore[docRef.id];
    return {
      exists: () => !!item,
      data: () => item
    };
  }),
  getDocs: vi.fn(async () => ({
    docs: Object.values(mockInventoryStore).map((item) => ({
      id: item.id,
      data: () => item
    }))
  })),
  setDoc: vi.fn(async (docRef, data) => {
    mockInventoryStore[docRef.id] = data;
  }),
  updateDoc: vi.fn(async (docRef, updates) => {
    if (mockInventoryStore[docRef.id]) {
      Object.assign(mockInventoryStore[docRef.id], updates);
    }
  }),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    commit: vi.fn(async () => {})
  })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn((n) => n)
}));

describe('InventoryEngine (Stock Management & Low Stock Control)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches inventory items accurately', async () => {
    const items = await InventoryEngine.getAllInventoryItems();
    expect(items.length).toBe(2);
    expect(items.find((i) => i.itemCode === 'RAW-01')?.itemName).toBe('Ponni Boiled Rice');
  });

  it('identifies low stock alerts accurately', async () => {
    const items = await InventoryEngine.getAllInventoryItems();
    const lowStockItems = items.filter((i) => i.currentStock <= i.minimumStock);
    
    expect(lowStockItems.length).toBe(1);
    expect(lowStockItems[0].itemCode).toBe('RAW-02');
    expect(lowStockItems[0].currentStock).toBe(10);
    expect(lowStockItems[0].minimumStock).toBe(15);
  });

  it('creates new raw material inventory item with formatted ID', async () => {
    const newId = await InventoryEngine.saveInventoryItem({
      itemCode: 'RAW-03',
      itemName: 'Sambar Chili Powder',
      unit: 'KG',
      minimumStock: 5,
      currentStock: 20
    });

    expect(newId).toBe('inv_raw_03');
  });

  it('records stock adjustment increase and decrease', async () => {
    const recordMovementSpy = vi.spyOn(InventoryEngine, 'recordMovement').mockResolvedValue();

    await InventoryEngine.addAdjustment({
      itemId: 'inv_rice',
      itemCode: 'RAW-01',
      itemName: 'Ponni Boiled Rice',
      adjustmentType: 'INCREASE',
      quantity: 10,
      reason: 'Direct physical stock check surplus',
      createdBy: 'Store Manager'
    });

    expect(recordMovementSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemId: 'inv_rice',
      type: 'ADJUSTMENT',
      quantity: 10
    }));
  });

  it('records wastage deduction with audited reason', async () => {
    const recordMovementSpy = vi.spyOn(InventoryEngine, 'recordMovement').mockResolvedValue();

    await InventoryEngine.addWastage({
      itemId: 'inv_urad',
      itemCode: 'RAW-02',
      itemName: 'Urad Dal',
      quantity: 2,
      reason: 'Moisture damage during monsoon',
      createdBy: 'Head Chef'
    });

    expect(recordMovementSpy).toHaveBeenCalledWith(expect.objectContaining({
      itemId: 'inv_urad',
      type: 'WASTAGE',
      quantity: 2
    }));
  });
});
