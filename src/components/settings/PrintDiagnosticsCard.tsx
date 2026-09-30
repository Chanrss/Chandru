import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  RotateCw, 
  Trash2, 
  Copy, 
  Check, 
  Terminal, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { PrintJobLog, RestaurantSettings } from '../../types';
import { PrintDiagnosticsService } from '../../services/printDiagnostics';
import { PrinterService } from '../../services/printerService';
import { RawEscPosTestModal } from './RawEscPosTestModal';

interface PrintDiagnosticsCardProps {
  settings?: RestaurantSettings;
}

export const PrintDiagnosticsCard: React.FC<PrintDiagnosticsCardProps> = ({ settings }) => {
  const [logs, setLogs] = useState<PrintJobLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawEscPosModal, setShowRawEscPosModal] = useState(false);
  const [isMockMode, setIsMockMode] = useState<boolean>(() => PrinterService.isMockPrintMode());
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    // Real-time subscription to Firestore & local cache
    const unsubscribe = PrintDiagnosticsService.subscribeLogs((newLogs) => {
      setLogs(newLogs);
    }, 50);

    return () => unsubscribe();
  }, []);

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      PrinterService.printDiagnosticTestPage(settings);
    } catch (e) {
      console.error('Test print failed:', e);
    } finally {
      setTimeout(() => setTesting(false), 500);
    }
  };

  const handleToggleMock = (enabled: boolean) => {
    PrinterService.setMockPrintMode(enabled);
    setIsMockMode(enabled);
  };

  const handleClearLogs = () => {
    if (window.confirm('Clear all local print diagnostic logs?')) {
      PrintDiagnosticsService.clearLocalLogs();
      setLogs([]);
    }
  };

  const handleCopyLogs = () => {
    const json = PrintDiagnosticsService.exportLogsAsJSON();
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Metrics calculation
  const totalJobs = logs.length;
  const successJobs = logs.filter((l) => l.status === 'SUCCESS').length;
  const restrictedJobs = logs.filter((l) => l.status === 'RESTRICTED').length;
  const failedJobs = logs.filter((l) => l.status === 'FAILURE').length;
  const successRate = totalJobs > 0 ? Math.round((successJobs / totalJobs) * 100) : 100;
  const avgDuration = totalJobs > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / totalJobs) : 0;

  const filteredLogs = logs.filter((l) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'SUCCESS') return l.status === 'SUCCESS';
    if (filterType === 'ISSUES') return l.status === 'FAILURE' || l.status === 'RESTRICTED';
    if (filterType === 'BILL') return l.jobType === 'BILL' || l.jobType === 'REPRINT';
    if (filterType === 'KOT') return l.jobType === 'KOT';
    return true;
  });

  return (
    <div id="print-diagnostics-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-base">Print Job Diagnostics & Telemetry</h3>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold rounded-full">
                LIVE LOGS
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Tracks print job execution timestamps, sandbox restrictions, and hardware state to console and Firestore.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="btn-diagnostic-test-print"
            onClick={handleTestPrint}
            disabled={testing}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{testing ? 'Printing...' : 'Trigger Test Print'}</span>
          </button>

          <button
            type="button"
            id="btn-card-raw-escpos-test"
            onClick={() => setShowRawEscPosModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Send raw ESC/POS command buffer to test handshake & character sets (bypasses browser dialog)"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Raw ESC/POS</span>
          </button>

          <button
            type="button"
            id="btn-copy-diagnostic-logs"
            onClick={handleCopyLogs}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Copy Diagnostic Logs as JSON"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copied ? 'Copied' : 'JSON'}</span>
          </button>

          <button
            type="button"
            id="btn-clear-diagnostic-logs"
            onClick={handleClearLogs}
            className="p-2 bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs font-semibold rounded-xl border border-slate-700/80 transition-colors cursor-pointer"
            title="Clear local logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Print Jobs</span>
          <span className="text-xl font-extrabold text-white mt-1 font-mono">{totalJobs}</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Recorded in session</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Success Rate</span>
          <span className={`text-xl font-extrabold mt-1 font-mono ${successRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {successRate}%
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5">{successJobs} succeeded</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Issues / Sandboxed</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xl font-extrabold font-mono ${restrictedJobs + failedJobs > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
              {restrictedJobs + failedJobs}
            </span>
            {restrictedJobs > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                {restrictedJobs} blocked
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5">Sandbox or print errors</span>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Avg Print Latency</span>
          <span className="text-xl font-extrabold text-sky-400 mt-1 font-mono">{avgDuration} ms</span>
          <span className="text-[10px] text-slate-500 mt-0.5">Dispatch to browser engine</span>
        </div>
      </div>

      {/* Hardware / Sandbox Notice Banner */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-200">Hardware & Sandbox Status: </span>
            {isMockMode ? (
              <span className="text-amber-300">Mock Mode Active (Physical print dialog bypassed).</span>
            ) : (
              <span className="text-slate-400">Direct print pipeline active (80mm/58mm thermal output).</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">Mock Mode:</span>
          <button
            type="button"
            id="toggle-mock-print-mode"
            onClick={() => handleToggleMock(!isMockMode)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer ${
              isMockMode 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {isMockMode ? 'MOCK ENABLED' : 'PHYSICAL HARDWARE'}
          </button>
        </div>
      </div>

      {/* Logs Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Jobs' },
            { id: 'SUCCESS', label: 'Success' },
            { id: 'ISSUES', label: 'Issues & Warnings' },
            { id: 'BILL', label: 'Bills' },
            { id: 'KOT', label: 'KOTs' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500 font-mono">
          Showing {filteredLogs.length} of {logs.length}
        </span>
      </div>

      {/* Logs Table / List */}
      <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <Printer className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">No print job diagnostic logs matching filter.</p>
            <p className="text-[11px] text-slate-600 mt-1">
              Click &quot;Trigger Test Print&quot; or complete a bill settlement to see live telemetry.
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            const dateObj = new Date(log.createdAt || log.timestamp);
            const timeStr = dateObj.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            });
            const dateStr = dateObj.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short'
            });

            return (
              <div
                key={log.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Left info */}
                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    {log.status === 'SUCCESS' && (
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                    {log.status === 'RESTRICTED' && (
                      <div className="p-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    )}
                    {log.status === 'FAILURE' && (
                      <div className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}

                    {/* Job Details */}
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-xs">
                          {log.referenceNumber}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                          log.jobType === 'BILL' || log.jobType === 'REPRINT' 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : log.jobType === 'KOT'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.jobType}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {log.paperWidth} ({log.method})
                        </span>
                        {log.isMockMode && (
                          <span className="px-1 py-0.2 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded">
                            MOCK
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {dateStr} {timeStr}
                        </span>
                        <span>•</span>
                        <span>{log.durationMs}ms</span>
                        {log.totalAmount !== undefined && log.totalAmount > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-slate-300">₹{log.totalAmount}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right actions & status */}
                  <div className="flex items-center justify-between sm:justify-end gap-2.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      log.status === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : log.status === 'RESTRICTED'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {log.status === 'RESTRICTED' ? 'SANDBOX BLOCKED' : log.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Inspect Details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono bg-slate-900/60 p-3 rounded-lg space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                      <div><span className="text-slate-500">Job ID:</span> {log.id}</div>
                      <div><span className="text-slate-500">Timestamp:</span> {log.timestamp}</div>
                      <div><span className="text-slate-500">Font Size:</span> {log.fontSize || 12}px</div>
                      <div><span className="text-slate-500">Items Count:</span> {log.itemCount}</div>
                      <div><span className="text-slate-500">Inside Iframe:</span> {String(log.isIframe)}</div>
                      <div><span className="text-slate-500">Staff User:</span> {log.userName || log.userId || 'staff'}</div>
                    </div>

                    {log.errorMessage && (
                      <div className="mt-2 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 text-[11px]">
                        <strong>Diagnostic Error:</strong> {log.errorMessage}
                      </div>
                    )}

                    {log.status === 'RESTRICTED' && (
                      <div className="mt-2 p-2.5 bg-amber-950/40 border border-amber-800/60 rounded text-amber-300 text-[11px]">
                        <strong>Sandbox Notice:</strong> Browser security policy restricted direct <code>window.print()</code> inside an iframe. The system automatically provided the on-screen fallback preview.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Raw ESC/POS Diagnostic Modal */}
      <RawEscPosTestModal
        isOpen={showRawEscPosModal}
        onClose={() => setShowRawEscPosModal(false)}
        settings={settings}
      />
    </div>
  );
};
