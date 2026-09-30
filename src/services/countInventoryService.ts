import { 
  InventoryItem, 
  CountPurchaseRecord, 
  CountMissingRecord, 
  BillItem, 
  Bill 
} from '../types';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from './firebase';
import { InventoryEngine } from './inventoryEngine';
import { getLocalBills, getLocalItemsMap } from './localBillStore';

export interface StockCountMetrics {
  initialStock: number;
  purchasedCount: number;
  totalStock: number;
  soldCount: number;
  missingCount: number;
  remainingCount: number;
  isTallyCorrect: boolean;
  status: 'OPTIMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'UNINITIALIZED';
}

/**
 * Calculates count-based inventory metrics strictly adhering to formulas:
 * TOTAL STOCK = INITIAL STOCK COUNT + PURCHASED COUNT
 * REMAINING COUNT = TOTAL STOCK - SOLD COUNT - MISSING COUNT
 * TALLY: INITIAL STOCK + PURCHASED === SOLD + MISSING + REMAINING (TOTAL STOCK === TOTAL STOCK)
 */
export function calculateStockMetrics(item: Partial<InventoryItem>): StockCountMetrics {
  if (!item.isInitialized && (item.initialStock === undefined || item.initialStock === null)) {
    return {
      initialStock: 0,
      purchasedCount: 0,
      totalStock: 0,
      soldCount: 0,
      missingCount: 0,
      remainingCount: 0,
      isTallyCorrect: true,
      status: 'UNINITIALIZED'
    };
  }

  const initialStock = Number(item.initialStock) || 0;
  const purchasedCount = Number(item.purchasedCount) || 0;
  const soldCount = Number(item.soldCount) || 0;
  const missingCount = Number(item.missingCount) || 0;

  // Formula 1: TOTAL STOCK = INITIAL STOCK + PURCHASED COUNT
  const totalStock = initialStock + purchasedCount;

  // Formula 2: REMAINING COUNT = TOTAL STOCK - SOLD COUNT - MISSING COUNT
  const remainingCount = totalStock - soldCount - missingCount;

  // Formula 3: Tally Check: Initial + Purchased = Sold + Missing + Remaining
  const leftSide = initialStock + purchasedCount;
  const rightSide = soldCount + missingCount + remainingCount;
  const isTallyCorrect = Math.abs(leftSide - rightSide) < 0.001;

  const minStock = Number(item.minimumStock) || 0;

  let status: 'OPTIMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'OPTIMAL';
  if (remainingCount <= 0) {
    status = 'OUT_OF_STOCK';
  } else if (remainingCount <= minStock) {
    status = 'LOW_STOCK';
  }

  return {
    initialStock,
    purchasedCount,
    totalStock,
    soldCount,
    missingCount,
    remainingCount,
    isTallyCorrect,
    status
  };
}

/**
 * Updates an inventory item in local storage cache
 */
