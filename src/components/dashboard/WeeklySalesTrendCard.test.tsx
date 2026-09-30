import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklySalesTrendCard } from './WeeklySalesTrendCard';
import { Bill } from '../../types';

// Mock recharts ResponsiveContainer for JSDOM testing
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  };
});

const sampleBills: Bill[] = [
  {
    id: 'b1',
    billNumber: 'BILL-001',
    businessDate: '2026-09-07', // Today
    grandTotal: 1500,
    subtotal: 1400,
    discount: 0,
    reprintCount: 0,
    priceType: 'AC',
    status: 'COMPLETED',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    orderType: 'DINE_IN',
    tableNumber: 'T1',
    items: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: 'b2',
    billNumber: 'BILL-002',
    businessDate: '2026-09-06', // Yesterday
    grandTotal: 3200,
    subtotal: 3000,
    discount: 0,
    reprintCount: 0,
    priceType: 'AC',
    status: 'COMPLETED',
    paymentMethod: 'UPI',
    paymentStatus: 'PAID',
    orderType: 'DINE_IN',
    tableNumber: 'T2',
    items: [],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'b3',
    billNumber: 'BILL-003',
    businessDate: '2026-09-05', // Peak day
    grandTotal: 5000,
    subtotal: 4800,
    discount: 0,
    reprintCount: 0,
    priceType: 'AC',
    status: 'COMPLETED',
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    orderType: 'TAKE_AWAY',
    items: [],
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'b4',
    billNumber: 'BILL-004',
    businessDate: '2026-09-04',
    grandTotal: 1200,
    subtotal: 1100,
    discount: 0,
    reprintCount: 0,
    priceType: 'NON_AC',
    status: 'CANCELLED', // Cancelled bills should NOT be included in revenue
    paymentMethod: 'CASH',
    paymentStatus: 'CANCELLED',
    orderType: 'DINE_IN',
    items: [],
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3
  }
];

describe('WeeklySalesTrendCard Component', () => {
  it('renders the card with Weekly Sales Trend title, rolling 7 days range, and Firestore Live indicator', () => {
    render(
      <WeeklySalesTrendCard
        bills={sampleBills}
        businessDate="2026-09-07"
        canViewRevenue={true}
        isFirestoreLive={true}
      />
    );

    expect(screen.getByText('Weekly Sales Trend')).toBeDefined();
    expect(screen.getByText(/Last 7 Days:/)).toBeDefined();
    expect(screen.getByText('Firestore Live')).toBeDefined();
    expect(screen.getByText('7-Day Total:')).toBeDefined();
    // Total revenue from completed bills: 1500 + 3200 + 5000 = 9700
    expect(screen.getByText('₹9,700')).toBeDefined();
    // 3 completed bills
    expect(screen.getByText('3 bills')).toBeDefined();
  });

  it('identifies the peak day and displays daily average correctly', () => {
    render(
      <WeeklySalesTrendCard
        bills={sampleBills}
        businessDate="2026-09-07"
        canViewRevenue={true}
      />
    );

    // Peak day is 2026-09-05 (Saturday) with ₹5,000
    expect(screen.getByText(/Peak:/)).toBeDefined();
    expect(screen.getByText(/₹5,000/)).toBeDefined();

    // Daily average: 9700 / 7 = 1386
    expect(screen.getByText('₹1,386')).toBeDefined();
    expect(screen.getByText('Daily Average')).toBeDefined();
  });

  it('defaults to Line Chart mode and allows toggling between Line Chart, Area Curve, and Daily Bars', () => {
    render(
      <WeeklySalesTrendCard
        bills={sampleBills}
        businessDate="2026-09-07"
        canViewRevenue={true}
      />
    );

    // Default view mode should be Line Chart
    const lineToggleBtn = screen.getByRole('button', { name: /Line Chart/i });
    expect(lineToggleBtn).toBeDefined();
    expect(lineToggleBtn.className).toContain('bg-white');

    const barToggleBtn = screen.getByRole('button', { name: /Daily Bars/i });
    expect(barToggleBtn).toBeDefined();

    fireEvent.click(barToggleBtn);
    // Bar button should now be active
    expect(barToggleBtn.className).toContain('bg-white');

    const areaToggleBtn = screen.getByRole('button', { name: /Area Curve/i });
    fireEvent.click(areaToggleBtn);
    expect(areaToggleBtn.className).toContain('bg-white');

    // Switch back to Line Chart
    fireEvent.click(lineToggleBtn);
    expect(lineToggleBtn.className).toContain('bg-white');
  });

  it('respects RBAC permissions by hiding revenue and rendering restricted notice', () => {
    render(
      <WeeklySalesTrendCard
        bills={sampleBills}
        businessDate="2026-09-07"
        canViewRevenue={false}
      />
    );

    // Should display restricted banner
    expect(screen.getByText('Financial Visualizations Restricted')).toBeDefined();
    expect(screen.getByText(/Your role does not have access to view weekly revenue metrics/)).toBeDefined();

    // Should NOT show 7-day total revenue
    expect(screen.queryByText('₹9,700')).toBeNull();
    expect(screen.queryByText('7-Day Total:')).toBeNull();
  });

  it('handles empty bill list gracefully without errors or division by zero', () => {
    render(
      <WeeklySalesTrendCard
        bills={[]}
        businessDate="2026-09-07"
        canViewRevenue={true}
      />
    );

    expect(screen.getByText('Weekly Sales Trend')).toBeDefined();
    expect(screen.getAllByText('₹0').length).toBeGreaterThan(0);
    expect(screen.getByText('0 bills')).toBeDefined();
  });
});
