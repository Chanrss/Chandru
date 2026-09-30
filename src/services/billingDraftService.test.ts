import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getDraftDocId, 
  saveBillingDraft, 
  loadBillingDraft, 
  clearBillingDraft, 
  SaveDraftPayload 
} from './billingDraftService';

// Mock Firebase Firestore methods so tests run ultra-fast in memory
vi.mock('./firebase', () => ({
  db: {},
  getDeviceId: () => 'test_device_pos_1',
  sanitizeForFirestore: (data: any) => data
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: vi.fn(async () => ({
    exists: () => false,
    data: () => null
  })),
  setDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {})
}));

describe('BillingDraftService (Offline & In-Progress Bill Holding)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('generates consistent deterministic document IDs for drafts', () => {
    expect(getDraftDocId('direct_billing', 'user_123')).toBe('direct_billing_user_123');
    expect(getDraftDocId('pos', 'user_456')).toBe('pos_user_456');
    // For anonymous/demo users, falls back to device ID
    expect(getDraftDocId('direct_billing', 'demo_cashier')).toBe('direct_billing_test_device_pos_1');
  });

  it('saves active draft into localStorage and handles recovery', async () => {
    const payload: SaveDraftPayload = {
      screen: 'direct_billing',
      userId: 'cashier_1',
      userName: 'John Doe',
      orderType: 'DINE_IN',
      priceType: 'AC',
      tableNumber: 'T-05',
      items: [
        {
          itemId: 'm1',
          itemCode: '101',
          itemName: 'Special Masala Dosa',
          quantity: 2,
          priceType: 'AC',
          unitPrice: 80,
          totalPrice: 160
        }
      ],
      discount: 10,
      discountPercent: null,
      customDiscount: 10,
      subtotal: 160,
      grandTotal: 150
    };

    await saveBillingDraft(payload);

    // Verify localStorage fallback
    const draft = await loadBillingDraft('direct_billing', 'cashier_1');
    expect(draft).not.toBeNull();
    expect(draft?.tableNumber).toBe('T-05');
    expect(draft?.priceType).toBe('AC');
    expect(draft?.items.length).toBe(1);
    expect(draft?.items[0].itemName).toBe('Special Masala Dosa');
    expect(draft?.grandTotal).toBe(150);
  });

  it('clears draft when items array is empty', async () => {
    const payload: SaveDraftPayload = {
      screen: 'direct_billing',
      userId: 'cashier_1',
      orderType: 'DINE_IN',
      priceType: 'NON_AC',
      tableNumber: 'T-01',
      items: [],
      discount: 0,
      subtotal: 0,
      grandTotal: 0
    };

    await saveBillingDraft(payload);
    const draft = await loadBillingDraft('direct_billing', 'cashier_1');
    expect(draft).toBeNull();
  });

  it('manually clearing a draft removes it completely from storage', async () => {
    await saveBillingDraft({
      screen: 'pos',
      userId: 'user_99',
      orderType: 'TAKE_AWAY',
      priceType: 'NON_AC',
      tableNumber: '',
      items: [
        {
          itemId: 'm2',
          itemCode: '102',
          itemName: 'Filter Coffee',
          quantity: 1,
          priceType: 'NON_AC',
          unitPrice: 30,
          totalPrice: 30
        }
      ],
      discount: 0,
      subtotal: 30,
      grandTotal: 30
    });

    let draft = await loadBillingDraft('pos', 'user_99');
    expect(draft).not.toBeNull();

    await clearBillingDraft('pos', 'user_99');
    draft = await loadBillingDraft('pos', 'user_99');
    expect(draft).toBeNull();
  });
});
