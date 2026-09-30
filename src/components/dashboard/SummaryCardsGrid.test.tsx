import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryCardsGrid, DashboardMetrics } from './SummaryCardsGrid';

const sampleMetrics: DashboardMetrics = {
  businessDate: '2026-09-07',
  todayRevenue: 24500,
  todayCashSales: 14000,
  todayUpiSales: 10500,
  completedBillsCount: 42,
  cancelledBillsCount: 1,
  dineInBillsCount: 30,
  takeAwayBillsCount: 12,
  avgOrderValue: 583,
  activeKotsCount: 7,
  preparingKotsCount: 4,
  readyKotsCount: 2,
  sentKotsCount: 1,
  activeTableNumbers: ['T1', 'T4', 'T7'],
  totalMenuItems: 65,
  lowStockCount: 3
};

describe('SummaryCardsGrid Component - Role-Gated Access Control', () => {
  it('renders full financial and stock metrics for OWNER role', () => {
    const onNavigate = vi.fn();
    const onSwitchRole = vi.fn();

    render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={(perm) => true}
        onNavigate={onNavigate}
        onSwitchRole={onSwitchRole}
      />
    );

    // Today's Sales should be visible
    expect(screen.getByText("Today's Total Sales")).toBeDefined();
    expect(screen.getByText('₹24,500')).toBeDefined();
    expect(screen.getByText(/Cash: ₹14,000/)).toBeDefined();
    expect(screen.getByText(/UPI: ₹10,500/)).toBeDefined();

    // Active KOTs should be visible
    expect(screen.getByText('Active KOTs')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
    expect(screen.getByText(/4 Cooking/)).toBeDefined();
    expect(screen.getByText(/2 Ready/)).toBeDefined();

    // Inventory Alerts should be visible
    expect(screen.getByText('Stock Alerts')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('restricts financial metrics and raw stock for WAITER role', () => {
    const onNavigate = vi.fn();
    const onSwitchRole = vi.fn();

    // Waiter permissions: only kot.view, kot.create, billing.create
    const waiterPermissions = ['kot.view', 'kot.create', 'kot.edit', 'billing.create', 'billing.print'];
    const hasPermission = (perm: string) => waiterPermissions.includes(perm);

    render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="waiter"
        isOwner={false}
        isManager={false}
        isWaiter={true}
        hasPermission={hasPermission}
        onNavigate={onNavigate}
        onSwitchRole={onSwitchRole}
      />
    );

    // Today's Sales is restricted
    expect(screen.getByText('₹••••••')).toBeDefined();
    expect(screen.getByText('RESTRICTED')).toBeDefined();
    expect(screen.getByText(/Financial revenue metrics are restricted for/)).toBeDefined();

    // Active KOTs is accessible to Waiter
    expect(screen.getByText('Active KOTs')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();

    // Stock Alerts is restricted to staff
    expect(screen.getByText('STAFF RESTRICTED')).toBeDefined();
    expect(screen.getByText(/Raw material & stock levels reserved for/)).toBeDefined();

    // Role-tailored waiter service tier is rendered
    expect(screen.getByText(/Waiter Operational View • Active Dining Tables/)).toBeDefined();
    expect(screen.getByText(/Tables currently dining: T1, T4, T7/)).toBeDefined();
  });

  it('handles navigation clicks on summary cards', () => {
    const onNavigate = vi.fn();

    render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={onNavigate}
      />
    );

    // Click Active KOTs card
    const kotCardTitle = screen.getByText('Active KOTs');
    fireEvent.click(kotCardTitle.closest('.cursor-pointer')!);
    expect(onNavigate).toHaveBeenCalledWith('kot');

    // Click Stock Alerts card
    const stockCardTitle = screen.getByText('Stock Alerts');
    fireEvent.click(stockCardTitle.closest('.cursor-pointer')!);
    expect(onNavigate).toHaveBeenCalledWith('inventory');
  });

  it('allows quick role simulation from the summary bar', () => {
    const onSwitchRole = vi.fn();

    render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={vi.fn()}
        onSwitchRole={onSwitchRole}
      />
    );

    const waiterButton = screen.getByText('🍽️ Waiter');
    fireEvent.click(waiterButton);
    expect(onSwitchRole).toHaveBeenCalledWith('waiter');
  });

  it('applies responsive grid classes to stack vertically on mobile (grid-cols-1) and expand on larger screens', () => {
    const { container } = render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={vi.fn()}
      />
    );

    // Main cards grid should have mobile single-column stacking and responsive breakpoints
    const cardsGrid = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4');
    expect(cardsGrid).not.toBeNull();

    // Secondary metrics grid should also support vertical stacking on mobile screens
    const secondaryGrid = container.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3');
    expect(secondaryGrid).not.toBeNull();
  });

  it('triggers visual notification and subtle pulse animation when a new kitchen order is received', () => {
    const { rerender } = render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={vi.fn()}
      />
    );

    // Initially, no new order badge
    expect(screen.queryByTestId('new-order-badge')).toBeNull();
    expect(screen.queryByTestId('new-order-banner')).toBeNull();

    // Now re-render with increased activeKotsCount (new kitchen order received)
    const updatedMetrics = {
      ...sampleMetrics,
      activeKotsCount: 8,
      latestKotNumber: '108',
      latestKotTable: 'T4'
    };

    rerender(
      <SummaryCardsGrid
        metrics={updatedMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={vi.fn()}
      />
    );

    // Visual notification and pulse elements should now appear
    expect(screen.getByTestId('new-order-badge')).toBeDefined();
    expect(screen.getByText('NEW ORDER')).toBeDefined();
    expect(screen.getByTestId('new-order-banner')).toBeDefined();
    expect(screen.getByText(/KOT #108 received for Table T4!/)).toBeDefined();
    expect(screen.getByTestId('new-order-pulse-bar')).toBeDefined();

    // The card container should have pulsing border and ring classes
    const card = screen.getByTestId('active-kots-card');
    expect(card.className).toContain('border-amber-500');
    expect(card.className).toContain('ring-amber-400');
  });

  it('clears notification when Active KOTs card is clicked to navigate', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={onNavigate}
      />
    );

    // Receive new order
    rerender(
      <SummaryCardsGrid
        metrics={{ ...sampleMetrics, activeKotsCount: 9 }}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={onNavigate}
      />
    );

    expect(screen.getByTestId('new-order-badge')).toBeDefined();

    // Click card
    const card = screen.getByTestId('active-kots-card');
    fireEvent.click(card);

    // Should navigate to kot
    expect(onNavigate).toHaveBeenCalledWith('kot');

    // Badge and banner should be dismissed
    expect(screen.queryByTestId('new-order-badge')).toBeNull();
    expect(screen.queryByTestId('new-order-banner')).toBeNull();
  });

  it('allows manual simulation of kitchen order pulse via Simulate New KOT button', () => {
    render(
      <SummaryCardsGrid
        metrics={sampleMetrics}
        userRole="owner"
        isOwner={true}
        isManager={false}
        isWaiter={false}
        hasPermission={() => true}
        onNavigate={vi.fn()}
      />
    );

    const simulateBtn = screen.getByTestId('simulate-order-btn');
    fireEvent.click(simulateBtn);

    // Should activate new order notification and pulse
    expect(screen.getByTestId('new-order-badge')).toBeDefined();
    expect(screen.getByTestId('new-order-banner')).toBeDefined();
    expect(screen.getByTestId('new-order-pulse-bar')).toBeDefined();
  });
});
