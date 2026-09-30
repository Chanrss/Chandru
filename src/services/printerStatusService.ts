import { PrintDiagnosticsService } from './printDiagnostics';
import { PrinterService } from './printerService';
import { PrinterConnectionService } from './printerConnectionService';
import { PrintJobLog, RestaurantSettings, ConnectedPrinterInfo } from '../types';

export type PrinterStatusCode = 'CONNECTED' | 'NOT_CONNECTED' | 'READY' | 'RESTRICTED' | 'OFFLINE' | 'MOCK';

export interface PrinterHealthCheck {
  status: PrinterStatusCode;
  isReady: boolean;
  label: string;
  badgeColor: string;
  dotColor: string;
  summary: string;
  warningMessage: string | null;
  paperWidth: string;
  isSandboxed: boolean;
  isMockMode: boolean;
  lastJob: PrintJobLog | null;
  lastCheckedAt: number;
  connectedInfo: ConnectedPrinterInfo;
}

export class PrinterStatusService {
  private static subscribers: Set<(check: PrinterHealthCheck) => void> = new Set();
  private static cachedCheck: PrinterHealthCheck | null = null;
  private static initialized = false;

  /**
   * Evaluates current printer & browser printing readiness.
   */
  static getHealthCheck(settings?: RestaurantSettings): PrinterHealthCheck {
    const isBrowser = typeof window !== 'undefined';
    const hasPrintApi = isBrowser && typeof window.print === 'function';
    const isSandboxed = isBrowser && window.self !== window.top;
    const isMockMode = typeof PrinterService?.isMockPrintMode === 'function' ? PrinterService.isMockPrintMode() : false;
    const paperWidth = (settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM') ? '58mm' : '80mm';
    const connectedInfo = PrinterConnectionService.getConnectedPrinter();

    // Retrieve latest diagnostic print log
    const recentLogs = PrintDiagnosticsService.getLocalLogs();
    const lastJob = recentLogs.length > 0 ? recentLogs[0] : null;
    const hasSucceededBefore = recentLogs.some((l) => l.status === 'SUCCESS') || connectedInfo.testPrintVerified;

    let status: PrinterStatusCode = 'READY';
    let warningMessage: string | null = null;
    let summary = 'Printer is ready for instant thermal receipts';
    let label = 'PRINTER READY';
    let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-300';
    let dotColor = 'bg-emerald-500';

    const activeModelName = settings?.printerModelName || connectedInfo.deviceName || 'Thermal Receipt Printer';

    if (!hasPrintApi) {
      status = 'OFFLINE';
      label = 'PRINTER OFFLINE';
      badgeColor = 'bg-red-50 text-red-700 border-red-300';
      dotColor = 'bg-red-600 animate-pulse';
      summary = 'Browser printing interface is unavailable on this device';
      warningMessage = 'Your browser environment does not support window.print(). Thermal printing cannot be triggered.';
    } else if (lastJob && lastJob.status === 'FAILURE') {
      status = 'OFFLINE';
      label = 'PRINTER ERROR';
      badgeColor = 'bg-red-50 text-red-700 border-red-300';
      dotColor = 'bg-red-600 animate-pulse';
      summary = `Last print failed: ${lastJob.errorMessage || 'Hardware communication error'}`;
      warningMessage = `Printer error encountered (${lastJob.referenceNumber}). Ensure thermal printer is plugged in, powered on, and paper roll is loaded.`;
    } else if (isMockMode) {
      status = 'MOCK';
      label = 'MOCK PRINT MODE';
      badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-300';
      dotColor = 'bg-indigo-500';
      summary = 'Development simulation active - receipts are logged without physical paper feed';
      warningMessage = 'Hardware printer is bypassed. Go to Settings > Thermal Printer to enable real hardware printing.';
    } else if (isSandboxed) {
      status = 'READY';
      label = 'PRINTER READY';
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      dotColor = 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]';
      summary = `Thermal printing ready (${activeModelName}). (Open in New Tab for physical USB spooler)`;
      warningMessage = null;
    } else {
      status = 'READY';
      label = 'PRINTER READY';
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
      dotColor = 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]';
      summary = `Thermal printer active (${activeModelName})`;
    }

    const result: PrinterHealthCheck = {
      status,
      isReady: status === 'READY' || (status as any) === 'CONNECTED' || (status as any) === 'RESTRICTED' || status === 'MOCK',
      label,
      badgeColor,
      dotColor,
      summary,
      warningMessage,
      paperWidth,
      isSandboxed,
      isMockMode,
      lastJob,
      lastCheckedAt: Date.now(),
      connectedInfo
    };

    this.cachedCheck = result;
    return result;
  }

  /**
   * Initializes listeners to reactively refresh health checks.
   */
  static init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const notify = () => {
      const check = this.getHealthCheck();
      this.subscribers.forEach((cb) => cb(check));
    };

    window.addEventListener('pos-print-job-logged', notify);
    window.addEventListener('pos-print-restricted', notify);
    window.addEventListener('pos-printer-connection-changed', notify);
    window.addEventListener('online', notify);
    window.addEventListener('offline', notify);
    window.addEventListener('storage', notify);
  }

  /**
   * Subscribes a React component to live printer health updates.
   */
  static subscribe(callback: (check: PrinterHealthCheck) => void): () => void {
    this.init();
    this.subscribers.add(callback);
    callback(this.cachedCheck || this.getHealthCheck());

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Executes a diagnostic test print and re-evaluates health.
   */
  static testPrint(settings?: RestaurantSettings): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    const res = PrinterService.printDiagnosticTestPage(settings, true);
    // Broadcast test print event to trigger on-screen animation
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-bill-printing', {
        detail: {
          bill: {
            billNumber: 'TEST-01',
            grandTotal: 0,
            userName: 'Printer Test',
            createdAt: Date.now()
          },
          items: [{ itemName: 'Thermal Test Slip', quantity: 1, totalPrice: 0 }]
        }
      }));
    }
    return res;
  }
}
