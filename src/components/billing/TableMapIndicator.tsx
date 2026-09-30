import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  Clock, 
  Users, 
  Utensils, 
  Receipt, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Search,
  ChevronDown
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getLocalKots } from '../../services/localKotStore';
import { Kot, KotItem, OrderType, PriceType } from '../../types';

export interface OccupiedTableInfo {
  tableNumber: string;
  kot: Kot;
  items: KotItem[];
  itemCount: number;
  totalAmount: number;
  seatedTime: number;
  elapsedMinutes: number;
  waiterName: string;
  itemsSummary: string;
}

// Standard restaurant tables organized by section
export const DEFAULT_TABLE_SECTIONS = [
  {
    id: 'NON_AC',
    name: 'Non-AC Hall (Ground)',
    tables: ['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8'],
    priceType: 'NON_AC' as PriceType
  },
  {
    id: 'AC',
    name: 'AC Family Hall (1st Floor)',
    tables: ['A-1', 'A-2', 'A-3', 'A-4', 'T-9', 'T-10', 'T-11', 'T-12'],
    priceType: 'AC' as PriceType
  }
];

export const ALL_DEFAULT_TABLES = [
  'T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8',
  'A-1', 'A-2', 'A-3', 'A-4', 'T-9', 'T-10', 'T-11', 'T-12'
];

interface TableMapIndicatorProps {
  selectedTable: string;
  orderType: OrderType;
  priceType: PriceType;
  onSelectTable: (tableNumber: string, recommendedPriceType?: PriceType) => void;
  onLoadKotItems?: (kot: Kot, items: KotItem[]) => void;
  onSwitchOrderType?: (orderType: OrderType) => void;
}

