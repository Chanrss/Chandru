import React, { useEffect } from 'react';
import { ShieldCheck, Download, X, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { DailyBackupRecord } from '../../types';
import { triggerBlobDownload, getLatestGeneratedBackup } from '../../services/backupService';

interface DailyBackupNotificationToastProps {
  toast: {
    visible: boolean;
    record?: DailyBackupRecord;
    message: string;
    filename?: string;
    type: 'success' | 'error' | 'info';
  } | null;
  onDismiss: () => void;
  onNavigateSettings?: () => void;
}

export const DailyBackupNotificationToast: React.FC<DailyBackupNotificationToastProps> = ({
  toast,
  onDismiss,
  onNavigateSettings
}) => {
  useEffect(() => {
    if (!toast || !toast.visible) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 12000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast || !toast.visible) return null;

  const handleDownload = () => {
    const cached = getLatestGeneratedBackup();
    if (cached) {
      triggerBlobDownload(cached.filename, cached.jsonContent);
    } else if (toast.filename) {
      // If filename is present, attempt download
      triggerBlobDownload(toast.filename, JSON.stringify({ message: 'Backup file' }));
    }
  };

  const isSuccess = toast.type === 'success';

  return (
    <div
      id="daily-backup-notification-toast"
      className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-50 max-w-md w-[calc(100vw-2rem)] sm:w-auto bg-slate-900 border border-emerald-500/40 text-slate-100 rounded-2xl shadow-2xl p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 ${isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
          {isSuccess ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {toast.record?.triggerType === 'AUTOMATED' ? 'Automated Daily Backup' : 'Billing Archive Exported'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
              {toast.record?.businessDate || 'JSON'}
            </span>
          </div>

          <p className="text-xs text-slate-200 mt-1 font-medium leading-relaxed">
            {toast.message}
          </p>

          {toast.record && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 py-1.5 px-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] font-mono text-slate-300">
              <div>
                <span className="text-slate-400 text-[10px] block">Bills</span>
                <strong className="text-emerald-400">{toast.record.billCount}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Revenue</span>
                <strong className="text-amber-300">₹{toast.record.totalRevenue.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Records</span>
                <strong className="text-blue-300">{toast.record.totalDocuments}</strong>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Save or Re-download this JSON file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON File</span>
            </button>

            {onNavigateSettings && (
              <button
                type="button"
                onClick={() => {
                  onNavigateSettings();
                  onDismiss();
                }}
                className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                View in Settings
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
