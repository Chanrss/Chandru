import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  ChefHat, 
  FileText, 
  CheckCircle2, 
  UtensilsCrossed, 
  Layers, 
  UserCheck,
  Calendar,
  Clock
} from 'lucide-react';
import { Kot, KotItem, RestaurantSettings } from '../../types';
import { PrinterService } from '../../services/printerService';

interface KotSummarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKots: { kot: Kot; items: KotItem[] }[];
  settings?: RestaurantSettings;
  managerName?: string;
  onPrinted?: () => void;
}

export const KotSummarySlipModal: React.FC<KotSummarySlipModalProps> = ({
  isOpen,
  onClose,
  selectedKots,
  settings,
  managerName = 'Manager',
  onPrinted
}) => {
  const [printing, setPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  if (!isOpen || selectedKots.length === 0) return null;

  // Aggregate items across all selected KOTs
  const itemMap = new Map<string, { itemName: string; itemNameTamil?: string; quantity: number }>();
  selectedKots.forEach(({ kot, items }) => {
    const effectiveItems = (items && items.length > 0) ? items : (kot.items || []);
    effectiveItems.forEach((itm) => {
      const key = itm.itemName.trim().toLowerCase();
      if (!itemMap.has(key)) {
        itemMap.set(key, { itemName: itm.itemName, itemNameTamil: itm.itemNameTamil, quantity: 0 });
      }
      itemMap.get(key)!.quantity += itm.quantity;
    });
  });

  const consolidatedItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);
  const totalPortions = consolidatedItems.reduce((acc, i) => acc + i.quantity, 0);

  const tablesList = Array.from(
    new Set(selectedKots.map(({ kot }) => kot.tableNumber || (kot.orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In')))
  ).join(', ');

  const handlePrint = () => {
    setPrinting(true);
    try {
      const result = PrinterService.printKotSummarySlip(selectedKots, settings, managerName);
      if (result.success) {
        setPrintSuccess(true);
        if (onPrinted) onPrinted();
        setTimeout(() => {
          setPrintSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to print KOT summary slip:', err);
    } finally {
      setPrinting(false);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB');
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-slip-title"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 id="summary-slip-title" className="font-black text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>Completed KOTs Summary Slip</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Manager Print
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Consolidated kitchen production summary for {selectedKots.length} selected completed tickets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close summary slip preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Metrics Bar + Thermal Receipt Preview */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" /> Tickets
              </div>
              <div className="text-lg font-black text-amber-400 font-mono mt-0.5">
                {selectedKots.length} KOTs
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3 text-emerald-400" /> Total Items
              </div>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                {totalPortions} Portions
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="w-3 h-3 text-blue-400" /> Unique Dishes
              </div>
              <div className="text-lg font-black text-blue-400 font-mono mt-0.5">
                {consolidatedItems.length} Dishes
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-2.5 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-purple-400" /> Manager
              </div>
              <div className="text-sm font-bold text-slate-200 truncate mt-1">
                {managerName}
              </div>
            </div>
          </div>

          {/* Thermal Slip Visual Preview (Monospace / Realistic Receipt Paper styling) */}
          <div className="bg-slate-950 border-2 border-dashed border-slate-700 rounded-xl p-4 font-mono text-slate-200 text-xs shadow-inner max-w-md mx-auto">
            
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-700 space-y-1">
              <div className="font-black text-sm uppercase text-slate-100">
                {settings?.restaurantName || 'SRI SARAVANA BHAVAN'}
              </div>
              <div className="border border-slate-700 inline-block px-3 py-1 font-bold text-amber-300 text-xs my-1 bg-slate-900">
                COMPLETED KOTS SUMMARY SLIP
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>Date: {dateStr} {timeStr}</span>
                <span>Manager: {managerName}</span>
              </div>
              <div className="text-left text-[11px] text-slate-300 pt-1">
                <span className="text-slate-400">Tables: </span>
                <span className="font-bold text-amber-400">{tablesList || 'N/A'}</span>
              </div>
              <div className="text-left text-[11px] text-slate-300 truncate">
                <span className="text-slate-400">Tickets: </span>
                <span className="font-bold text-slate-200">
                  {selectedKots.map(k => k.kot.kotNumber).join(', ')}
                </span>
              </div>
            </div>

            {/* Consolidated Dish Quantities Table */}
            <div className="py-2.5 space-y-1.5 border-b border-dashed border-slate-700">
              <div className="flex justify-between text-[11px] text-slate-400 uppercase font-bold pb-1 border-b border-slate-800">
                <span>CONSOLIDATED DISH</span>
                <span>QTY</span>
              </div>
              {consolidatedItems.map((itm, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                  <span className="font-bold text-slate-100 truncate pr-2">
                    {idx + 1}. {itm.itemName}
                  </span>
                  <span className="font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                    ×{itm.quantity}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-black text-xs text-emerald-400 border-t border-slate-800">
                <span>TOTAL DISH PORTIONS:</span>
                <span className="text-sm font-mono">{totalPortions}</span>
              </div>
            </div>

            {/* Ticket Breakdown List */}
            <div className="py-2.5 space-y-1 border-b border-dashed border-slate-700 text-[11px]">
              <div className="text-slate-400 font-bold uppercase pb-1 text-[10px]">
                Included Tickets Breakdown ({selectedKots.length}):
              </div>
              {selectedKots.map(({ kot, items }) => {
                const count = (items || kot.items || []).reduce((acc, i) => acc + i.quantity, 0);
                const time = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={kot.id} className="flex justify-between text-slate-300 py-0.5">
                    <span className="font-bold text-amber-400">
                      {kot.kotNumber} ({kot.tableNumber || 'Take Away'})
                    </span>
                    <span className="text-slate-500 font-sans text-[10px]">{time}</span>
                    <span className="text-slate-200 font-bold">{count} items</span>
                  </div>
                );
              })}
            </div>

            {/* Footer Signatures */}
            <div className="pt-3 text-center space-y-2 text-[10px] text-slate-400">
              <div className="font-bold text-slate-300">
                *** ALL {selectedKots.length} KOTS COMPLETED & VERIFIED ***
              </div>
              <div className="text-[9px] text-slate-500">
                Printed for Kitchen Dispatch & Shift Audit Copy
              </div>
              <div className="flex justify-between pt-3 font-sans text-slate-400">
                <span>Manager Sign: _________</span>
                <span>Chef Sign: _________</span>
              </div>
            </div>

          </div>

          {printSuccess && (
            <div className="bg-emerald-950 border border-emerald-500/50 p-2.5 rounded-xl text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Summary slip printed successfully!</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-950 border-t border-slate-800 gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>{printing ? 'Sending to Printer...' : `Print Summary Slip (${selectedKots.length} KOTs)`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
