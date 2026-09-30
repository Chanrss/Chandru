import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  writeBatch,
  increment 
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from './firebase';
import { 
  InventoryItem, 
  InventoryMovement, 
  Purchase, 
  PurchaseItem, 
  StockAdjustment, 
  Wastage, 
  BillItem 
} from '../types';
import { syncCountInventoryOnSale } from './countInventoryService';

export class InventoryEngine {
  /**
   * Fetches all inventory items
   */
  static async getAllInventoryItems(): Promise<InventoryItem[]> {
    const snap = await getDocs(query(collection(db, 'inventory_items'), orderBy('itemCode', 'asc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem));
  }

  /**
   * Creates or updates an inventory item
   */
  static async saveInventoryItem(item: Partial<InventoryItem> & { itemCode: string; itemName: string; unit: string; minimumStock: number }): Promise<string> {
    const id = item.id || `inv_${item.itemCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const itemRef = doc(db, 'inventory_items', id);
    const existing = await getDoc(itemRef);

    const now = Date.now();
    if (existing.exists()) {
      await updateDoc(itemRef, {
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        minimumStock: item.minimumStock,
        active: item.active !== false,
        updatedAt: now
      });
    } else {
      const newItem: InventoryItem = {
        id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        minimumStock: item.minimumStock,
        currentStock: item.currentStock || 0,
        active: item.active !== false,
        createdAt: now,
        updatedAt: now
      };
      await setDoc(itemRef, sanitizeForFirestore(newItem));
      
      // If initial stock provided, log movement
      if ((item.currentStock || 0) > 0) {
        await InventoryEngine.recordMovement({
          itemId: id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          type: 'OPENING',
          quantity: item.currentStock || 0,
          createdBy: 'System',
          notes: 'Initial opening stock'
        });
      }
    }
    return id;
  }

  /**
   * Records a stock movement and updates the current stock in Firestore
   */
  static async recordMovement(params: {
    itemId: string;
    itemCode: string;
    itemName: string;
    type: 'OPENING' | 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'WASTAGE';
    quantity: number;
    referenceType?: string;
    referenceId?: string;
    createdBy: string;
    notes?: string;
  }): Promise<void> {
    const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const movementRef = doc(db, 'inventory_movements', movementId);

    const movement: InventoryMovement = {
      id: movementId,
      itemId: params.itemId,
      itemCode: params.itemCode,
      itemName: params.itemName,
      type: params.type,
      quantity: params.quantity,
      createdBy: params.createdBy,
      createdAt: Date.now()
    };

    if (params.referenceType) movement.referenceType = params.referenceType;
    if (params.referenceId) movement.referenceId = params.referenceId;
    if (params.notes) movement.notes = params.notes;

    await setDoc(movementRef, sanitizeForFirestore(movement));

    // Update currentStock in inventory_items
    const itemRef = doc(db, 'inventory_items', params.itemId);
    let delta = 0;
    if (params.type === 'OPENING' || params.type === 'PURCHASE') {
      delta = params.quantity;
    } else if (params.type === 'SALE' || params.type === 'WASTAGE') {
      delta = -params.quantity;
    } else if (params.type === 'ADJUSTMENT') {
      delta = params.quantity; // signed
    }

    try {
      await updateDoc(itemRef, {
        currentStock: increment(delta),
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Could not update inventory currentStock:', e);
    }
  }

  /**
   * Adds a purchase invoice with purchase items and automatically updates inventory stock
   */
  static async addPurchase(
    purchaseData: Omit<Purchase, 'id' | 'createdAt'>,
    items: Omit<PurchaseItem, 'id' | 'purchaseId' | 'createdAt'>[]
  ): Promise<string> {
    const purchaseId = `purch_${Date.now()}`;
    const purchaseRef = doc(db, 'purchases', purchaseId);

    const now = Date.now();
    const purchase: Purchase = {
      id: purchaseId,
      ...purchaseData,
      createdAt: now
    };

    const batch = writeBatch(db);
    batch.set(purchaseRef, sanitizeForFirestore(purchase));

    const purchaseItems: PurchaseItem[] = items.map((itm, idx) => ({
      id: `${purchaseId}_item_${idx + 1}`,
      purchaseId,
      ...itm,
      createdAt: now
    }));

    purchaseItems.forEach((pi) => {
      batch.set(doc(db, 'purchase_items', pi.id), sanitizeForFirestore(pi));
    });

    await batch.commit();

    // Log movement for each item
    for (const pi of purchaseItems) {
      await InventoryEngine.recordMovement({
        itemId: pi.itemId,
        itemCode: pi.itemCode,
        itemName: pi.itemName,
        type: 'PURCHASE',
        quantity: pi.quantity,
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        createdBy: purchaseData.createdBy,
        notes: `Invoice: ${purchaseData.invoiceNumber} from ${purchaseData.supplierName}`
      });
    }

    return purchaseId;
  }

  /**
   * Records a manual stock adjustment
   */
  static async addAdjustment(adjustment: {
    itemId: string;
    itemCode: string;
    itemName: string;
    adjustmentType: 'INCREASE' | 'DECREASE';
    quantity: number;
    reason: string;
    createdBy: string;
  }): Promise<void> {
    const adjId = `adj_${Date.now()}`;
    const adjRef = doc(db, 'stock_adjustments', adjId);
    
    await setDoc(adjRef, sanitizeForFirestore({
      id: adjId,
      ...adjustment,
      createdAt: Date.now()
    }));

    const signedQty = adjustment.adjustmentType === 'INCREASE' ? adjustment.quantity : -adjustment.quantity;
    await InventoryEngine.recordMovement({
      itemId: adjustment.itemId,
      itemCode: adjustment.itemCode,
      itemName: adjustment.itemName,
      type: 'ADJUSTMENT',
      quantity: signedQty,
      referenceType: 'ADJUSTMENT',
      referenceId: adjId,
      createdBy: adjustment.createdBy,
      notes: adjustment.reason
    });
  }

  /**
   * Records stock wastage
   */
  static async addWastage(wastage: {
    itemId: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    reason: string;
    createdBy: string;
  }): Promise<void> {
    const wId = `wastage_${Date.now()}`;
    const wRef = doc(db, 'wastage', wId);

    await setDoc(wRef, sanitizeForFirestore({
      id: wId,
      ...wastage,
      createdAt: Date.now()
    }));

    await InventoryEngine.recordMovement({
      itemId: wastage.itemId,
      itemCode: wastage.itemCode,
      itemName: wastage.itemName,
      type: 'WASTAGE',
      quantity: wastage.quantity,
      referenceType: 'WASTAGE',
      referenceId: wId,
      createdBy: wastage.createdBy,
      notes: wastage.reason
    });
  }
}

/**
 * Deducts inventory stock when a bill is completed
 */
export async function recordInventorySale(billItems: BillItem[], userId: string): Promise<void> {
  // Sync count-based items (Ice Cream, Cool Drinks, Water, etc.)
  try {
    await syncCountInventoryOnSale(billItems, userId, billItems[0]?.billId || '');
  } catch (err) {
    console.warn('Count inventory sale sync notice:', err);
  }

  for (const item of billItems) {
    try {
      // Find matching inventory item by item code or itemId
      const q = query(
        collection(db, 'inventory_items'), 
        where('itemCode', '==', item.itemCode)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const invDoc = snap.docs[0];
        const invData = invDoc.data() as InventoryItem;
        await InventoryEngine.recordMovement({
          itemId: invDoc.id,
          itemCode: invData.itemCode,
          itemName: invData.itemName,
          type: 'SALE',
          quantity: item.quantity,
          referenceType: 'BILL',
          referenceId: item.billId,
          createdBy: userId,
          notes: `Sold in Bill: ${item.billId}`
        });
      }
    } catch (err) {
      console.warn(`Could not log inventory sale for ${item.itemCode}:`, err);
    }
  }
}
