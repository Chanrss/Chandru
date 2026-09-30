import React, { useState, useEffect } from 'react';
import { AlertTriangle, Boxes, ArrowRight, X, Clock, CheckCircle } from 'lucide-react';
import { InventoryItem } from '../../types';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface DailyLowStockAlertModalProps {
  isOpen: boolean;
  lowStockItems: InventoryItem[];
  onClose: () => void;
  onViewInventory: () => void;
}

export const DailyLowStockAlertModal: React.FC<DailyLowStockAlertModalProps> = ({
  isOpen,
  lowStockItems,
  onClose,
  onViewInventory
}) => {
  if (!isOpen || lowStockItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white border-2 border-amber-400 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Urgent Header */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
              <AlertTriangle className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight uppercase leading-tight">
                LOW STOCK ALERT
              </h3>
              <p className="text-xs text-amber-100 flex items-center gap-1.5 font-medium mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Daily 8:00 AM Stock Status Check</span>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4">
          <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed font-semibold">
            The following count-based items have reached or dropped below their Minimum Stock limit. 
            <span className="block font-bold text-amber-950 mt-1">Please purchase these items.</span>
          </div>

          {/* Low Stock Items List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50">
            {lowStockItems.map((item) => {
              const remaining = item.remainingCount !== undefined ? item.remainingCount : item.currentStock;
              const isZero = remaining <= 0;
              return (
                <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                        {item.itemName}
                      </span>
                      {item.category && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Code: #{item.itemCode || 'ITEM'} &bull; Min: {item.minimumStock || 5} {item.unit || 'units'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-flex items-center gap-1 font-mono font-black text-sm px-2.5 py-1 rounded-lg ${
                      isZero 
                        ? 'bg-red-100 text-red-700 border border-red-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      <span>Remaining: {remaining}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 text-center italic">
            This alert appears once per day at 8:00 AM to help kitchen and counter managers replenish stocks on time.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
          >
            Dismiss for Today
          </button>

          <button
            type="button"
            onClick={onViewInventory}
            className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 flex items-center gap-2 shadow-md cursor-pointer transition-all uppercase tracking-wider"
          >
            <Boxes className="w-4 h-4" />
            <span>VIEW INVENTORY</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

const LOW_STOCK_ALERT_STORAGE_KEY = 'pos_daily_low_stock_alert_date';

/**
 * Hook to automate 8:00 AM daily check and display ONE popup per day
 */
export function useDailyLowStockAlert(onNavigateInventory: () => void) {
  const [modalOpen, setModalOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    // 1. Load inventory from Firestore or local cache
    const checkLowStock = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const todayDateStr = now.toISOString().split('T')[0];

      // Only trigger if hour is 8 or later
      if (currentHour < 8) {
        return;
      }

      // Check if already shown today
      const lastAlertDate = localStorage.getItem(LOW_STOCK_ALERT_STORAGE_KEY);
      if (lastAlertDate === todayDateStr) {
        return;
      }

      // Read local inventory items
      let items: InventoryItem[] = [];
      try {
        const raw = localStorage.getItem('pos_local_inventory');
        if (raw) items = JSON.parse(raw);
      } catch (e) {}

      // Filter initialized count-based items with low or depleted stock
      const lowItems = items.filter((item) => {
        if (!item.isInitialized && !item.isCountBased) return false;
        const remaining = item.remainingCount !== undefined ? item.remainingCount : item.currentStock;
        const minStock = item.minimumStock !== undefined ? item.minimumStock : 5;
        return remaining <= minStock;
      });

      if (lowItems.length > 0) {
        setLowStockItems(lowItems);
        setModalOpen(true);
      }
    };

    // Check on initial load
    checkLowStock();

    // Check periodically every 60 seconds
    const interval = setInterval(checkLowStock, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    const todayDateStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(LOW_STOCK_ALERT_STORAGE_KEY, todayDateStr);
    setModalOpen(false);
  };

  const handleViewInventory = () => {
    const todayDateStr = new Date().toISOString().split('T')[0];
    localStorage.setItem(LOW_STOCK_ALERT_STORAGE_KEY, todayDateStr);
    setModalOpen(false);
    onNavigateInventory();
  };

  const triggerTestAlert = () => {
    let items: InventoryItem[] = [];
    try {
      const raw = localStorage.getItem('pos_local_inventory');
      if (raw) items = JSON.parse(raw);
    } catch (e) {}

    const lowItems = items.filter((item) => {
      const remaining = item.remainingCount !== undefined ? item.remainingCount : item.currentStock;
      const minStock = item.minimumStock !== undefined ? item.minimumStock : 5;
      return remaining <= minStock;
    });

    if (lowItems.length > 0) {
      setLowStockItems(lowItems);
      setModalOpen(true);
    } else {
      alert('All count-based items currently have healthy stock above their minimum threshold!');
    }
  };

  return {
    modalOpen,
    lowStockItems,
    handleDismiss,
    handleViewInventory,
    triggerTestAlert
  };
}
