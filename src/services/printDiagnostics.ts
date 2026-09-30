import { collection, doc, setDoc, getDocs, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { PrintJobLog, PrintJobStatus, PrintJobType, PrintMethod } from '../types';
import { recordPrintTransaction, clearLocalPrintLogs } from '../utils/localPrintLog';

const STORAGE_KEY = 'pos_print_logs_cache';
const MAX_LOCAL_LOGS = 100;

export class PrintDiagnosticsService {
  /**
   * Reads locally cached diagnostic print logs from localStorage.
   */
  static getLocalLogs(): PrintJobLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to read local print logs cache:', e);
      return [];
    }
  }

  /**
   * Saves a print log to the local cache, keeping the latest MAX_LOCAL_LOGS entries.
   */
  private static saveToLocalCache(log: PrintJobLog): void {
    try {
      const existing = this.getLocalLogs();
      const filtered = existing.filter((item) => item.id !== log.id);
      const updated = [log, ...filtered].slice(0, MAX_LOCAL_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist print log to local cache:', e);
    }
  }

  /**
   * Formats and prints a rich, color-coded diagnostic banner to the browser console.
   */
  static logToConsole(job: PrintJobLog): void {
    const isSuccess = job.status === 'SUCCESS';
    const isRestricted = job.status === 'RESTRICTED';
    const isFailure = job.status === 'FAILURE';

    const statusBadge = isSuccess ? '✅ SUCCESS' : isRestricted ? '⚠️ RESTRICTED' : isFailure ? '❌ FAILED' : '⏳ PENDING';
    const statusBg = isSuccess ? '#059669' : isRestricted ? '#d97706' : isFailure ? '#dc2626' : '#2563eb';

    const header = `%c[PRINT DIAGNOSTIC] ${statusBadge} | ${job.jobType} #${job.referenceNumber} | ${job.method} (${job.durationMs}ms)`;
    const headerStyle = `background: ${statusBg}; color: #ffffff; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-family: monospace;`;

    console.groupCollapsed(header, headerStyle);
    console.info('%cTimestamp (ISO):', 'font-weight: bold;', job.timestamp);
    console.info('%cJob ID:', 'font-weight: bold;', job.id);
    console.info('%cReference #:', 'font-weight: bold;', job.referenceNumber);
    console.info('%cType & Target:', 'font-weight: bold;', `${job.jobType} on ${job.paperWidth} (Base font: ${job.fontSize || 12}px)`);
    console.info('%cMethod:', 'font-weight: bold;', job.method);
    console.info('%cDuration:', 'font-weight: bold;', `${job.durationMs} ms`);
    console.info('%cTotal Items / Amount:', 'font-weight: bold;', `${job.itemCount} items | ₹${job.totalAmount ?? 0}`);
    console.info('%cEnvironment:', 'font-weight: bold;', {
      isIframe: job.isIframe,
      isMockMode: job.isMockMode,
      userAgent: job.userAgent,
      user: job.userName || job.userId || 'staff'
    });

    if (job.errorMessage || job.errorStack) {
      console.error('%cDiagnostic Error Details:', 'color: #ef4444; font-weight: bold;', {
        message: job.errorMessage,
        stack: job.errorStack
      });
    }

    if (isRestricted) {
      console.warn(
        '%cContainer Notice:%c Printing inside a sandboxed iframe may block direct window.print(). The fallback preview modal has been prepared.',
        'font-weight: bold; color: #f59e0b;',
        'color: inherit;'
      );
    }
    console.groupEnd();
  }

  /**
   * Records a complete diagnostic print job:
   * 1. Logs to browser console with styled banners
   * 2. Persists to Firestore `print_logs` collection
   * 3. Stores in localStorage buffer for offline/immediate availability
   * 4. Dispatches window event for live UI reactivity
   */
  static async recordPrintJob(params: {
    jobType: PrintJobType;
    referenceNumber: string;
    status: PrintJobStatus;
    method: PrintMethod;
    paperWidth: '80mm' | '58mm' | string;
    fontSize?: number;
    itemCount: number;
    totalAmount?: number;
    durationMs: number;
    errorMessage?: string | null;
    errorCode?: string | null;
    errorStack?: string | null;
    isMockMode?: boolean;
    userId?: string;
    userName?: string;
  }): Promise<PrintJobLog> {
    const now = Date.now();
    const jobId = `print_job_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';

    const log: PrintJobLog = {
      id: jobId,
      timestamp: new Date(now).toISOString(),
      createdAt: now,
      jobType: params.jobType,
      referenceNumber: params.referenceNumber,
      status: params.status,
      method: params.method,
      paperWidth: params.paperWidth,
      fontSize: params.fontSize,
      itemCount: params.itemCount,
      totalAmount: params.totalAmount,
      durationMs: params.durationMs,
      errorMessage: params.errorMessage || null,
      errorCode: params.errorCode || null,
      errorStack: params.errorStack || null,
      isMockMode: params.isMockMode ?? (typeof localStorage !== 'undefined' && localStorage.getItem('pos_printer_mock_mode') === 'true'),
      userAgent,
      isIframe,
      userId: params.userId || auth?.currentUser?.uid || undefined,
      userName: params.userName || auth?.currentUser?.displayName || undefined
    };

    // 1. Log to console immediately
    this.logToConsole(log);

    // 2. Cache in local storage buffer
    this.saveToLocalCache(log);

    // 3. Record in local print transaction log utility
    try {
      recordPrintTransaction({
        transactionId: params.referenceNumber,
        transactionType: params.jobType,
        status: params.status === 'RESTRICTED' ? 'FAILURE' : params.status,
        printMethod: params.method,
        durationMs: params.durationMs,
        totalAmount: params.totalAmount,
        itemCount: params.itemCount,
        paperWidth: params.paperWidth,
        errorMessage: params.errorMessage || undefined,
        errorCode: params.errorCode || undefined,
        timeEpoch: now,
        timestamp: log.timestamp
      });
    } catch (e) {
      console.warn('[PrintDiagnostics] Failed to record in local print log:', e);
    }

    // 4. Dispatch live UI event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-print-job-logged', { detail: log }));
    }

    // 4. Save to Firestore (only if authenticated user is present)
    if (auth?.currentUser) {
      try {
        const firestorePayload: Record<string, any> = {};
        Object.entries(log).forEach(([key, value]) => {
          if (value !== undefined) {
            firestorePayload[key] = value;
          }
        });
        await setDoc(doc(db, 'print_logs', jobId), firestorePayload);
      } catch {
        // Silently preserve in local cache
      }
    }

    return log;
  }

  /**
   * Fetches recent print diagnostic logs, prioritizing Firestore with fallback to local cache.
   */
  static async getLogs(maxResults = 50): Promise<PrintJobLog[]> {
    if (auth?.currentUser) {
      try {
        const q = query(collection(db, 'print_logs'), orderBy('createdAt', 'desc'), limit(maxResults));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const firestoreList: PrintJobLog[] = [];
          snap.forEach((d) => firestoreList.push({ id: d.id, ...d.data() } as PrintJobLog));
          return firestoreList;
        }
      } catch {
        // Seamless fallback to local cache
      }
    }
    return this.getLocalLogs().slice(0, maxResults);
  }

  /**
   * Subscribes to real-time updates from the Firestore `print_logs` collection.
   * If Firestore is unauthenticated, unavailable, or permission-restricted, falls back seamlessly to the local cache.
   */
  static subscribeLogs(callback: (logs: PrintJobLog[]) => void, maxResults = 50): () => void {
    // Initial emission from local cache so UI displays instantly
    callback(this.getLocalLogs().slice(0, maxResults));

    let unsubFirestore: (() => void) | undefined;

    const setupFirestoreListener = () => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = undefined;
      }

      // Per Firebase Skill: Only attach onSnapshot listeners if auth is ready and user is authenticated
      if (!auth?.currentUser) {
        return;
      }

      try {
        const q = query(collection(db, 'print_logs'), orderBy('createdAt', 'desc'), limit(maxResults));
        unsubFirestore = onSnapshot(
          q,
          (snap) => {
            const list: PrintJobLog[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as PrintJobLog));
            if (list.length > 0) {
              callback(list);
            } else {
              callback(this.getLocalLogs().slice(0, maxResults));
            }
          },
          (_error) => {
            // If permissions are restricted or connection is offline, seamlessly fall back to local cache
            callback(this.getLocalLogs().slice(0, maxResults));
          }
        );
      } catch {
        callback(this.getLocalLogs().slice(0, maxResults));
      }
    };

    // Initialize listener when authenticated
    setupFirestoreListener();

    // Listen to auth state transitions to dynamically attach/detach listener
    const unsubAuth = auth && typeof auth.onAuthStateChanged === 'function'
      ? auth.onAuthStateChanged(() => {
          setupFirestoreListener();
        })
      : undefined;

    // Also listen to local window events for immediate local updates
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PrintJobLog>;
      if (customEvent.detail) {
        callback(this.getLocalLogs().slice(0, maxResults));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pos-print-job-logged', handleLocalEvent);
    }

    return () => {
      if (unsubFirestore) unsubFirestore();
      if (unsubAuth) unsubAuth();
      if (typeof window !== 'undefined') {
        window.removeEventListener('pos-print-job-logged', handleLocalEvent);
      }
    };
  }

  /**
   * Clears locally stored print logs.
   */
  static clearLocalLogs(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      clearLocalPrintLogs();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos-print-job-logged', { detail: null }));
      }
    } catch (e) {
      console.warn('Failed to clear local print logs:', e);
    }
  }

  /**
   * Returns formatted JSON for debug export or sharing.
   */
  static exportLogsAsJSON(): string {
    const logs = this.getLocalLogs();
    return JSON.stringify(logs, null, 2);
  }
}
