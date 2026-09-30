import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordPrintTransaction,
  getLocalPrintLogs,
  getLogsForTransaction,
  getLatestPrintStatus,
  clearLocalPrintLogs,
  getPrintTroubleshootingReport,
  exportPrintLogsAsJSON,
  subscribeToLocalPrintLogs
} from './localPrintLog';

describe('LocalPrintLog Utility', () => {
  beforeEach(() => {
    clearLocalPrintLogs();
  });

  it('records print transactions with timestamps and stores them locally', () => {
    const entry = recordPrintTransaction({
      transactionId: 'BN-1001',
      transactionType: 'BILL',
      status: 'SUCCESS',
      printMethod: 'DIRECT_DOM',
      durationMs: 145,
      totalAmount: 250,
      itemCount: 3
    });

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.transactionId).toBe('BN-1001');
    expect(entry.status).toBe('SUCCESS');
    expect(entry.totalAmount).toBe(250);

    const logs = getLocalPrintLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].transactionId).toBe('BN-1001');
  });

  it('sorts newest logs first', () => {
    recordPrintTransaction({
      transactionId: 'BN-1001',
      status: 'SUCCESS',
      timeEpoch: 1000
    });

    recordPrintTransaction({
      transactionId: 'BN-1002',
      status: 'FAILURE',
      errorMessage: 'Spooler timeout',
      errorCode: 'ERR_TIMEOUT',
      timeEpoch: 2000
    });

    const logs = getLocalPrintLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].transactionId).toBe('BN-1002');
    expect(logs[1].transactionId).toBe('BN-1001');
  });

  it('filters logs by transactionId and gets latest status', () => {
    recordPrintTransaction({
      transactionId: 'BN-2005',
      status: 'FAILURE',
      errorMessage: 'Printer offline',
      errorCode: 'ERR_PRINTER_OFFLINE',
      timeEpoch: 1000
    });

    recordPrintTransaction({
      transactionId: 'BN-2005',
      status: 'SUCCESS',
      timeEpoch: 1500,
      retryAttempt: 1
    });

    recordPrintTransaction({
      transactionId: 'KOT-3001',
      transactionType: 'KOT',
      status: 'SUCCESS',
      timeEpoch: 2000
    });

    const bnLogs = getLogsForTransaction('bn-2005');
    expect(bnLogs.length).toBe(2);
    expect(bnLogs[0].status).toBe('SUCCESS');
    expect(bnLogs[1].status).toBe('FAILURE');

    const latestStatus = getLatestPrintStatus('BN-2005');
    expect(latestStatus).toBe('SUCCESS');

    const kotLogs = getLogsForTransaction('KOT-3001');
    expect(kotLogs.length).toBe(1);
    expect(kotLogs[0].transactionType).toBe('KOT');
  });

  it('clears all local print logs', () => {
    recordPrintTransaction({
      transactionId: 'BN-999',
      status: 'SUCCESS'
    });

    expect(getLocalPrintLogs().length).toBe(1);
    clearLocalPrintLogs();
    expect(getLocalPrintLogs().length).toBe(0);
  });

  it('generates an intermittent failure analysis report', () => {
    recordPrintTransaction({
      transactionId: 'BN-1',
      status: 'SUCCESS',
      timeEpoch: 1000,
      timestamp: '2026-09-24T10:00:00.000Z'
    });

    recordPrintTransaction({
      transactionId: 'BN-2',
      status: 'FAILURE',
      errorCode: 'ERR_TIMEOUT',
      errorMessage: 'Spooler connection failed',
      timeEpoch: 2000,
      timestamp: '2026-09-24T10:05:00.000Z'
    });

    recordPrintTransaction({
      transactionId: 'BN-2',
      status: 'SUCCESS',
      timeEpoch: 2500,
      timestamp: '2026-09-24T10:06:00.000Z',
      retryAttempt: 1
    });

    const report = getPrintTroubleshootingReport();
    expect(report.totalLogged).toBe(3);
    expect(report.successCount).toBe(2);
    expect(report.failureCount).toBe(1);
    expect(report.successRate).toBe(67);
    expect(report.hasIntermittentIssues).toBe(true);
    expect(report.recentFailures.length).toBe(1);
    expect(report.failureCodeBreakdown['ERR_TIMEOUT']).toBe(1);
    expect(report.timeSpan.firstLoggedAt).toBe('2026-09-24T10:00:00.000Z');
  });

  it('exports logs as valid formatted JSON', () => {
    recordPrintTransaction({
      transactionId: 'BN-555',
      status: 'SUCCESS',
      totalAmount: 100
    });

    const jsonStr = exportPrintLogsAsJSON();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.report).toBeDefined();
    expect(parsed.logs.length).toBe(1);
    expect(parsed.logs[0].transactionId).toBe('BN-555');
  });

  it('notifies subscribers when new print logs are recorded', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToLocalPrintLogs(callback);

    // Initial invocation on subscribe
    expect(callback).toHaveBeenCalledTimes(1);

    recordPrintTransaction({
      transactionId: 'BN-777',
      status: 'SUCCESS'
    });

    // Should receive update
    expect(callback).toHaveBeenCalledTimes(2);
    const latestArg = callback.mock.calls[1][0];
    expect(latestArg[0].transactionId).toBe('BN-777');

    unsubscribe();

    recordPrintTransaction({
      transactionId: 'BN-888',
      status: 'SUCCESS'
    });

    // Should not call after unsubscribe
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
