import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  itemName: string;
  itemSubtitle?: string;
  description?: string;
  warningNote?: string;
  confirmButtonText?: string;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemName,
  itemSubtitle,
  description,
  warningNote,
  confirmButtonText = 'Delete Permanently',
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in zoom-in-95"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-start gap-3.5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 id="delete-dialog-title" className="text-base sm:text-lg font-black text-slate-900 leading-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Please confirm this deletion action.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3 text-left">
          {/* Target Item Highlight Box */}
          <div className="bg-red-50/70 border border-red-200/80 rounded-xl p-3 flex flex-col gap-0.5">
            <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Target to delete:</span>
            <span className="font-extrabold text-sm sm:text-base text-slate-900 truncate">
              {itemName}
            </span>
            {itemSubtitle && (
              <span className="text-xs font-mono text-slate-600">
                {itemSubtitle}
              </span>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
          )}

          {/* Warning note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11.5px] text-amber-900 font-medium flex items-start gap-2">
            <span className="font-black text-amber-700 shrink-0">⚠️</span>
            <span>{warningNote || 'This action cannot be undone. All related records will be updated accordingly.'}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-200/80 border border-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm shadow-red-500/20 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
