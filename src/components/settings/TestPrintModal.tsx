import React, { useState } from 'react';
import { Printer, X, CheckCircle2, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import { RestaurantSettings } from '../../types';
import { PrinterService } from '../../services/printerService';

interface TestPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: RestaurantSettings;
  onPrintSuccess?: () => void;
}

export const TestPrintModal: React.FC<TestPrintModalProps> = ({
  isOpen,
  onClose,
  settings,
  onPrintSuccess
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<{
    success: boolean;
    restrictedInIframe?: boolean;
    message: string;
  } | null>(null);

  if (!isOpen) return null;

  const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
  const isCompact = Boolean(settings?.compactMode);
  const configuredFontSize = settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12);
  const baseFontSize = isCompact ? Math.max(9, Math.round(configuredFontSize * 0.85 * 10) / 10) : configuredFontSize;
  const now = new Date();
  const timestampStr = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
  const restaurantName = settings?.restaurantName || 'SRI SARAVANA BHAVAN';
  const ruler = is58mm ? '|...10...20...30..|' : '|....10....20....30....40....|';

  const handlePrint = () => {
    setIsPrinting(true);
    setPrintStatus(null);

    try {
      const result = PrinterService.printDiagnosticTestPage(settings, true);
      if (result.success && !result.restrictedInIframe) {
        setPrintStatus({
          success: true,
          message: 'Test print sent successfully to thermal printer!'
        });
        if (onPrintSuccess) onPrintSuccess();
      } else if (result.restrictedInIframe) {
        setPrintStatus({
          success: false,
          restrictedInIframe: true,
          message: 'Browser sandbox restricted direct background printing. You can print directly using system print dialog or in a standalone window.'
        });
      } else {
        setPrintStatus({
          success: false,
          message: result.error || 'Failed to dispatch test print to printer.'
        });
      }
    } catch (err: any) {
      setPrintStatus({
        success: false,
        message: err?.message || 'Error occurred while printing test page.'
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div 
      id="test-print-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="test-print-modal-container"
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-tight">
                Thermal Printer Test Page
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {is58mm ? '58mm (2-Inch)' : '80mm (3-Inch)'} • Font {baseFontSize}px {isCompact ? '• Compact' : ''}
              </p>
            </div>
          </div>
          <button
            id="close-test-print-modal-button"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Thermal Slip Simulation */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/60 flex flex-col items-center justify-center">
          {printStatus && (
            <div className={`w-full max-w-xs mb-3.5 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
              printStatus.success 
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : printStatus.restrictedInIframe
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}>
              {printStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                {printStatus.message}
              </div>
            </div>
          )}

          {/* Virtual Thermal Paper Render */}
          <div 
            id="thermal-test-slip-preview"
            style={{
              width: is58mm ? '220px' : '280px',
              fontSize: `${baseFontSize}px`,
              lineHeight: isCompact ? '1.15' : '1.3'
            }}
            className="bg-white text-black p-3.5 shadow-xl border border-slate-300 font-mono text-center select-text rounded-xs"
          >
            <div className="border-t-2 border-black my-1"></div>
            <div className="font-extrabold uppercase text-[1.2em] tracking-wide">
              PRINTER DIAGNOSTIC
            </div>
            <div className="font-bold text-[0.9em]">
              STANDARDIZED TEST PAGE
            </div>
            <div className="font-bold text-[0.85em] mt-0.5">
              {restaurantName}
            </div>
            <div className="border-t border-dashed border-black my-1.5"></div>

            <div className="space-y-0.5 text-left text-[0.9em]">
              <div className="flex justify-between">
                <span>Connection:</span>
                <span className="font-bold text-emerald-700">ONLINE / CONNECTED</span>
              </div>
              <div className="flex justify-between">
                <span>Paper Feed:</span>
                <span className="font-bold text-emerald-700">PASSED / 20MM FEED</span>
              </div>
              <div className="flex justify-between">
                <span>Paper Width:</span>
                <span>{is58mm ? '58mm (2-Inch)' : '80mm (3-Inch)'}</span>
              </div>
              <div className="flex justify-between">
                <span>Interface:</span>
                <span>USB / SYSTEM SPOOLER</span>
              </div>
              <div className="flex justify-between">
                <span>Base Font:</span>
                <span>{baseFontSize}px</span>
              </div>
              <div className="flex justify-between">
                <span>Mode:</span>
                <span>{isCompact ? 'COMPACT (ECO)' : 'STANDARD'}</span>
              </div>
              <div className="flex justify-between text-[0.85em]">
                <span>Time:</span>
                <span>{timestampStr}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-black my-1.5"></div>

            <div className="text-left text-[0.85em] space-y-1">
              <div className="font-bold">STANDARDIZED DIAGNOSTIC STRING:</div>
              <div className="text-[0.75em] font-mono break-all border border-slate-300 p-1 bg-slate-50 text-left">
                [ASCII 32-126]: ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 abcdefghijklmnopqrstuvwxyz !@#$%^&*()_+-=[]&#123;&#125;|;:,.&lt;&gt;?
              </div>
              <div className="text-[0.8em] font-mono tracking-tighter border-y border-dotted border-black py-0.5 text-center">
                {ruler}
              </div>
              <div className="text-left">|&lt;- [LEFT EDGE 0mm]</div>
              <div className="text-center">|-- [CENTER 50%] --|</div>
              <div className="text-right">[RIGHT EDGE] -&gt;|</div>
            </div>

            {/* Thermal head heating density bar */}
            <div className="bg-black text-white font-extrabold py-1 my-2 text-[0.8em] tracking-wider">
              ██ THERMAL HEAD DENSITY ██
            </div>

            <div className="text-left text-[0.78em] space-y-0.5">
              <div>• Normal: The quick brown fox jumps</div>
              <div className="font-bold">• Bold: 1234567890 - வாழ்க</div>
            </div>

            <div className="border-t border-dashed border-black my-1.5"></div>
            <div className="text-[0.75em] text-slate-600 tracking-wider">
              - - - - TEAR / CUT HERE - - - -
            </div>
            <div className="font-bold text-[0.9em] mt-1">
              *** CONNECTION &amp; FEED VERIFIED ***
            </div>
            <div className="text-[0.72em] text-slate-500 mt-0.5">
              Generated by POS Diagnostics Engine
            </div>
            <div className="border-t-2 border-black my-1"></div>
            {/* Feed margin simulation */}
            <div className="h-6 w-full flex items-center justify-center text-[10px] text-slate-400 border border-dashed border-slate-200 mt-1">
              [ 20mm Feed Margin Verified ]
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-800 bg-slate-900">
          <button
            id="test-print-modal-close-action"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          
          <button
            id="test-print-modal-trigger-action"
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="px-5 py-2 text-xs font-extrabold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isPrinting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Printing...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Print Test Page</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
