import { describe, it, expect } from 'vitest';
import { BillingEngine } from './billingEngine';
import { CartItem, MenuItem } from '../types';

describe('BillingEngine calculations', () => {
  const item1: MenuItem = {
    id: 'm1',
    itemCode: '101',
    categoryId: 'cat-1',
    itemName: 'Dosa',
    nonAcPrice: 50,
    acPrice: 65,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const item2: MenuItem = {
    id: 'm2',
    itemCode: '102',
    categoryId: 'cat-1',
    itemName: 'Coffee',
    nonAcPrice: 20,
    acPrice: 30,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('selects correct price for Non-AC and AC environments', () => {
    expect(BillingEngine.getApplicablePrice(item1, 'NON_AC')).toBe(50);
    expect(BillingEngine.getApplicablePrice(item1, 'AC')).toBe(65);
    expect(BillingEngine.getApplicablePrice(item2, 'NON_AC')).toBe(20);
    expect(BillingEngine.getApplicablePrice(item2, 'AC')).toBe(30);
  });

  it('calculates subtotal and line totals accurately', () => {
    const cart: CartItem[] = [
      {
        itemId: 'm1',
        itemCode: '101',
        itemName: 'Dosa',
        quantity: 2,
        priceType: 'NON_AC',
        unitPrice: 50,
        totalPrice: 100
      },
      {
        itemId: 'm2',
        itemCode: '102',
        itemName: 'Coffee',
        quantity: 3,
        priceType: 'NON_AC',
        unitPrice: 20,
        totalPrice: 60
      }
    ];

    expect(BillingEngine.calculateSubtotal(cart)).toBe(160);
  });

  it('calculates grand total with discount applied', () => {
    const subtotal = 200;
    const discount = 20;
    expect(BillingEngine.calculateGrandTotal(subtotal, discount)).toBe(180);
  });

  it('handles zero discount and prevents negative totals', () => {
    expect(BillingEngine.calculateGrandTotal(100, 0)).toBe(100);
    expect(BillingEngine.calculateGrandTotal(50, 100)).toBe(0);
  });
});
