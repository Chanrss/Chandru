import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrintDiagnosticsService } from './printDiagnostics';
import { PrinterService } from './printerService';
import { Bill, BillItem, RestaurantSettings } from '../types';

const baseSettings: RestaurantSettings = {
  restaurantName: 'Test Bhavan',
  address: '100 South Car St, Madurai',
  phone: '9876543210',
  paperWidth: '80mm',
  receiptFontSize: 12
};

describe('PrintDiagnosticsService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('records print jobs with timestamps, status, duration and caches locally', async () => {
    const job = await PrintDiagnosticsService.recordPrintJob({
      jobType: 'BILL',
      referenceNumber: 'BN-01',
      status: 'SUCCESS',
      method: 'IFRAME',
      paperWidth: '80mm',
      fontSize: 12,
      itemCount: 3,
      totalAmount: 250,
      durationMs: 45,
      isMockMode: false
    });

    expect(job).toBeDefined();
    expect(job.id).toContain('print_job_');
    expect(job.status).toBe('SUCCESS');
    expect(job.referenceNumber).toBe('BN-01');
    expect(job.durationMs).toBe(45);
    expect(new Date(job.timestamp).getTime()).not.toBeNaN();

    const localLogs = PrintDiagnosticsService.getLocalLogs();
    expect(localLogs.length).toBe(1);
    expect(localLogs[0].id).toBe(job.id);
  });

  it('handles FAILURE and RESTRICTED states with error information', async () => {
    const failedJob = await PrintDiagnosticsService.recordPrintJob({
      jobType: 'BILL',
      referenceNumber: 'BN-02',
      status: 'FAILURE',
      method: 'DIRECT_DOM',
      paperWidth: '80mm',
      itemCount: 1,
      totalAmount: 100,
      durationMs: 120,
      errorMessage: 'Printer head offline or out of paper'
    });

    expect(failedJob.status).toBe('FAILURE');
    expect(failedJob.errorMessage).toBe('Printer head offline or out of paper');

    const restrictedJob = await PrintDiagnosticsService.recordPrintJob({
      jobType: 'TEST_PAGE',
      referenceNumber: 'TEST-1234',
      status: 'RESTRICTED',
      method: 'IFRAME',
      paperWidth: '58mm',
      itemCount: 1,
      durationMs: 30,
      errorMessage: 'Print blocked by container sandbox'
    });

    expect(restrictedJob.status).toBe('RESTRICTED');
    const logs = PrintDiagnosticsService.getLocalLogs();
    expect(logs.length).toBe(2);
  });

  it('clears local logs successfully', async () => {
    await PrintDiagnosticsService.recordPrintJob({
      jobType: 'BILL',
      referenceNumber: 'BN-10',
      status: 'SUCCESS',
      method: 'MOCK',
      paperWidth: '80mm',
      itemCount: 2,
      durationMs: 0
    });

    expect(PrintDiagnosticsService.getLocalLogs().length).toBe(1);
    PrintDiagnosticsService.clearLocalLogs();
    expect(PrintDiagnosticsService.getLocalLogs().length).toBe(0);
  });

  it('generates complete diagnostic test page HTML', () => {
    const html80 = PrinterService.generateDiagnosticTestSlipHTML({
      ...baseSettings,
      paperWidth: '80mm',
      receiptFontSize: 12
    });

    expect(html80).toContain('PRINTER DIAGNOSTIC');
    expect(html80).toContain('HARDWARE TEST PAGE');
    expect(html80).toContain('80mm (3-Inch)');
    expect(html80).toContain('ALIGNMENT & DENSITY TEST');
    expect(html80).toContain('DIAGNOSTIC PASS');

    const html58 = PrinterService.generateDiagnosticTestSlipHTML({
      ...baseSettings,
      paperWidth: '58mm',
      receiptFontSize: 10
    });
    expect(html58).toContain('58mm (2-Inch)');
    expect(html58).toContain('width: 48mm');
  });

  it('triggers diagnostic test page and records a TEST_PAGE job', () => {
    const result = PrinterService.printDiagnosticTestPage(baseSettings);

    expect(result).toBeDefined();
    const logs = PrintDiagnosticsService.getLocalLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].jobType).toBe('TEST_PAGE');
    expect(logs[0].referenceNumber).toContain('TEST-');
  });

  it('records printBill execution telemetry', () => {
    const bill: Bill = {
      id: 'b-diag',
      billNumber: 'BN-99',
      businessDate: '2026-09-07',
      orderType: 'DINE_IN',
      priceType: 'NON_AC',
      subtotal: 150,
      discount: 0,
      grandTotal: 150,
      status: 'COMPLETED',
      reprintCount: 0,
      createdAt: Date.now()
    };

    const items: BillItem[] = [
      {
        id: 'bi-1',
        billId: 'b-diag',
        itemId: 'm-1',
        itemCode: '101',
        itemName: 'Ghee Roast',
        quantity: 1,
        unitPrice: 150,
        totalPrice: 150,
        priceType: 'NON_AC',
        createdAt: Date.now()
      }
    ];

    PrinterService.setMockPrintMode(true);
    PrinterService.printBill(bill, items, baseSettings, false);

    const logs = PrintDiagnosticsService.getLocalLogs();
    const billJob = logs.find((l) => l.referenceNumber === 'BN-99');
    expect(billJob).toBeDefined();
    expect(billJob?.jobType).toBe('BILL');
    expect(billJob?.method).toBe('MOCK');
    expect(billJob?.totalAmount).toBe(150);
  });
});
