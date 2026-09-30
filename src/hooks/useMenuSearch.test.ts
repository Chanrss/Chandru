import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuSearch } from './useMenuSearch';
import { MenuItem } from '../types';

const mockMenuItems: MenuItem[] = [
  {
    id: 'item-1',
    itemCode: '101',
    categoryId: 'cat-1',
    itemName: 'Masala Dosa',
    categoryName: 'Breakfast',
    nonAcPrice: 70,
    acPrice: 85,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'item-2',
    itemCode: '102',
    categoryId: 'cat-1',
    itemName: 'Plain Dosa',
    categoryName: 'Breakfast',
    nonAcPrice: 50,
    acPrice: 65,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'item-3',
    itemCode: '201',
    categoryId: 'cat-2',
    itemName: 'Filter Coffee',
    categoryName: 'Beverages',
    nonAcPrice: 25,
    acPrice: 35,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'item-4',
    itemCode: '202',
    categoryId: 'cat-2',
    itemName: 'Masala Tea',
    categoryName: 'Beverages',
    nonAcPrice: 20,
    acPrice: 30,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

describe('useMenuSearch hook automation tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty matches when search input is blank', () => {
    const { result } = renderHook(() =>
      useMenuSearch(mockMenuItems, '', 'NON_AC', { debounceMs: 50 })
    );

    expect(result.current.matchingSuggestions).toHaveLength(0);
    expect(result.current.exactMatch).toBeNull();
    expect(result.current.topMatch).toBeNull();
    expect(result.current.totalMatches).toBe(0);
  });

  it('instantly finds exact match by item code with active Non-AC pricing', () => {
    const { result } = renderHook(() =>
      useMenuSearch(mockMenuItems, '101', 'NON_AC', { debounceMs: 50 })
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current.exactMatch).not.toBeNull();
    expect(result.current.exactMatch?.itemCode).toBe('101');
    expect(result.current.exactMatch?.itemName).toBe('Masala Dosa');
    expect(result.current.exactMatch?.applicablePrice).toBe(70);
  });

  it('computes correct AC pricing when AC price mode is active', () => {
    const { result } = renderHook(() =>
      useMenuSearch(mockMenuItems, '101', 'AC', { debounceMs: 50 })
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current.exactMatch?.applicablePrice).toBe(85);
  });

  it('finds items by prefix search (e.g. typing "10" matches 101 and 102)', () => {
    const { result } = renderHook(() =>
      useMenuSearch(mockMenuItems, '10', 'NON_AC', { debounceMs: 50 })
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current.matchingSuggestions.length).toBe(2);
    expect(result.current.matchingSuggestions.map(i => i.itemCode)).toEqual(['101', '102']);
  });

  it('finds items by name search (e.g. "tea")', () => {
    const { result } = renderHook(() =>
      useMenuSearch(mockMenuItems, 'tea', 'NON_AC', { debounceMs: 50 })
    );

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current.matchingSuggestions.length).toBe(1);
    expect(result.current.matchingSuggestions[0].itemName).toBe('Masala Tea');
  });

  it('debounces rapid keystroke updates properly', () => {
    let input = '1';
    const { result, rerender } = renderHook(
      ({ query }) => useMenuSearch(mockMenuItems, query, 'NON_AC', { debounceMs: 50 }),
      { initialProps: { query: input } }
    );

    expect(result.current.debouncedQuery).toBe('1');

    input = '10';
    rerender({ query: input });
    expect(result.current.isDebouncing).toBe(true);

    input = '101';
    rerender({ query: input });

    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(result.current.debouncedQuery).not.toBe('101');

    act(() => {
      vi.advanceTimersByTime(30);
    });

    expect(result.current.debouncedQuery).toBe('101');
    expect(result.current.exactMatch?.itemCode).toBe('101');
  });
});
