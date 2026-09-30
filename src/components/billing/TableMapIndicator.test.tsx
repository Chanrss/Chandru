import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableMapIndicator } from './TableMapIndicator';
import { saveKotLocally } from '../../services/localKotStore';
import { Kot, KotItem } from '../../types';

// Mock Firebase
vi.mock('../../services/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  onSnapshot: vi.fn((q, callback) => {
    return () => {};
  }),
  query: vi.fn(),
  where: vi.fn()
}));

describe('TableMapIndicator & Seating Manager in Direct Billing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders available and occupied table status pills accurately', () => {
    // Occupy table T-3 with a test KOT
    const testKot: Kot = {
      id: 'kot_occ_1',
      kotNumber: 'KOT-11',
      businessDate: '2026-09-08',
      tableNumber: 'T-3',
      orderType: 'DINE_IN',
      waiterId: 'w1',
      waiterName: 'Ganesh',
      status: 'OPEN',
      createdBy: 'w1',
      createdAt: Date.now() - 12 * 60 * 1000,
      updatedAt: Date.now()
    };

    const testItems: KotItem[] = [
      {
        id: 'ki_101',
        kotId: 'kot_occ_1',
        itemId: 'dish_1',
        itemCode: '101',
        itemName: 'Ghee Roast',
        itemNameTamil: 'நெய் ரோஸ்ட்',
        quantity: 2,
        unitPrice: 85,
        priceType: 'NON_AC',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    saveKotLocally(testKot, testItems);

    render(
      <TableMapIndicator
        selectedTable="T-1"
        orderType="DINE_IN"
        priceType="NON_AC"
        onSelectTable={vi.fn()}
      />
    );

    // Indicator header should display "Table Map"
    expect(screen.getByText('Table Map')).toBeDefined();

    // 1 Occupied table pill
    expect(screen.getByText('1 Occupied')).toBeDefined();

    // Quick table buttons should show T-1, T-2, T-3, etc.
    expect(screen.getByText('T-3')).toBeDefined();
    expect(screen.getByText('12m')).toBeDefined();
  });

  it('invokes onSelectTable when an available table button is clicked', () => {
    const handleSelectTable = vi.fn();

    render(
      <TableMapIndicator
        selectedTable=""
        orderType="DINE_IN"
        priceType="NON_AC"
        onSelectTable={handleSelectTable}
      />
    );

    const table2Btn = screen.getByText('T-2');
    fireEvent.click(table2Btn);

    expect(handleSelectTable).toHaveBeenCalledWith('T-2', 'NON_AC');
  });

  it('opens floor map modal when Table Map button is clicked', () => {
    render(
      <TableMapIndicator
        selectedTable="T-1"
        orderType="DINE_IN"
        priceType="NON_AC"
        onSelectTable={vi.fn()}
      />
    );

    const tableMapBtn = screen.getByText('Table Map');
    fireEvent.click(tableMapBtn);

    expect(screen.getByText('Restaurant Table Map & Seating Status')).toBeDefined();
    expect(screen.getByText(/Total Tables/)).toBeDefined();
  });
});
