import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TestPrintLog } from './TestPrintLog';
import { PrintDiagnosticsService } from '../../services/printDiagnostics';
import { PrinterService } from '../../services/printerService';
import { RestaurantSettings, PrintJobLog } from '../../types';

const mockSettings: RestaurantSettings = {
  restaurantName: 'Sri Saravana Bhavan',
  address: '100 Main St',
  phone: '9876543210',
  paperWidth: '80mm',
  receiptFontSize: 12,
  compactMode: false
};

const mockLogs: PrintJobLog[] = [
  {
    id: 'log-1',
    timestamp: new Date(Date.now() - 1000).toISOString(),
    createdAt: Date.now() - 1000,
    jobType: 'TEST_PAGE',
    referenceNumber: 'TEST-1001',
    status: 'FAILURE',
    method: 'DIRECT_DOM',
    paperWidth: '80mm',
    itemCount: 1,
    durationMs: 4000,
    errorMessage: 'Printer offline: No handshake on USB Type-B interface. Power LED unlit.',
    errorCode: 'ERR_PRINTER_OFFLINE',
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: false
  },
  {
    id: 'log-2',
    timestamp: new Date(Date.now() - 2000).toISOString(),
    createdAt: Date.now() - 2000,
    jobType: 'BILL',
    referenceNumber: 'BN-05',
    status: 'SUCCESS',
    method: 'DIRECT_DOM',
    paperWidth: '80mm',
    itemCount: 3,
    totalAmount: 450,
    durationMs: 18,
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: false
  },
  {
    id: 'log-3',
    timestamp: new Date(Date.now() - 3000).toISOString(),
    createdAt: Date.now() - 3000,
    jobType: 'TEST_PAGE',
    referenceNumber: 'TEST-1002',
    status: 'FAILURE',
    method: 'DIRECT_DOM',
    paperWidth: '80mm',
    itemCount: 1,
    durationMs: 3500,
    errorMessage: 'Virtual COM port detached unexpectedly',
    errorCode: 'ERR_PORT_DISCONNECTED',
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: false
  },
  {
    id: 'log-4',
    timestamp: new Date(Date.now() - 4000).toISOString(),
    createdAt: Date.now() - 4000,
    jobType: 'KOT',
    referenceNumber: 'KOT-01',
    status: 'SUCCESS',
    method: 'DIRECT_DOM',
    paperWidth: '80mm',
    itemCount: 2,
    durationMs: 14,
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: false
  },
  {
    id: 'log-5',
    timestamp: new Date(Date.now() - 5000).toISOString(),
    createdAt: Date.now() - 5000,
    jobType: 'TEST_PAGE',
    referenceNumber: 'TEST-1003',
    status: 'RESTRICTED',
    method: 'IFRAME',
    paperWidth: '80mm',
    itemCount: 1,
    durationMs: 22,
    errorMessage: 'Window.print blocked by iframe sandbox',
    errorCode: 'ERR_SANDBOX_RESTRICTED',
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: true
  },
  {
    id: 'log-6',
    timestamp: new Date(Date.now() - 6000).toISOString(),
    createdAt: Date.now() - 6000,
    jobType: 'BILL',
    referenceNumber: 'BN-04',
    status: 'SUCCESS',
    method: 'DIRECT_DOM',
    paperWidth: '80mm',
    itemCount: 4,
    totalAmount: 600,
    durationMs: 20,
    isMockMode: false,
    userAgent: 'Chrome',
    isIframe: false
  }
];