function updateItemInLocalCache(updatedItem: InventoryItem): void {
  try {
    const raw = localStorage.getItem('pos_local_inventory');
    const list: InventoryItem[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((i) => i.id === updatedItem.id);
    if (index >= 0) {
      list[index] = updatedItem;
    } else {
      list.push(updatedItem);
    }
    localStorage.setItem('pos_local_inventory', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('pos_inventory_updated', { detail: { item: updatedItem } }));
  } catch (e) {
    console.warn('Could not update local inventory cache:', e);
  }
}

/**
 * Step 3: Setup Initial Stock Count
 * Entered ONLY once when starting tracking this item.
 * Must NEVER reset daily or automatically change on billing.
 */
export async function initializeItemStock(params: {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemNameTamil?: string;
  category: string;
  categoryId?: string;
  unit: string;
  initialStock: number;
  minimumStock: number;
  userName?: string;
}): Promise<InventoryItem> {
  const now = Date.now();
  const initialQty = Math.max(0, Number(params.initialStock) || 0);
  const minStock = Math.max(0, Number(params.minimumStock) || 0);

  const itemData: InventoryItem = {
    id: params.itemId,
    itemCode: params.itemCode.trim().toUpperCase(),
    itemName: params.itemName.trim(),
    itemNameTamil: params.itemNameTamil || '',
    category: params.category.trim(),
    categoryId: params.categoryId || '',
    unit: params.unit.trim() || 'Pcs',
    minimumStock: minStock,
    currentStock: initialQty,
    active: true,

    // Count-based tracking initialization
    isCountBased: true,
    isInitialized: true,
    initialStock: initialQty,
    purchasedCount: 0,
    soldCount: 0,
    missingCount: 0,
    remainingCount: initialQty,

    purchases: [],
    missingLogs: [],

    createdAt: now,
    updatedAt: now
  };

  // 1. Save to local storage immediately
  updateItemInLocalCache(itemData);

  // 2. Persist to Firestore
  try {
    const docRef = doc(db, 'inventory_items', params.itemId);
    await setDoc(docRef, sanitizeForFirestore(itemData));
  } catch (err) {
    console.warn('Firestore item init notice (saved locally):', err);
  }

  // 3. Record Opening Movement
  try {
    await InventoryEngine.recordMovement({
      itemId: params.itemId,
      itemCode: itemData.itemCode,
      itemName: itemData.itemName,
      type: 'OPENING',
      quantity: initialQty,
      referenceType: 'MANUAL',
      referenceId: `INIT_${Date.now()}`,
      createdBy: params.userName || 'Staff',
      notes: `Initial physical stock count: ${initialQty} ${itemData.unit}`
    });
  } catch (err) {
    console.warn('Initial movement record notice:', err);
  }

  return itemData;
}

/**
 * Step 5: Purchase Entry
 * Records a new purchase and increments purchasedCount.
 * Does NOT overwrite previous purchases.
 */
export async function addCountPurchase(params: {
  item: InventoryItem;
  quantity: number;
  date: string;
  unitPrice?: number;
  supplier?: string;
  invoiceNumber?: string;
  notes?: string;
  userName?: string;
}): Promise<InventoryItem> {
  const qty = Number(params.quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Please enter a valid positive purchase quantity.');
  }

  const purchaseRecord: CountPurchaseRecord = {
    id: `pur_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    date: params.date || new Date().toISOString().split('T')[0],
    quantity: qty,
    unitPrice: params.unitPrice || 0,
    totalCost: qty * (params.unitPrice || 0),
    supplier: params.supplier || '',
    invoiceNumber: params.invoiceNumber || '',
    notes: params.notes || '',
    createdBy: params.userName || 'Staff',
    createdAt: Date.now()
  };

  const existingPurchases = Array.isArray(params.item.purchases) ? [...params.item.purchases] : [];
  existingPurchases.unshift(purchaseRecord); // Newest first

  const newPurchasedCount = (Number(params.item.purchasedCount) || 0) + qty;
  const initial = Number(params.item.initialStock) || 0;
  const sold = Number(params.item.soldCount) || 0;
  const missing = Number(params.item.missingCount) || 0;

  const totalStock = initial + newPurchasedCount;
  const remainingCount = totalStock - sold - missing;

  const updatedItem: InventoryItem = {
    ...params.item,
    purchasedCount: newPurchasedCount,
    remainingCount,
    currentStock: remainingCount,
    purchases: existingPurchases,
    updatedAt: Date.now()
  };

  // 1. Local Cache
  updateItemInLocalCache(updatedItem);

  // 2. Firestore
  try {
    const docRef = doc(db, 'inventory_items', params.item.id);
    await updateDoc(docRef, {
      purchasedCount: newPurchasedCount,
      remainingCount,
      currentStock: remainingCount,
      purchases: existingPurchases,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('Firestore purchase update notice:', err);
  }

  // 3. Log movement
  try {
    await InventoryEngine.recordMovement({
      itemId: params.item.id,
      itemCode: params.item.itemCode,
      itemName: params.item.itemName,
      type: 'PURCHASE',
      quantity: qty,
      referenceType: 'PURCHASE',
      referenceId: purchaseRecord.id,
      createdBy: params.userName || 'Staff',
      notes: `Purchase on ${purchaseRecord.date}: +${qty} ${params.item.unit} ${params.invoiceNumber ? `(Inv: ${params.invoiceNumber})` : ''}`
    });
  } catch (err) {
    console.warn('Purchase movement record notice:', err);
  }

  return updatedItem;
}

/**
 * Step 8: Missing Count Entry
 * Records physical missing quantity (breakage, melting, loss, discrepancy)
 */
export async function addCountMissing(params: {
  item: InventoryItem;
  quantity: number;
  date: string;
  reason?: string;
  physicalCountFound?: number;
  userName?: string;
}): Promise<InventoryItem> {
  const qty = Number(params.quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Please enter a valid missing quantity.');
  }

  const initial = Number(params.item.initialStock) || 0;
  const purchased = Number(params.item.purchasedCount) || 0;
  const sold = Number(params.item.soldCount) || 0;
  const currentMissing = Number(params.item.missingCount) || 0;
  const totalStock = initial + purchased;
  const expectedRemaining = totalStock - sold - currentMissing;

  const missingRecord: CountMissingRecord = {
    id: `miss_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    date: params.date || new Date().toISOString().split('T')[0],
    quantity: qty,
    reason: params.reason || 'Physical count discrepancy',
    physicalCountFound: params.physicalCountFound,
    expectedCount: expectedRemaining,
    createdBy: params.userName || 'Staff',
    createdAt: Date.now()
  };

  const existingMissingLogs = Array.isArray(params.item.missingLogs) ? [...params.item.missingLogs] : [];
  existingMissingLogs.unshift(missingRecord); // Newest first

  const newMissingCount = currentMissing + qty;
  const remainingCount = totalStock - sold - newMissingCount;

  const updatedItem: InventoryItem = {
    ...params.item,
    missingCount: newMissingCount,
    remainingCount,
    currentStock: remainingCount,
    missingLogs: existingMissingLogs,
    updatedAt: Date.now()
  };

  // 1. Local Cache
  updateItemInLocalCache(updatedItem);

  // 2. Firestore
  try {
    const docRef = doc(db, 'inventory_items', params.item.id);
    await updateDoc(docRef, {
      missingCount: newMissingCount,
      remainingCount,
      currentStock: remainingCount,
      missingLogs: existingMissingLogs,
      updatedAt: Date.now()
    });
  } catch (err) {
    console.warn('Firestore missing count update notice:', err);
  }

  // 3. Log movement
  try {
    await InventoryEngine.recordMovement({
      itemId: params.item.id,
      itemCode: params.item.itemCode,
      itemName: params.item.itemName,
      type: 'WASTAGE',
      quantity: qty,
      referenceType: 'WASTAGE',
      referenceId: missingRecord.id,
      createdBy: params.userName || 'Staff',
      notes: `Missing logged on ${missingRecord.date}: -${qty} ${params.item.unit} (${params.reason || 'Discrepancy'})`
    });
  } catch (err) {
    console.warn('Missing movement record notice:', err);
  }

  return updatedItem;
}

/**
 * Step 7: Automatic Sold Count update when a bill is completed
 * Called when bills are finalized from Direct Billing, POS Billing, or KOT Billing.
 * Increments soldCount and recalculates remainingCount.
 */
export async function syncCountInventoryOnSale(billItems: BillItem[], userId: string, billId: string): Promise<void> {
  let localInv: InventoryItem[] = [];
  try {
    const raw = localStorage.getItem('pos_local_inventory');
    if (raw) localInv = JSON.parse(raw);
  } catch (e) {}

  for (const bi of billItems) {
    const qty = Number(bi.quantity) || 0;
    if (qty <= 0) continue;

    // Find in local inventory
    const targetItem = localInv.find(
      (inv) => inv.id === bi.itemId || 
               (inv.itemCode && bi.itemCode && inv.itemCode.trim().toUpperCase() === bi.itemCode.trim().toUpperCase()) ||
               (inv.itemName && bi.itemName && inv.itemName.trim().toLowerCase() === bi.itemName.trim().toLowerCase())
    );

    if (targetItem && targetItem.isInitialized) {
      const newSoldCount = (Number(targetItem.soldCount) || 0) + qty;
      const initial = Number(targetItem.initialStock) || 0;
      const purchased = Number(targetItem.purchasedCount) || 0;
      const missing = Number(targetItem.missingCount) || 0;
      const totalStock = initial + purchased;
      const remainingCount = totalStock - newSoldCount - missing;

      targetItem.soldCount = newSoldCount;
      targetItem.remainingCount = remainingCount;
      targetItem.currentStock = remainingCount;
      targetItem.updatedAt = Date.now();

      updateItemInLocalCache(targetItem);

      try {
        const itemRef = doc(db, 'inventory_items', targetItem.id);
        await updateDoc(itemRef, {
          soldCount: newSoldCount,
          remainingCount,
          currentStock: remainingCount,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn(`Could not update soldCount in Firestore for ${targetItem.itemCode}:`, err);
      }
    }
  }
}

/**
 * Calculates itemized sales audit from finalized bills for a given item
 */
export function getItemSalesHistory(itemCode: string, itemId: string): {
  totalSold: number;
  salesList: Array<{
    billId: string;
    billNumber: string;
    date: string;
    time: string;
    orderType: string;
    quantity: number;
    unitPrice: number;
  }>;
} {
  const bills = getLocalBills();
  const itemsMap = getLocalItemsMap();
  const salesList: Array<{
    billId: string;
    billNumber: string;
    date: string;
    time: string;
    orderType: string;
    quantity: number;
    unitPrice: number;
  }> = [];

  let totalSold = 0;
  const normalizedCode = itemCode ? itemCode.trim().toUpperCase() : '';

  for (const bill of bills) {
    if (bill.status === 'CANCELLED') continue;

    const bItems = itemsMap[bill.id] || (bill as any).items || [];
    for (const bi of bItems) {
      const match = (bi.itemId && bi.itemId === itemId) ||
                    (bi.itemCode && normalizedCode && bi.itemCode.trim().toUpperCase() === normalizedCode);
      if (match) {
        const q = Number(bi.quantity) || 0;
        totalSold += q;
        salesList.push({
          billId: bill.id,
          billNumber: bill.billNumber || `#${bill.id.slice(-4)}`,
          date: bill.businessDate || new Date(bill.createdAt).toISOString().split('T')[0],
          time: new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          orderType: bill.orderType || 'POS',
          quantity: q,
          unitPrice: bi.unitPrice || 0
        });
      }
    }
  }

  return { totalSold, salesList };
}