export const TableMapIndicator: React.FC<TableMapIndicatorProps> = ({
  selectedTable,
  orderType,
  priceType,
  onSelectTable,
  onLoadKotItems,
  onSwitchOrderType
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'ALL' | 'NON_AC' | 'AC'>('ALL');
  const [selectedTableDetails, setSelectedTableDetails] = useState<OccupiedTableInfo | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [kotsData, setKotsData] = useState<{ kot: Kot; items: KotItem[] }[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every 30 seconds for accurate elapsed minutes
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // 1. Listen to local and remote active KOTs
  useEffect(() => {
    const loadLocal = () => {
      try {
        const stored = getLocalKots();
        const active = stored.filter(
          (k) => k.kot.status !== 'BILLED' && k.kot.status !== 'CANCELLED' && k.kot.tableNumber && k.kot.tableNumber !== 'Take Away'
        );
        setKotsData(active);
      } catch (e) {
        console.warn('Error reading local KOTs in TableMap:', e);
      }
    };

    loadLocal();

    const handleLocalUpdate = () => {
      loadLocal();
    };

    window.addEventListener('pos_kots_updated', handleLocalUpdate);

    // Also sync with Firestore in background if online
    let unsubscribeFirestore: (() => void) | undefined;
    try {
      const q = query(collection(db, 'kots'));
      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const remoteKots: Kot[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Kot;
            if (data.status !== 'BILLED' && data.status !== 'CANCELLED' && data.tableNumber && data.tableNumber !== 'Take Away') {
              remoteKots.push({ ...data, id: docSnap.id });
            }
          });

          // Merge local and remote
          const localStored = getLocalKots();
          const combinedMap = new Map<string, { kot: Kot; items: KotItem[] }>();

          localStored.forEach((entry) => {
            if (entry.kot.status !== 'BILLED' && entry.kot.status !== 'CANCELLED' && entry.kot.tableNumber && entry.kot.tableNumber !== 'Take Away') {
              combinedMap.set(entry.kot.id, entry);
            }
          });

          remoteKots.forEach((rKot) => {
            if (!combinedMap.has(rKot.id)) {
              combinedMap.set(rKot.id, { kot: rKot, items: rKot.items || [] });
            } else {
              // Update status if remote changed
              const existing = combinedMap.get(rKot.id)!;
              combinedMap.set(rKot.id, { ...existing, kot: rKot });
            }
          });

          setKotsData(Array.from(combinedMap.values()));
        },
        (err) => {
          console.warn('Firestore KOT snapshot notice:', err);
        }
      );
    } catch (err) {
      console.warn('Firestore KOT listener setup notice:', err);
    }

    return () => {
      window.removeEventListener('pos_kots_updated', handleLocalUpdate);
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  }, []);

  // 2. Compute Occupied Tables Map
  const occupiedTablesMap = useMemo(() => {
    const map = new Map<string, OccupiedTableInfo>();

    kotsData.forEach(({ kot, items }) => {
      const tbl = (kot.tableNumber || '').trim();
      if (!tbl || tbl === 'Take Away') return;

      const seatedTime = kot.createdAt || Date.now();
      const elapsedMinutes = Math.max(0, Math.floor((currentTime - seatedTime) / (1000 * 60)));
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 1)), 0);
      const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity || 1)), 0);
      const itemsSummary = items.slice(0, 3).map(i => `${i.quantity}× ${i.itemName}`).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '');

      const existing = map.get(tbl);
      // Keep earlier seated time if multiple KOTs on same table
      if (!existing || seatedTime < existing.seatedTime) {
        map.set(tbl, {
          tableNumber: tbl,
          kot,
          items,
          itemCount: (existing?.itemCount || 0) + itemCount,
          totalAmount: (existing?.totalAmount || 0) + totalAmount,
          seatedTime,
          elapsedMinutes,
          waiterName: kot.waiterName || 'Staff',
          itemsSummary
        });
      }
    });

    return map;
  }, [kotsData, currentTime]);

  // All known tables (default + any dynamically created tables with active KOTs)
  const allTables = useMemo(() => {
    const list = [...ALL_DEFAULT_TABLES];
    occupiedTablesMap.forEach((_, tbl) => {
      if (!list.includes(tbl)) {
        list.push(tbl);
      }
    });
    return list;
  }, [occupiedTablesMap]);

  // Statistics
  const totalTablesCount = allTables.length;
  const occupiedCount = occupiedTablesMap.size;
  const availableCount = Math.max(0, totalTablesCount - occupiedCount);
  const occupancyPercentage = Math.round((occupiedCount / Math.max(1, totalTablesCount)) * 100);

  // Filtered tables for Modal
  const displayTables = useMemo(() => {
    let tables = allTables;
    if (activeSection === 'NON_AC') {
      tables = allTables.filter(t => t.startsWith('T-') && parseInt(t.replace('T-', ''), 10) <= 8);
    } else if (activeSection === 'AC') {
      tables = allTables.filter(t => t.startsWith('A-') || (t.startsWith('T-') && parseInt(t.replace('T-', ''), 10) > 8));
    }

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      tables = tables.filter(t => {
        if (t.toLowerCase().includes(q)) return true;
        const occ = occupiedTablesMap.get(t);
        if (occ && (occ.itemsSummary.toLowerCase().includes(q) || occ.waiterName.toLowerCase().includes(q))) {
          return true;
        }
        return false;
      });
    }

    return tables;
  }, [allTables, activeSection, searchFilter, occupiedTablesMap]);

  // Handle click on a table
  const handleTableClick = (tableNo: string) => {
    const occ = occupiedTablesMap.get(tableNo);
    const isAcTable = tableNo.startsWith('A-') || (tableNo.startsWith('T-') && parseInt(tableNo.replace('T-', ''), 10) > 8);
    const recommendedPrice: PriceType = isAcTable ? 'AC' : 'NON_AC';

    if (occ) {
      // Occupied table clicked: show details or offer to load
      setSelectedTableDetails(occ);
    } else {
      // Vacant table: select immediately
      if (orderType !== 'DINE_IN' && onSwitchOrderType) {
        onSwitchOrderType('DINE_IN');
      }
      onSelectTable(tableNo, recommendedPrice);
      setIsModalOpen(false);
      setSelectedTableDetails(null);
    }
  };

  const handleConfirmLoadKot = (occ: OccupiedTableInfo) => {
    if (orderType !== 'DINE_IN' && onSwitchOrderType) {
      onSwitchOrderType('DINE_IN');
    }
    const isAcTable = occ.tableNumber.startsWith('A-') || (occ.tableNumber.startsWith('T-') && parseInt(occ.tableNumber.replace('T-', ''), 10) > 8);
    onSelectTable(occ.tableNumber, isAcTable ? 'AC' : 'NON_AC');

    if (onLoadKotItems) {
      onLoadKotItems(occ.kot, occ.items);
    }

    setSelectedTableDetails(null);
    setIsModalOpen(false);
  };

  const handleSelectOccupiedWithoutLoading = (occ: OccupiedTableInfo) => {
    if (orderType !== 'DINE_IN' && onSwitchOrderType) {
      onSwitchOrderType('DINE_IN');
    }
    const isAcTable = occ.tableNumber.startsWith('A-') || (occ.tableNumber.startsWith('T-') && parseInt(occ.tableNumber.replace('T-', ''), 10) > 8);
    onSelectTable(occ.tableNumber, isAcTable ? 'AC' : 'NON_AC');
    setSelectedTableDetails(null);
    setIsModalOpen(false);
  };

  return (
    <div className="w-full">
      {/* 1. COMPACT TOP STATUS INDICATOR BAR */}
      <div 
        style={{ minHeight: '35px' }} 
        className="flex flex-wrap items-center justify-between gap-2 py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs mb-2"
      >
        <div className="flex items-center gap-2">
          {/* Main Visual Indicator Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 text-slate-800 font-bold transition-all shadow-2xs cursor-pointer group"
            title="Open Visual Table Map & Seating Manager"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span>Table Map</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          </button>

          {/* Seating Stats Pill */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-300/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{availableCount} Available</span>
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold border ${
              occupiedCount > 0 
                ? 'bg-rose-100 text-rose-800 border-rose-300' 
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${occupiedCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{occupiedCount} Occupied</span>
            </span>
          </div>
        </div>

        {/* Selected Table Indicator / Shortcut */}
        <div className="flex items-center gap-2">
          {orderType === 'DINE_IN' && (
            <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200 px-2 py-0.5 rounded-md text-[11px] font-bold text-blue-900">
              <Utensils className="w-3 h-3 text-blue-600" />
              <span>Selected:</span>
              <span className="font-mono bg-blue-600 text-white px-1.5 py-0.2 rounded font-extrabold text-xs">
                {selectedTable || 'None'}
              </span>
              {selectedTable && occupiedTablesMap.has(selectedTable) && (
                <span className="px-1 py-0.2 bg-rose-500 text-white rounded text-[10px] font-mono font-bold animate-pulse">
                  Occupied
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-blue-600 hover:text-blue-800 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer underline decoration-blue-300 underline-offset-2"
          >
            <span>View Floor Map</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. DINE-IN QUICK HORIZONTAL TABLE STRIP */}
      {orderType === 'DINE_IN' && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin scrollbar-thumb-slate-300">
            <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 px-1 font-mono">
              Quick Tables:
            </span>
            {allTables.map((tbl) => {
              const occ = occupiedTablesMap.get(tbl);
              const isSelected = selectedTable === tbl;
              const isOccupied = !!occ;

              return (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => handleTableClick(tbl)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-1.5 border cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-400/40'
                      : isOccupied
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                  }`}
                  title={
                    isOccupied 
                      ? `${tbl}: Occupied (${occ.elapsedMinutes}m, KOT #${occ.kot.kotNumber}, ${occ.itemCount} items)` 
                      : `${tbl}: Available / Vacant`
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isSelected 
                        ? 'bg-white' 
                        : isOccupied 
                          ? 'bg-rose-500 animate-pulse' 
                          : 'bg-emerald-500'
                    }`}
                  />
                  <span>{tbl}</span>
                  {isOccupied && !isSelected && (
                    <span className="text-[10px] opacity-80 font-normal">
                      {occ.elapsedMinutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. OCCUPIED TABLE ACTION POPUP */}
      <AnimatePresence>
        {selectedTableDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSelectedTableDetails(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 p-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-mono font-black text-lg">
                    {selectedTableDetails.tableNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base">Table Currently Occupied</h3>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold tracking-wide uppercase">
                        Active KOT #{selectedTableDetails.kot.kotNumber}
                      </span>
                    </div>
                    <div className="text-xs text-rose-100 flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Seated {selectedTableDetails.elapsedMinutes}m ago
                      </span>
                      <span>•</span>
                      <span>Waiter: {selectedTableDetails.waiterName}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTableDetails(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Items List Preview */}
              <div className="p-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 flex justify-between items-center border-b border-slate-100 pb-2">
                  <span>Ordered Items ({selectedTableDetails.itemCount})</span>
                  <span className="font-mono text-rose-700 font-black text-sm">
                    Total: ₹{selectedTableDetails.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 text-xs">
                  {selectedTableDetails.items.map((item, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 w-5">
                          {item.quantity}×
                        </span>
                        <span className="font-medium text-slate-800">
                          {item.itemName}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Staff can load all ordered KOT items directly into the bill cart to settle payment, or select the table to add new items.
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmLoadKot(selectedTableDetails)}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Load KOT to Cart & Settle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectOccupiedWithoutLoading(selectedTableDetails)}
                  className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Select Table Only</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. FULL VISUAL TABLE MAP MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                      <span>Restaurant Table Map & Seating Status</span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Live Sync
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Visual overview of all dining tables to manage guest seating and direct settlement
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Stats & Filter Bar */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-3">
                {/* 3 Overview Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="text-slate-500 font-medium">Total Tables</div>
                    <div className="text-lg font-black font-mono text-slate-900">{totalTablesCount}</div>
                  </div>

                  <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <div className="text-emerald-700 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Available (Vacant)
                    </div>
                    <div className="text-lg font-black font-mono text-emerald-800">{availableCount}</div>
                  </div>

                  <div className="bg-rose-50/80 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
                    <div className="text-rose-700 font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Occupied (Dining)
                    </div>
                    <div className="text-lg font-black font-mono text-rose-800">{occupiedCount}</div>
                  </div>

                  <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 shadow-2xs col-span-2 sm:col-span-1">
                    <div className="text-blue-700 font-bold">Occupancy Rate</div>
                    <div className="text-lg font-black font-mono text-blue-800">{occupancyPercentage}%</div>
                  </div>
                </div>

                {/* Section Filter and Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setActiveSection('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        activeSection === 'ALL'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      All Sections ({allTables.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('NON_AC')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        activeSection === 'NON_AC'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      Non-AC Hall (T1-T8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('AC')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        activeSection === 'AC'
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                      }`}
                    >
                      AC Family (A1-A4)
                    </button>
                  </div>

                  {/* Search filter input */}
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter tables or items..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Floor Map Grid */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-h-[300px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {displayTables.map((tbl) => {
                    const occ = occupiedTablesMap.get(tbl);
                    const isSelected = selectedTable === tbl;
                    const isOccupied = !!occ;
                    const isAc = tbl.startsWith('A-') || (tbl.startsWith('T-') && parseInt(tbl.replace('T-', ''), 10) > 8);

                    return (
                      <motion.div
                        key={tbl}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleTableClick(tbl)}
                        className={`rounded-2xl border-2 p-3 sm:p-4 flex flex-col justify-between cursor-pointer transition-all relative overflow-hidden select-none ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                            : isOccupied
                              ? 'border-rose-300 bg-rose-50/50 hover:bg-rose-50 shadow-2xs'
                              : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/20 shadow-2xs'
                        }`}
                      >
                        {/* Status Ribbon / Badge */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                            isOccupied
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <span>{isOccupied ? 'Occupied' : 'Vacant'}</span>
                          </span>

                          <span className="text-[10px] font-mono text-slate-500 font-semibold">
                            {isAc ? 'AC' : 'Non-AC'}
                          </span>
                        </div>

                        {/* Center Table Graphic & Number */}
                        <div className="my-2 flex flex-col items-center justify-center text-center">
                          {/* Visual Table & Chairs Icon */}
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-xl transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-md'
                              : isOccupied
                                ? 'bg-rose-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {tbl}
                          </div>
                          
                          {/* Live Timer or Empty Notice */}
                          {isOccupied ? (
                            <div className="mt-2 text-center">
                              <div className="text-[11px] font-mono font-bold text-rose-900 flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3 text-rose-600" />
                                <span>{occ.elapsedMinutes} mins seated</span>
                              </div>
                              <div className="text-[10px] text-slate-600 truncate max-w-[140px] mt-0.5">
                                KOT #{occ.kot.kotNumber} • {occ.itemCount} items
                              </div>
                              <div className="font-mono font-extrabold text-xs text-rose-800 mt-0.5">
                                ₹{occ.totalAmount.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Ready for Guests
                            </div>
                          )}
                        </div>

                        {/* Action Footer */}
                        <div className="pt-2 border-t border-slate-100 mt-2">
                          {isSelected ? (
                            <div className="text-center text-[11px] font-extrabold text-blue-700 bg-blue-100/80 py-1 rounded-lg">
                              Current Selected
                            </div>
                          ) : isOccupied ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmLoadKot(occ);
                              }}
                              className="w-full py-1 px-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1"
                            >
                              <Receipt className="w-3 h-3" />
                              <span>Settle Bill</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTableClick(tbl);
                              }}
                              className="w-full py-1 px-2 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold text-[10px] rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1"
                            >
                              <span>Assign Table</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Legend Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600" />
                    <span>Vacant / Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600 animate-pulse" />
                    <span>Occupied (Running KOT)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-blue-600 border border-blue-700" />
                    <span>Selected for Bill</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Click any table to assign it to the current customer or load its active order.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
