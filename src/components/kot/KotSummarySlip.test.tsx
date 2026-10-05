import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KotSummarySlipModal } from './KotSummarySlipModal';
import { KotManagement } from './KotManagement';
import { PrinterService } from '../../services/printerService';
import { saveKotLocally } from '../../services/localKotStore';
import { Kot, KotItem, RestaurantSettings } from '../../types';

// Mock AuthContext with a Manager user
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'user_manager_1',
      name: 'Shift Supervisor Ramesh',
      displayName: 'Shift Supervisor Ramesh',
      roleId: 'manager',
      active: true
    },
    isOwner: false,
    isManager: true,
    isWaiter: false
  })
}));

// Mock Firebase
vi.mock('../../services/firebase', () => ({
  db: {},
  auth: {},
  sanitizeForFirestore: vi.fn((data) => data)
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(() => Promise.resolve())
  }))
}));

const mockSettings: RestaurantSettings = {
  restaurantName: 'SRI SARAVANA BHAVAN',
  address: 'Anna Salai, Chennai',
  phone: '044-28520000',
  email: 'info@saravanabhavan.com',
  receiptHeader: 'SRI SARAVANA BHAVAN',
  receiptFooter: 'Thank you',
  paperWidth: '80mm',
  receiptFontSize: 12,
  autoPrintOnSave: false
};

const mockKot1: Kot = {
  id: 'kot_1',
  kotNumber: 'KOT-101',
  tableNumber: 'T-1',
  orderType: 'DINE_IN',
  status: 'COMPLETED',
  businessDate: '2026-09-30',
  createdBy: 'waiter_1',
  createdAt: Date.now() - 30 * 60 * 1000,
  updatedAt: Date.now() - 10 * 60 * 1000,
  waiterId: 'waiter_1',
  waiterName: 'Suresh'
};

