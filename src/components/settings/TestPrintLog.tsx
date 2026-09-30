import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Unplug,
  ShieldAlert,
  Zap,
  HelpCircle,
  Terminal,
  Trash2,
  Play,
  Clock,
  Printer
} from 'lucide-react';
import { PrintJobLog, RestaurantSettings } from '../../types';
import { PrintDiagnosticsService } from '../../services/printDiagnostics';
import { PrinterService } from '../../services/printerService';
import {
  resolvePrinterErrorCode,
  PrinterDiagnosticCodeInfo,
  PRINTER_ERROR_CATALOG
} from '../../services/printerErrorCodes';

interface TestPrintLogProps {
  settings?: RestaurantSettings;
  filterTestOnly?: boolean;
  onRunTestPrint?: () => void;
  className?: string;
}

export const TestPrintLog: React.FC<TestPrintLogProps> = ({
  settings,
  filterTestOnly = false,
  onRunTestPrint,
  className = ''
}) => {
  const [logs, setLogs] = useState<PrintJobLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);
  const [showTroubleshooterGuide, setShowTroubleshooterGuide] = useState(false);
  const [filterMode, setFilterMode] = useState<'ALL' | 'TEST_ONLY'>(filterTestOnly ? 'TEST_ONLY' : 'ALL');

  // Real-time synchronization of print attempts (Firestore + Local cache + Window events)
  useEffect(() => {
    const unsubscribe = PrintDiagnosticsService.subscribeLogs((allLogs) => {
      setLogs(allLogs);
    }, 20);

    return () => unsubscribe();
  }, []);

  // Filter to the last 5 relevant print attempts
  const last5Attempts = useMemo(() => {
    let filtered = logs;
    if (filterMode === 'TEST_ONLY') {
      filtered = logs.filter((log) => log.jobType === 'TEST_PAGE');
    }
    return filtered.slice(0, 5);
  }, [logs, filterMode]);

  // Aggregate health metrics over the last 5 attempts
  const stats = useMemo(() => {
    const total = last5Attempts.length;
    if (total === 0) {
      return { successCount: 0, failureCount: 0, restrictedCount: 0, healthPercent: 100, hasDisconnection: false };
    }
    const successCount = last5Attempts.filter((l) => l.status === 'SUCCESS').length;
    const failureCount = last5Attempts.filter((l) => l.status === 'FAILURE').length;
    const restrictedCount = last5Attempts.filter((l) => l.status === 'RESTRICTED').length;
    const healthPercent = Math.round((successCount / total) * 100);

    const hasDisconnection = last5Attempts.some((l) => {
      if (l.status !== 'FAILURE') return false;
      const codeInfo = resolvePrinterErrorCode(l);
      return codeInfo.isDisconnectionRelated;
    });

    return { successCount, failureCount, restrictedCount, healthPercent, hasDisconnection };
  }, [last5Attempts]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleExecuteTestPrint = async () => {
    setIsRunningTest(true);
    try {
      if (onRunTestPrint) {
        onRunTestPrint();
      } else {
        PrinterService.printDiagnosticTestPage(settings);
      }
    } finally {
      setTimeout(() => setIsRunningTest(false), 500);
    }
  };

  const handleSimulateDisconnection = (code: 'ERR_PRINTER_OFFLINE' | 'ERR_PORT_DISCONNECTED' | 'ERR_SPOOLER_TIMEOUT' | 'ERR_PAPER_EMPTY') => {
    PrinterService.recordDisconnectionDiagnostic(code);
    setShowSimulateMenu(false);
  };

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear the print diagnostic log history?')) {
      PrintDiagnosticsService.clearLocalLogs();
      setLogs([]);
    }
  };

  return (
    <div
      id="test-print-log-container"
      className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-tight">
                Test Print Log
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono">
                LAST 5 ATTEMPTS
              </span>
              {stats.hasDisconnection && (
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono flex items-center gap-1 animate-pulse">
                  <Unplug className="w-3 h-3" />
                  <span>DISCONNECTION DETECTED</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks real-time dispatch status, hardware handshakes &amp; disconnection error codes
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Mode Toggle */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-slate-800 text-slate-100 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Prints
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('TEST_ONLY')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filterMode === 'TEST_ONLY'
                  ? 'bg-slate-800 text-slate-100 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Test Pages
            </button>
          </div>

          {/* Quick Run Test Print Button */}
          <button
            id="btn-test-print-log-run"
            type="button"
            onClick={handleExecuteTestPrint}
            disabled={isRunningTest}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            title="Execute a new test print to record the latest attempt"
          >
            <Play className={`w-3 h-3 ${isRunningTest ? 'animate-spin' : ''}`} />
            <span>{isRunningTest ? 'Printing...' : 'Run Test Print'}</span>
          </button>

          {/* Simulate Disconnection Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSimulateMenu(!showSimulateMenu)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1"
              title="Simulate printer disconnection to test error codes and troubleshooting recommendations"
            >
              <Unplug className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Error</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showSimulateMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Simulate Disconnection Code
                </div>
                <button
                  type="button"
                  onClick={() => handleSimulateDisconnection('ERR_PRINTER_OFFLINE')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer flex items-center justify-between"
                >
                  <span>1001: Printer Offline</span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">OFFLINE</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateDisconnection('ERR_PORT_DISCONNECTED')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer flex items-center justify-between"
                >
                  <span>1002: Port Disconnected</span>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">COM / USB</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateDisconnection('ERR_SPOOLER_TIMEOUT')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer flex items-center justify-between"
                >
                  <span>1004: Spooler Timeout</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">TIMEOUT</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateDisconnection('ERR_PAPER_EMPTY')}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer flex items-center justify-between"
                >
                  <span>1005: Paper Empty / Cover</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">PAPER</span>
                </button>
              </div>
            )}
          </div>

          {/* Clear Logs Button */}
          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="p-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              title="Clear print diagnostic history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual Health Pipeline (5 Attempt Slots) */}
      <div className="px-4 sm:px-5 py-3 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-[11px] font-semibold">Latest 5 Attempts:</span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((index) => {
              const attempt = last5Attempts[index];
              if (!attempt) {
                return (
                  <div
                    key={index}
                    className="w-7 h-7 rounded-lg border border-dashed border-slate-800 bg-slate-900/40 flex items-center justify-center text-[10px] text-slate-600 font-mono"
                    title={`Attempt #${index + 1}: Empty`}
                  >
                    #{index + 1}
                  </div>
                );
              }

              const isSuccess = attempt.status === 'SUCCESS';
              const isRestricted = attempt.status === 'RESTRICTED';
              const isFailure = attempt.status === 'FAILURE';
              const codeInfo = resolvePrinterErrorCode(attempt);

              return (
                <button
                  key={attempt.id}
                  type="button"
                  onClick={() => setExpandedLogId(expandedLogId === attempt.id ? null : attempt.id)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                    isSuccess
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30'
                      : isRestricted
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-rose-500/20 border-rose-500/50 text-rose-400 hover:bg-rose-500/30 animate-pulse'
                  } ${expandedLogId === attempt.id ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-950' : ''}`}
                  title={`#${index + 1}: ${attempt.referenceNumber} • ${attempt.status} (${codeInfo.code})`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isRestricted ? (
                    <AlertTriangle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Health Metrics Strip */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Success Rate:</span>
            <span className={`font-bold ${
              stats.healthPercent >= 80 ? 'text-emerald-400' : stats.healthPercent >= 50 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {stats.healthPercent}% ({stats.successCount}/{last5Attempts.length || 0})
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-slate-500">Failures:</span>
            <span className={`font-bold ${stats.failureCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {stats.failureCount}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowTroubleshooterGuide(!showTroubleshooterGuide)}
            className="text-amber-400 hover:text-amber-300 font-sans font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{showTroubleshooterGuide ? 'Hide Guide' : 'Disconnection Guide'}</span>
          </button>
        </div>
      </div>

      {/* Disconnection Troubleshooting Quick Guide (Collapsible) */}
      {showTroubleshooterGuide && (
        <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-200 text-xs">
                Printer Disconnection Troubleshooting Matrix
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Rugtek RP326B / Standard ESC/POS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                <span>Power &amp; Cable Link</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Check green POWER LED on front panel. Verify USB Type-B cable is plugged into a motherboard USB port (avoid unpowered hubs).
              </p>
              <span className="inline-block font-mono text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Code 1001: ERR_PRINTER_OFFLINE
              </span>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">2</span>
                <span>COM Port Sleep Mode</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Disable &ldquo;USB Selective Suspend&rdquo; in Windows Power Options to stop OS from shutting down the virtual COM/USB port during idle.
              </p>
              <span className="inline-block font-mono text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Code 1002: ERR_PORT_DISCONNECTED
              </span>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">3</span>
                <span>Spooler Queue Recovery</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                If Windows queue is jammed, open CMD as admin and run <code className="text-amber-300">net stop spooler && net start spooler</code>.
              </p>
              <span className="inline-block font-mono text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Code 1004: ERR_SPOOLER_TIMEOUT
              </span>
            </div>

            {/* Step 4 */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px]">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">4</span>
                <span>Hardware Self-Test</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Turn printer OFF, hold FEED button down while turning ON to print DIP switch diagnostics, printhead density &amp; baud rate (19200).
              </p>
              <span className="inline-block font-mono text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                Code 1007: ERR_HANDSHAKE_FAILED
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: List of the Last 5 Print Attempts */}
      <div className="p-4 sm:p-5 space-y-3">
        {last5Attempts.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-200 text-sm">No print attempts recorded yet</div>
              <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                Trigger a diagnostic test print or settle a customer bill. The status and troubleshooting codes of the latest 5 print jobs will automatically appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExecuteTestPrint}
              disabled={isRunningTest}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-all cursor-pointer inline-flex items-center gap-2 shadow-md shadow-amber-500/10"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Execute First Test Print</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {last5Attempts.map((log, index) => {
              const isExpanded = expandedLogId === log.id;
              const isSuccess = log.status === 'SUCCESS';
              const isRestricted = log.status === 'RESTRICTED';
              const isFailure = log.status === 'FAILURE';
              const codeInfo = resolvePrinterErrorCode(log);
              const attemptNumber = index + 1;

              return (
                <div
                  key={log.id}
                  id={`test-print-log-item-${index}`}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isFailure
                      ? 'bg-slate-950/90 border-rose-500/40 hover:border-rose-500/70'
                      : isRestricted
                      ? 'bg-slate-950/90 border-amber-500/40 hover:border-amber-500/70'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Primary Summary Row */}
                  <div
                    className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Attempt Number Badge */}
                      <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 text-[10px] font-mono font-bold text-slate-400 flex items-center justify-center shrink-0">
                        #{attemptNumber}
                      </span>

                      {/* Status Icon */}
                      <div className="shrink-0">
                        {isSuccess ? (
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : isRestricted ? (
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                            <XCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Job Metadata & Reference */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-slate-200 text-xs">
                            {log.referenceNumber}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-900 text-slate-400 border border-slate-800">
                            {log.jobType}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 text-slate-400 border border-slate-800">
                            {log.paperWidth}
                          </span>
                          {index === 0 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              LATEST
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          </span>
                          <span>•</span>
                          <span>Method: <strong className="text-slate-300">{log.method}</strong></span>
                          <span>•</span>
                          <span>Duration: <strong className="text-slate-300">{log.durationMs}ms</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Error Code Pill */}
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold uppercase border flex items-center gap-1 ${
                              isSuccess
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : isRestricted
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            <span>{codeInfo.code}</span>
                            <span className="text-[9px] opacity-75 font-normal">({codeInfo.numericCode})</span>
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-xs text-right">
                          {codeInfo.title}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Toggle details"
                        className="p-1 text-slate-400 hover:text-white rounded transition-colors ml-1"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Troubleshooting & Diagnostic Details */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-800/80 bg-slate-900/60 space-y-3 text-xs">
                      
                      {/* Diagnostic Summary Strip */}
                      <div className={`p-3 rounded-xl border space-y-1.5 ${
                        isSuccess
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                          : isRestricted
                          ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                          : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                      }`}>
                        <div className="flex items-center justify-between gap-2 font-bold text-xs">
                          <span className="flex items-center gap-1.5">
                            {isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            <span>{codeInfo.title}</span>
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800">
                            Category: {codeInfo.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          {codeInfo.summary}
                        </p>
                        {log.errorMessage && (
                          <div className="mt-1 pt-1 border-t border-slate-800/60 font-mono text-[10px] text-rose-300">
                            <strong>Hardware Message:</strong> {log.errorMessage}
                          </div>
                        )}
                      </div>

                      {/* Step-by-Step Troubleshooting Remedies */}
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                        <div className="font-bold text-slate-200 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px]">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Recommended Troubleshooting Steps:</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Action Code: {codeInfo.numericCode}
                          </span>
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-slate-400">
                          {codeInfo.remedies.map((remedy, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-2">
                              <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                {rIdx + 1}
                              </span>
                              <span className="text-slate-300">{remedy}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Bar inside expanded view */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="text-[10px] text-slate-500 font-mono">
                          ID: {log.id} • {new Date(log.timestamp).toISOString()}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const diagnosticText = `PRINTER DIAGNOSTIC REPORT\nTimestamp: ${log.timestamp}\nJob Reference: ${log.referenceNumber}\nStatus: ${log.status}\nError Code: ${codeInfo.code} (${codeInfo.numericCode})\nTitle: ${codeInfo.title}\nHardware Message: ${log.errorMessage || 'N/A'}\nRemedies:\n${codeInfo.remedies.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
                              handleCopy(diagnosticText, `diag-${log.id}`);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1 border border-slate-700 font-mono text-[10px]"
                          >
                            {copiedKey === `diag-${log.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copiedKey === `diag-${log.id}` ? 'Report Copied' : 'Copy Diagnostic'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleExecuteTestPrint}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Retry Test Print</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          Tracking active • Rugtek RP326B profile (80mm ESC/POS)
        </span>
        <span className="font-mono text-[10px]">
          Window / Spooler / WebSerial / USB
        </span>
      </div>
    </div>
  );
};
