import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from './firebase';
import { Bill, BillItem } from '../types';
import { getLocalBillByIdOrNumber, getLocalBillItems, updateLocalBill, getLocalBills } from './localBillStore';

export class ReprintEngine {
  /**
   * Looks up a bill by bill number (and optional businessDate) or bill ID
   */
  static async findBill(searchParam: string, businessDate?: string): Promise<Bill | null> {
    const trimmed = searchParam.trim();
    if (!trimmed) return null;

    // Check if input is a direct bill ID in Firestore
    if (trimmed.startsWith('bill_')) {
      try {
        const docRef = doc(db, 'bills', trimmed);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const billData = snap.data() as Bill;
          const items = await ReprintEngine.getBillItems(billData.id);
          return { ...billData, items };
        }
      } catch (e) {
        console.warn('Firestore bill lookup notice:', e);
      }
    }

    // Standardize bill number (e.g., "1" -> "01")
    let searchBillNum = trimmed;
    const numVal = parseInt(trimmed, 10);
    if (!isNaN(numVal) && numVal < 10 && !trimmed.startsWith('0')) {
      searchBillNum = `0${numVal}`;
    }

    // Try Firestore query
    try {
      let billsQuery;
      if (businessDate) {
        billsQuery = query(
          collection(db, 'bills'),
          where('businessDate', '==', businessDate),
          where('billNumber', '==', searchBillNum),
          limit(1)
        );
      } else {
        billsQuery = query(
          collection(db, 'bills'),
          where('billNumber', '==', searchBillNum),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
      }

      const querySnapshot = await getDocs(billsQuery);
      if (!querySnapshot.empty) {
        const billData = querySnapshot.docs[0].data() as Bill;
        const items = await ReprintEngine.getBillItems(billData.id);
        return { ...billData, items };
      }
    } catch (e) {
      console.warn('Firestore bill search query notice, checking local store:', e);
    }

    // Check local storage store
    const localMatch = getLocalBillByIdOrNumber(trimmed, businessDate);
    if (localMatch) {
      return { ...localMatch.bill, items: localMatch.items };
    }

    return null;
  }

  /**
   * Fetches all snapshot items for a given bill ID
   */
  static async getBillItems(billId: string): Promise<BillItem[]> {
    try {
      const itemsQuery = query(
        collection(db, 'bill_items'),
        where('billId', '==', billId)
      );
      const snap = await getDocs(itemsQuery);
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as BillItem);
      }
    } catch (e) {
      console.warn('Firestore bill items query notice, using local items:', e);
    }

    // Fallback to local store
    return getLocalBillItems(billId);
  }

  /**
   * Records a reprint event without changing the bill number or altering bill items
   */
  static async recordReprint(billId: string, reprintedBy: string): Promise<number> {
    let newCount = 1;
    // Update local storage record first
    const localBills = getLocalBills();
    const existing = localBills.find((b) => b.id === billId);
    if (existing) {
      newCount = (existing.reprintCount || 0) + 1;
      updateLocalBill(billId, {
        reprintCount: newCount,
        lastReprintedAt: Date.now(),
        lastReprintedBy: reprintedBy
      });
    }

    // Skip remote Firestore calls for sample / test bills generated for instant test printing
    if (!billId || billId.startsWith('sample_') || billId.startsWith('test_')) {
      return newCount;
    }

    // Then update Firestore in background
    try {
      const billRef = doc(db, 'bills', billId);
      const billSnap = await getDoc(billRef);
      if (billSnap.exists()) {
        const currentCount = billSnap.data()?.reprintCount || 0;
        newCount = currentCount + 1;
        await updateDoc(billRef, {
          reprintCount: newCount,
          lastReprintedAt: Date.now(),
          lastReprintedBy: reprintedBy
        });
      }
    } catch (e: any) {
      console.debug('Firestore reprint sync notice (saved locally):', e?.message || e);
    }
    return newCount;
  }
}