const mockKotItems1: KotItem[] = [
  {
    id: 'ki_1',
    kotId: 'kot_1',
    itemId: 'item_101',
    itemCode: '101',
    itemName: 'Idly (2 Pcs)',
    quantity: 3,
    priceType: 'NON_AC',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'ki_2',
    kotId: 'kot_1',
    itemId: 'item_103',
    itemCode: '103',
    itemName: 'Plain Dosa',
    quantity: 2,
    priceType: 'NON_AC',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

const mockKot2: Kot = {
  id: 'kot_2',
  kotNumber: 'KOT-102',
  tableNumber: 'T-4',
  orderType: 'DINE_IN',
  status: 'COMPLETED',
  businessDate: '2026-09-30',
  createdBy: 'waiter_2',
  createdAt: Date.now() - 20 * 60 * 1000,
  updatedAt: Date.now() - 5 * 60 * 1000,
  waiterId: 'waiter_2',
  waiterName: 'Ravi'
};

const mockKotItems2: KotItem[] = [
  {
    id: 'ki_3',
    kotId: 'kot_2',
    itemId: 'item_101',
    itemCode: '101',
    itemName: 'Idly (2 Pcs)',
    quantity: 2, // 3 + 2 = 5 Idly total
    priceType: 'NON_AC',
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'ki_4',
    kotId: 'kot_2',
    itemId: 'item_301',
    itemCode: '301',
    itemName: 'Filter Coffee',
    quantity: 4,
    priceType: 'NON_AC',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

describe('Manager Multi-KOT Summary Slip Feature', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('generates consolidated summary slip HTML with aggregated quantities and table details', () => {
    const kotsWithItems = [
      { kot: mockKot1, items: mockKotItems1 },
      { kot: mockKot2, items: mockKotItems2 }
    ];

    const html = PrinterService.generateKotSummarySlipHTML(kotsWithItems, mockSettings, 'Manager Ramesh');

    expect(html).toContain('COMPLETED KOTS SUMMARY SLIP');
    expect(html).toContain('SRI SARAVANA BHAVAN');
    expect(html).toContain('Manager Ramesh');
    expect(html).toContain('Completed KOTs:</b> 2 tickets');
    expect(html).toContain('T-1, T-4');

    // Consolidated quantities check: Idly total should be 5
    expect(html).toContain('Idly (2 Pcs)');
    expect(html).toContain('× 5');

    // Plain Dosa should be 2
    expect(html).toContain('Plain Dosa');
    expect(html).toContain('× 2');

    // Filter Coffee should be 4
    expect(html).toContain('Filter Coffee');
    expect(html).toContain('× 4');

    // Total portions = 5 + 2 + 4 = 11
    expect(html).toContain('TOTAL DISHES / PORTIONS:');
    expect(html).toContain('11');
  });

  it('renders the KotSummarySlipModal with metrics, consolidated dishes, and print button', () => {
    const kotsWithItems = [
      { kot: mockKot1, items: mockKotItems1 },
      { kot: mockKot2, items: mockKotItems2 }
    ];

    const printSpy = vi.spyOn(PrinterService, 'printKotSummarySlip').mockReturnValue({ success: true });
    const onClose = vi.fn();
    const onPrinted = vi.fn();

    render(
      <KotSummarySlipModal
        isOpen={true}
        onClose={onClose}
        selectedKots={kotsWithItems}
        settings={mockSettings}
        managerName="Manager Ramesh"
        onPrinted={onPrinted}
      />
    );

    // Verify Modal Header & Metadata
    expect(screen.getByText('Completed KOTs Summary Slip')).toBeDefined();
    expect(screen.getByText('Manager Print')).toBeDefined();
    expect(screen.getByText('2 KOTs')).toBeDefined();
    expect(screen.getByText('11 Portions')).toBeDefined();

    // Verify Consolidated list inside modal
    expect(screen.getAllByText(/Idly \(2 Pcs\)/i).length).toBeGreaterThan(0);
    expect(screen.getByText('×5')).toBeDefined();
    expect(screen.getByText('×2')).toBeDefined();
    expect(screen.getByText('×4')).toBeDefined();

    // Trigger Print
    const printBtn = screen.getByRole('button', { name: /Print Summary Slip/i });
    fireEvent.click(printBtn);

    expect(printSpy).toHaveBeenCalledWith(kotsWithItems, mockSettings, 'Manager Ramesh');
  });

  it('executes PrinterService.printKotSummarySlip cleanly without errors', () => {
    const kotsWithItems = [
      { kot: mockKot1, items: mockKotItems1 },
      { kot: mockKot2, items: mockKotItems2 }
    ];

    // Mock printHtmlDocument
    const printDocSpy = vi.spyOn(PrinterService, 'printHtmlDocument').mockReturnValue({ success: true });

    const result = PrinterService.printKotSummarySlip(kotsWithItems, mockSettings, 'Manager Ramesh');

    expect(result.success).toBe(true);
    expect(printDocSpy).toHaveBeenCalled();
  });

  it('allows manager to select multiple completed KOTs in KotManagement and triggers summary slip preview', async () => {
    saveKotLocally(mockKot1, mockKotItems1);
    saveKotLocally(mockKot2, mockKotItems2);

    render(<KotManagement settings={mockSettings} initialSubTab="running" />);

    // Switch to Completed filter tab
    const completedTabBtn = screen.getByText('Completed').closest('button')!;
    fireEvent.click(completedTabBtn);

    // Look for both completed KOT numbers
    expect(screen.getByText('KOT-101')).toBeDefined();
    expect(screen.getByText('KOT-102')).toBeDefined();

    // Checkboxes should have titles for selecting completed KOT
    const selectCheckboxes = screen.getAllByTitle(/Select completed KOT for manager summary slip/i);
    expect(selectCheckboxes.length).toBe(2);

    // Click both checkboxes
    fireEvent.click(selectCheckboxes[0]);
    fireEvent.click(selectCheckboxes[1]);

    // The bulk action bar should now show the Manager Summary Print button
    const summaryBtn = screen.getByRole('button', { name: /Print Summary Slip \(2 Completed\)/i });
    expect(summaryBtn).toBeDefined();

    // Clicking the summary button opens the KotSummarySlipModal
    fireEvent.click(summaryBtn);

    expect(screen.getByText('Completed KOTs Summary Slip')).toBeDefined();
    expect(screen.getByText('11 Portions')).toBeDefined();
  });
});