describe('TestPrintLog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders the component header and tracks the last 5 attempts', () => {
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb(mockLogs);
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    expect(screen.getByText(/Test Print Log/i)).toBeDefined();
    expect(screen.getByText(/LAST 5 ATTEMPTS/i)).toBeDefined();
    expect(screen.getByText(/DISCONNECTION DETECTED/i)).toBeDefined();

    // Verify exactly the latest 5 items are displayed (log-1 to log-5, log-6 is excluded)
    expect(screen.getByText('TEST-1001')).toBeDefined();
    expect(screen.getByText('BN-05')).toBeDefined();
    expect(screen.getByText('TEST-1002')).toBeDefined();
    expect(screen.getByText('KOT-01')).toBeDefined();
    expect(screen.getByText('TEST-1003')).toBeDefined();
    expect(screen.queryByText('BN-04')).toBeNull();
  });

  it('shows helpful error codes for printer disconnection', () => {
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb(mockLogs);
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    // Code 1001 for offline
    expect(screen.getByText(/ERR_PRINTER_OFFLINE/i)).toBeDefined();
    expect(screen.getByText(/\(1001\)/i)).toBeDefined();

    // Code 1002 for port disconnection
    expect(screen.getByText(/ERR_PORT_DISCONNECTED/i)).toBeDefined();
    expect(screen.getByText(/\(1002\)/i)).toBeDefined();

    // Code 1003 for sandbox restriction
    expect(screen.getByText(/ERR_SANDBOX_RESTRICTED/i)).toBeDefined();
    expect(screen.getByText(/\(1003\)/i)).toBeDefined();

    // Success code 2000
    expect(screen.getAllByText(/SUCCESS_OK/i).length).toBeGreaterThanOrEqual(1);
  });

  it('expands an attempt to reveal detailed troubleshooting checklist and remedies', () => {
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb([mockLogs[0]]); // single offline failure
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    // Click to expand item
    const itemHeader = screen.getByText('TEST-1001');
    fireEvent.click(itemHeader);

    // Verify troubleshooting steps appear
    expect(screen.getByText(/Recommended Troubleshooting Steps:/i)).toBeDefined();
    expect(screen.getByText(/Ensure printer power rocker switch is ON/i)).toBeDefined();
    expect(screen.getByText(/Unplug and reconnect the USB Type-B or RS-232 cable/i)).toBeDefined();
    expect(screen.getByText(/Copy Diagnostic/i)).toBeDefined();
  });

  it('triggers a test print when Run Test Print button is clicked', () => {
    const printSpy = vi.spyOn(PrinterService, 'printDiagnosticTestPage').mockReturnValue({
      success: true
    });
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb([]);
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    const runBtn = screen.getByRole('button', { name: /Run Test Print/i });
    fireEvent.click(runBtn);

    expect(printSpy).toHaveBeenCalled();
  });

  it('allows simulating disconnection errors to test diagnostic handling', () => {
    const simSpy = vi.spyOn(PrinterService, 'recordDisconnectionDiagnostic').mockImplementation(() => {});
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb([]);
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    // Open Simulate Error menu
    const simMenuBtn = screen.getByRole('button', { name: /Simulate Error/i });
    fireEvent.click(simMenuBtn);

    // Click 1001: Printer Offline
    const offlineSimOption = screen.getByText(/1001: Printer Offline/i);
    fireEvent.click(offlineSimOption);

    expect(simSpy).toHaveBeenCalledWith('ERR_PRINTER_OFFLINE');
  });

  it('toggles disconnection guide matrix', () => {
    vi.spyOn(PrintDiagnosticsService, 'subscribeLogs').mockImplementation((cb) => {
      cb(mockLogs);
      return () => {};
    });

    render(<TestPrintLog settings={mockSettings} />);

    const guideBtn = screen.getByRole('button', { name: /Disconnection Guide/i });
    fireEvent.click(guideBtn);

    expect(screen.getByText(/Printer Disconnection Troubleshooting Matrix/i)).toBeDefined();
    expect(screen.getByText(/Power & Cable Link/i)).toBeDefined();
    expect(screen.getByText(/COM Port Sleep Mode/i)).toBeDefined();
    expect(screen.getByText(/Spooler Queue Recovery/i)).toBeDefined();
    expect(screen.getByText(/Hardware Self-Test/i)).toBeDefined();
  });
});
