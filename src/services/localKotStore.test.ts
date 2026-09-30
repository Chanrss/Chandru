import { describe, it, expect, beforeEach } from 'vitest';
import { 
  saveKotLocally, 
  getLocalKots, 
  updateLocalKotStatus, 
  appendItemsToLocalKot, 
  mergeKots 
} from './localKotStore';
import { Kot, KotItem } from '../types';

describe('localKotStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockKot: Kot = {
    id: 'kot_123',
    kotNumber: 'KOT-01',
    businessDate: '2026-09-07',
    orderType: 'DINE_IN',
    tableNumber: 'T-1',
    waiterId: 'waiter_1',
    waiterName: 'Waiter 1',
    status: 'OPEN',
    createdBy: 'Staff',
    createdAt: 1000,
    updatedAt: 1000,
    itemsCount: 2
  };

  const mockItems: KotItem[] = [
    {
      id: 'item_1',
      kotId: 'kot_123',
      itemId: 'm_1',
      itemCode: '101',
      itemName: 'Masala Dosa',
      quantity: 2,
      priceType: 'NON_AC',
      unitPrice: 60,
      createdAt: 1000,
      updatedAt: 1000
    }
  ];

  it('saves and retrieves KOTs locally', () => {
    saveKotLocally(mockKot, mockItems);
    const kots = getLocalKots();
    expect(kots.length).toBe(1);
    expect(kots[0].kot.id).toBe('kot_123');
    expect(kots[0].items.length).toBe(1);
    expect(kots[0].items[0].itemName).toBe('Masala Dosa');
  });

  it('updates local KOT status correctly', () => {
    saveKotLocally(mockKot, mockItems);
    updateLocalKotStatus('kot_123', 'COMPLETED');
    const kots = getLocalKots();
    expect(kots[0].kot.status).toBe('COMPLETED');
  });

  it('appends items to existing local KOT correctly', () => {
    saveKotLocally(mockKot, mockItems);
    const newItem: KotItem = {
      id: 'item_2',
      kotId: 'kot_123',
      itemId: 'm_2',
      itemCode: '102',
      itemName: 'Filter Coffee',
      quantity: 1,
      priceType: 'NON_AC',
      unitPrice: 30,
      createdAt: 1050,
      updatedAt: 1050
    };

    appendItemsToLocalKot('kot_123', [newItem]);
    const kots = getLocalKots();
    expect(kots[0].items.length).toBe(2);
    expect(kots[0].kot.itemsCount).toBe(3);
  });

  it('merges remote and local KOTs preserving local KOTs', () => {
    saveKotLocally(mockKot, mockItems);

    const remoteKots = [
      {
        kot: {
          ...mockKot,
          id: 'kot_remote_999',
          kotNumber: 'KOT-02',
          createdAt: 2000
        },
        items: []
      }
    ];

    const localKots = getLocalKots();
    const merged = mergeKots(remoteKots, localKots);

    expect(merged.length).toBe(2);
    // Newest first
    expect(merged[0].kot.id).toBe('kot_remote_999');
    expect(merged[1].kot.id).toBe('kot_123');
  });
});
