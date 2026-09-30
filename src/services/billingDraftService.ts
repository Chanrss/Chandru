import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, getDeviceId, sanitizeForFirestore } from './firebase';
import { BillingDraft, CartItem, OrderType, PriceType } from '../types';

export type DraftScreen = 'direct_billing' | 'pos';

export interface SaveDraftPayload {
  screen: DraftScreen;
  userId?: string;
  userName?: string;
  orderType: OrderType;
  priceType: PriceType;
  tableNumber: string;
  items: (CartItem & { notes?: string })[];
  discount: number;
  discountPercent?: number | null;
  customDiscount?: number;
  cashTendered?: string;
  subtotal: number;
  grandTotal: number;
}

/**
 * Derives a deterministic document ID for a bill-in-progress draft
 */
export function getDraftDocId(screen: DraftScreen, userId?: string): string {
  const identifier = userId && !userId.startsWith('demo_') ? userId : getDeviceId();
  return `${screen}_${identifier}`;
}

const LOCAL_STORAGE_PREFIX = 'billing_in_progress_draft_';

/**
 * Saves the in-progress draft bill to Firestore and local fallback
 */
export async function saveBillingDraft(payload: SaveDraftPayload): Promise<void> {
  const { screen, userId, items } = payload;
  const draftId = getDraftDocId(screen, userId);
  const deviceId = getDeviceId();

  // If cart is empty, delete any existing draft instead of saving an empty document
  if (!items || items.length === 0) {
    await clearBillingDraft(screen, userId);
    return;
  }

  const now = Date.now();
  const draftData: BillingDraft = {
    id: draftId,
    screen,
    userId: userId || undefined,
    userName: payload.userName || undefined,
    deviceId,
    orderType: payload.orderType,
    priceType: payload.priceType,
    tableNumber: payload.tableNumber || '',
    items: payload.items,
    discount: payload.discount || 0,
    discountPercent: payload.discountPercent ?? null,
    customDiscount: payload.customDiscount || 0,
    cashTendered: payload.cashTendered || '',
    updatedAt: now,
    itemCount: payload.items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    subtotal: payload.subtotal,
    grandTotal: payload.grandTotal
  };

  // 1. Immediately cache in localStorage for instant retrieval on page reload
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${screen}`, JSON.stringify(draftData));
  } catch (err) {
    console.warn('LocalStorage draft cache warning:', err);
  }

  // 2. Persist to Firestore billing_drafts collection
  try {
    const cleanData = sanitizeForFirestore(draftData);
    const docRef = doc(db, 'billing_drafts', draftId);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (firestoreErr) {
    console.warn('Firestore auto-save draft warning (relying on offline cache):', firestoreErr);
  }
}

/**
 * Retrieves the stored bill-in-progress draft from Firestore (with fallback to localStorage)
 */
export async function getBillingDraft(
  screen: DraftScreen, 
  userId?: string
): Promise<BillingDraft | null> {
  const draftId = getDraftDocId(screen, userId);

  // 1. Try Firestore first
  try {
    const docRef = doc(db, 'billing_drafts', draftId);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as BillingDraft;
      if (data && data.items && data.items.length > 0) {
        return data;
      }
    }

    // Try fallback device document ID if user ID differed
    const deviceDraftId = `${screen}_${getDeviceId()}`;
    if (deviceDraftId !== draftId) {
      const deviceDocRef = doc(db, 'billing_drafts', deviceDraftId);
      const devSnap = await getDoc(deviceDocRef);
      if (devSnap.exists()) {
        const devData = devSnap.data() as BillingDraft;
        if (devData && devData.items && devData.items.length > 0) {
          return devData;
        }
      }
    }
  } catch (firestoreErr) {
    console.warn('Could not read draft from Firestore, checking local storage:', firestoreErr);
  }

  // 2. Fallback to LocalStorage
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${screen}`);
    if (raw) {
      const parsed = JSON.parse(raw) as BillingDraft;
      if (parsed && parsed.items && parsed.items.length > 0) {
        return parsed;
      }
    }
  } catch (localErr) {
    console.warn('LocalStorage draft read warning:', localErr);
  }

  return null;
}

/**
 * Removes the bill-in-progress draft when a bill is completed or cleared
 */
export async function clearBillingDraft(
  screen: DraftScreen, 
  userId?: string
): Promise<void> {
  const draftId = getDraftDocId(screen, userId);
  const deviceDraftId = `${screen}_${getDeviceId()}`;

  // 1. Clear local storage
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${screen}`);
  } catch (err) {
    console.warn('LocalStorage clear draft warning:', err);
  }

  // 2. Delete from Firestore
  try {
    const docRef = doc(db, 'billing_drafts', draftId);
    await deleteDoc(docRef);

    if (deviceDraftId !== draftId) {
      const devDocRef = doc(db, 'billing_drafts', deviceDraftId);
      await deleteDoc(devDocRef);
    }
  } catch (firestoreErr) {
    console.warn('Firestore clear draft notice:', firestoreErr);
  }
}

/**
 * Backward-compatible alias for getBillingDraft
 */
export const loadBillingDraft = getBillingDraft;

