import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Boxes, 
  TrendingUp, 
  TrendingDown, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  Percent, 
  Sliders, 
  ArrowRight, 
  Plus, 
  RotateCcw,
  Sparkles,
  Table,
  Check,
  Package,
  Layers
} from 'lucide-react';
import { writeBatch, doc } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../services/firebase';
import { InventoryItem, MenuItem, StockMovement, CountPurchaseRecord } from '../../types';
import { calculateStockMetrics } from '../../services/countInventoryService';

export interface BulkItemRow {
  id: string;
  itemCode: string;
  itemName: string;
  itemNameTamil?: string;
  category?: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  isInitialized: boolean;
  initialStock: number;
  purchasedCount: number;
  soldCount: number;
  missingCount: number;
  remainingCount: number;
  nonAcPrice: number;
  acPrice: number;
}

interface BulkUpdateModalProps {
  isOpen: boolean;
  selectedItems: BulkItemRow[];
  initialTab?: 'PRICE' | 'STOCK' | 'MATRIX';
  onClose: () => void;
  onApplySuccess: (summaryMessage: string) => void;
  currentUserName: string;
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
  isOpen,
  selectedItems,
  initialTab = 'PRICE',
  onClose,
  onApplySuccess,
  currentUserName
}) => {
  const [activeTab, setActiveTab] = useState<'PRICE' | 'STOCK' | 'MATRIX'>(initialTab);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMessage(null);
  }, [initialTab, isOpen]);

  // =========================================================================
  // TAB 1: BULK PRICE UPDATE STATE
  // =========================================================================
  type PriceStrategy = 'SET_FIXED' | 'PERCENT_CHANGE' | 'FLAT_AMOUNT' | 'SYNC_AC';
  type PriceTarget = 'BOTH' | 'NON_AC' | 'AC';

  const [priceStrategy, setPriceStrategy] = useState<PriceStrategy>('PERCENT_CHANGE');
  const [priceTarget, setPriceTarget] = useState<PriceTarget>('BOTH');
  
  // Fixed inputs
  const [fixedNonAcPrice, setFixedNonAcPrice] = useState<string>('50');
  const [fixedAcPrice, setFixedAcPrice] = useState<string>('55');
  const [syncFixedAcWithNonAc, setSyncFixedAcWithNonAc] = useState<boolean>(true);

  // Percent adjustment
  const [percentDirection, setPercentDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [percentValue, setPercentValue] = useState<string>('10');
  const [roundingMode, setRoundingMode] = useState<'NEAREST_1' | 'NEAREST_5' | 'EXACT'>('NEAREST_1');

  // Flat amount adjustment
  const [flatDirection, setFlatDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [flatAmountValue, setFlatAmountValue] = useState<string>('5');

  // Sync AC markup
  const [acMarkupAmount, setAcMarkupAmount] = useState<string>('10');

  // Custom per-item price overrides: { [itemId]: { nonAcPrice?: number; acPrice?: number } }
  const [priceOverrides, setPriceOverrides] = useState<Record<string, { nonAcPrice?: number; acPrice?: number }>>({});

  // Reset overrides when changing strategy
  const handleStrategyChange = (st: PriceStrategy) => {
    setPriceStrategy(st);
    setPriceOverrides({});
    setErrorMessage(null);
  };

  // Helper rounding function
  const applyRounding = (val: number, mode: 'NEAREST_1' | 'NEAREST_5' | 'EXACT'): number => {
    if (val < 0) return 0;
    if (mode === 'EXACT') return Math.round(val * 100) / 100;
    if (mode === 'NEAREST_5') return Math.round(val / 5) * 5;
    return Math.round(val);
  };

  // Compute calculated new prices for each selected item
  const computedPriceItems = useMemo(() => {
    return selectedItems.map((item) => {
      let newNonAc = item.nonAcPrice;
      let newAc = item.acPrice;

      if (priceStrategy === 'SET_FIXED') {
        const fixedNon = parseFloat(fixedNonAcPrice);
        const fixedAc = parseFloat(fixedAcPrice);
        if (priceTarget === 'BOTH' || priceTarget === 'NON_AC') {
          if (!isNaN(fixedNon) && fixedNon >= 0) newNonAc = fixedNon;
        }
        if (priceTarget === 'BOTH' || priceTarget === 'AC') {
          if (syncFixedAcWithNonAc && !isNaN(fixedNon) && fixedNon >= 0) {
            newAc = fixedNon;
          } else if (!isNaN(fixedAc) && fixedAc >= 0) {
            newAc = fixedAc;
          }
        }
      } else if (priceStrategy === 'PERCENT_CHANGE') {
        const pct = parseFloat(percentValue);
        if (!isNaN(pct) && pct >= 0) {
          const multiplier = percentDirection === 'INCREASE' ? (1 + pct / 100) : Math.max(0, 1 - pct / 100);
          if (priceTarget === 'BOTH' || priceTarget === 'NON_AC') {
            newNonAc = applyRounding(item.nonAcPrice * multiplier, roundingMode);
          }
          if (priceTarget === 'BOTH' || priceTarget === 'AC') {
            newAc = applyRounding(item.acPrice * multiplier, roundingMode);
          }
        }
      } else if (priceStrategy === 'FLAT_AMOUNT') {
        const amt = parseFloat(flatAmountValue);
        if (!isNaN(amt) && amt >= 0) {
          const delta = flatDirection === 'INCREASE' ? amt : -amt;
          if (priceTarget === 'BOTH' || priceTarget === 'NON_AC') {
            newNonAc = Math.max(0, applyRounding(item.nonAcPrice + delta, roundingMode));
          }
          if (priceTarget === 'BOTH' || priceTarget === 'AC') {
            newAc = Math.max(0, applyRounding(item.acPrice + delta, roundingMode));
          }
        }
      } else if (priceStrategy === 'SYNC_AC') {
        const markup = parseFloat(acMarkupAmount);
        const add = isNaN(markup) ? 0 : Math.max(0, markup);
        newAc = Math.max(0, item.nonAcPrice + add);
      }

      // Check manual override
      const override = priceOverrides[item.id];
      if (override?.nonAcPrice !== undefined) newNonAc = override.nonAcPrice;
      if (override?.acPrice !== undefined) newAc = override.acPrice;

      return {
        ...item,
        newNonAcPrice: newNonAc,
        newAcPrice: newAc,
        diffNonAc: newNonAc - item.nonAcPrice,
        diffAc: newAc - item.acPrice
      };
    });
  }, [
    selectedItems, 
    priceStrategy, 
    priceTarget, 
    fixedNonAcPrice, 
    fixedAcPrice, 
    syncFixedAcWithNonAc, 
    percentDirection, 
    percentValue, 
    roundingMode, 
    flatDirection, 
    flatAmountValue, 
    acMarkupAmount, 
    priceOverrides
  ]);

  // =========================================================================
  // TAB 2: BULK STOCK LEVEL UPDATE STATE
  // =========================================================================
  type StockStrategy = 'ADD_STOCK' | 'SET_EXACT' | 'SET_MIN_STOCK' | 'BULK_INITIALIZE';

  const [stockStrategy, setStockStrategy] = useState<StockStrategy>('ADD_STOCK');
  const [addQuantityValue, setAddQuantityValue] = useState<string>('20');
  const [stockSupplier, setStockSupplier] = useState<string>('');
  const [stockInvoice, setStockInvoice] = useState<string>('');
  const [stockNotes, setStockNotes] = useState<string>('Bulk inward stock addition');

  const [exactStockValue, setExactStockValue] = useState<string>('50');
  const [exactAdjustmentReason, setExactAdjustmentReason] = useState<string>('Physical stock take adjustment');

  const [minStockValue, setMinStockValue] = useState<string>('15');

  const [bulkInitStockValue, setBulkInitStockValue] = useState<string>('50');
  const [bulkInitMinValue, setBulkInitMinValue] = useState<string>('10');
  const [bulkInitUnit, setBulkInitUnit] = useState<string>('Pcs');

  // Custom per-item stock overrides: { [itemId]: { newStock?: number; newMinStock?: number } }
  const [stockOverrides, setStockOverrides] = useState<Record<string, { newStock?: number; newMinStock?: number }>>({});

  // Reset overrides when changing strategy
  const handleStockStrategyChange = (st: StockStrategy) => {
    setStockStrategy(st);
    setStockOverrides({});
    setErrorMessage(null);
  };

  // Compute calculated new stock values for each selected item
  const computedStockItems = useMemo(() => {
    return selectedItems.map((item) => {
      const currentRemaining = item.remainingCount !== undefined ? item.remainingCount : item.currentStock;
      let newStock = currentRemaining;
      let newMinStock = item.minimumStock || 10;
      let changeType: string = 'No Change';

      if (stockStrategy === 'ADD_STOCK') {
        const qty = parseFloat(addQuantityValue);
        const add = isNaN(qty) ? 0 : Math.max(0, qty);
        newStock = currentRemaining + add;
        changeType = `+${add} ${item.unit}`;
      } else if (stockStrategy === 'SET_EXACT') {
        const exact = parseFloat(exactStockValue);
        if (!isNaN(exact) && exact >= 0) {
          newStock = exact;
          const diff = exact - currentRemaining;
          changeType = diff >= 0 ? `+${diff} (Set to ${exact})` : `${diff} (Set to ${exact})`;
        }
      } else if (stockStrategy === 'SET_MIN_STOCK') {
        const minVal = parseFloat(minStockValue);
        if (!isNaN(minVal) && minVal >= 0) {
          newMinStock = minVal;
          changeType = `Min: ${minVal} ${item.unit}`;
        }
      } else if (stockStrategy === 'BULK_INITIALIZE') {
        const initVal = parseFloat(bulkInitStockValue);
        const minVal = parseFloat(bulkInitMinValue);
        if (!isNaN(initVal) && initVal >= 0) {
          newStock = item.isInitialized ? currentRemaining : initVal;
          newMinStock = isNaN(minVal) ? 10 : minVal;
          changeType = item.isInitialized ? 'Already Initialized' : `Init ${initVal} ${bulkInitUnit}`;
        }
      }

      // Check override
      const override = stockOverrides[item.id];
      if (override?.newStock !== undefined) newStock = override.newStock;
      if (override?.newMinStock !== undefined) newMinStock = override.newMinStock;

      return {
        ...item,
        currentRemaining,
        newStock,
        newMinStock,
        changeType
      };
    });
  }, [
    selectedItems, 
    stockStrategy, 
    addQuantityValue, 
    exactStockValue, 
    minStockValue, 
    bulkInitStockValue, 
    bulkInitMinValue, 
    bulkInitUnit, 
    stockOverrides
  ]);

  // =========================================================================
  // TAB 3: BATCH MATRIX SPREADSHEET STATE
  // =========================================================================
  const [matrixData, setMatrixData] = useState<Record<string, { nonAcPrice: string; acPrice: string; stock: string; minStock: string }>>({});

  useEffect(() => {
    const initial: Record<string, { nonAcPrice: string; acPrice: string; stock: string; minStock: string }> = {};
    selectedItems.forEach((item) => {
      const rem = item.remainingCount !== undefined ? item.remainingCount : item.currentStock;
      initial[item.id] = {
        nonAcPrice: item.nonAcPrice.toString(),
        acPrice: item.acPrice.toString(),
        stock: rem.toString(),
        minStock: (item.minimumStock || 10).toString()
      };
    });
    setMatrixData(initial);
  }, [selectedItems, isOpen]);

  const handleMatrixCellChange = (itemId: string, field: 'nonAcPrice' | 'acPrice' | 'stock' | 'minStock', value: string) => {
    setMatrixData((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { nonAcPrice: '0', acPrice: '0', stock: '0', minStock: '10' }),
        [field]: value
      }
    }));
  };

  const handleCopyFirstRowDown = (field: 'nonAcPrice' | 'acPrice' | 'stock' | 'minStock') => {
    if (selectedItems.length === 0) return;
    const firstId = selectedItems[0].id;
    const firstVal = matrixData[firstId]?.[field];
    if (firstVal === undefined) return;

    setMatrixData((prev) => {
      const updated = { ...prev };
      selectedItems.forEach((item) => {
        if (!updated[item.id]) {
          updated[item.id] = { nonAcPrice: '0', acPrice: '0', stock: '0', minStock: '10' };
        }
        updated[item.id][field] = firstVal;
      });
      return updated;
    });
  };

  // =========================================================================
  // COMMIT HANDLERS
  // =========================================================================

  // 1. SAVE BULK PRICE UPDATES
  const handleSaveBulkPrices = async () => {
    if (computedPriceItems.length === 0) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      // 1. Retrieve local menu items
      let localMenuItems: MenuItem[] = [];
      try {
        const stored = localStorage.getItem('pos_local_menu_items');
        if (stored) localMenuItems = JSON.parse(stored);
      } catch (e) {}

      // 2. Prepare Firestore Batch
      const batch = writeBatch(db);
      const now = Date.now();

      computedPriceItems.forEach((item) => {
        // Update in local cache
        const index = localMenuItems.findIndex((m) => m.id === item.id || (m.itemCode && m.itemCode.toUpperCase() === item.itemCode.toUpperCase()));
        if (index >= 0) {
          localMenuItems[index] = {
            ...localMenuItems[index],
            nonAcPrice: item.newNonAcPrice,
            acPrice: item.newAcPrice,
            updatedAt: now
          };
        } else {
          localMenuItems.push({
            id: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemNameTamil: item.itemNameTamil,
            categoryId: item.category || 'cat_other',
            categoryName: item.category || 'Other',
            nonAcPrice: item.newNonAcPrice,
            acPrice: item.newAcPrice,
            active: true,
            createdAt: now,
            updatedAt: now
          });
        }

        // Add to Firestore batch
        const ref = doc(db, 'menu_items', item.id);
        batch.set(ref, sanitizeForFirestore({
          nonAcPrice: item.newNonAcPrice,
          acPrice: item.newAcPrice,
          updatedAt: now
        }), { merge: true });
      });

      // Save to localStorage immediately
      localStorage.setItem('pos_local_menu_items', JSON.stringify(localMenuItems));

      // Commit batch
      try {
        await batch.commit();
      } catch (fbErr: any) {
        console.warn('Firestore menu items batch notice:', fbErr?.message || fbErr);
      }

      // Dispatch cross-window events
      window.dispatchEvent(new Event('pos_menu_updated'));
      window.dispatchEvent(new Event('pos_inventory_updated'));

      onApplySuccess(`Successfully updated prices for ${computedPriceItems.length} items.`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update prices. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // 2. SAVE BULK STOCK UPDATES
  const handleSaveBulkStock = async () => {
    if (computedStockItems.length === 0) return;
    setSaving(true);
    setErrorMessage(null);

    try {
      // 1. Retrieve local inventory and movements
      let localInventory: InventoryItem[] = [];
      try {
        const stored = localStorage.getItem('pos_local_inventory');
        if (stored) localInventory = JSON.parse(stored);
      } catch (e) {}

      const batch = writeBatch(db);
      const now = Date.now();
      const todayStr = new Date().toISOString().split('T')[0];

      computedStockItems.forEach((item) => {
        let existing = localInventory.find((i) => i.id === item.id);
        
        let initialStock = item.initialStock || 0;
        let purchasedCount = item.purchasedCount || 0;
        let soldCount = item.soldCount || 0;
        let missingCount = item.missingCount || 0;
        let remainingCount = item.newStock;
        let minimumStock = item.newMinStock;
        let isInitialized = item.isInitialized;
        let purchases: CountPurchaseRecord[] = existing?.purchases ? [...existing.purchases] : [];

        if (stockStrategy === 'ADD_STOCK') {
          const addedQty = item.newStock - item.currentRemaining;
          if (addedQty > 0) {
            purchasedCount += addedQty;
            const newPurchase: CountPurchaseRecord = {
              id: `pur_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              date: todayStr,
              quantity: addedQty,
              supplier: stockSupplier.trim() || undefined,
              invoiceNumber: stockInvoice.trim() || undefined,
              notes: stockNotes.trim() || 'Bulk stock addition',
              createdBy: currentUserName || 'Manager',
              createdAt: now
            };
            purchases.unshift(newPurchase);

            // Create inventory movement record in Firestore
            const movRef = doc(db, 'inventory_movements', newPurchase.id);
            batch.set(movRef, sanitizeForFirestore({
              itemId: item.id,
              itemCode: item.itemCode,
              itemName: item.itemName,
              type: 'PURCHASE',
              quantity: addedQty,
              createdBy: currentUserName || 'Manager',
              createdAt: now,
              notes: stockNotes.trim() || 'Bulk stock addition'
            }));
          }
        } else if (stockStrategy === 'SET_EXACT') {
          // Adjust initial/remaining count
          if (!isInitialized) {
            isInitialized = true;
            initialStock = item.newStock;
            remainingCount = item.newStock;
          } else {
            // Recalculate tally offset if needed
            remainingCount = item.newStock;
          }

          const movId = `mov_adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const movRef = doc(db, 'inventory_movements', movId);
          batch.set(movRef, sanitizeForFirestore({
            itemId: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            type: 'ADJUSTMENT',
            quantity: item.newStock,
            createdBy: currentUserName || 'Manager',
            createdAt: now,
            notes: exactAdjustmentReason.trim() || 'Bulk exact stock adjustment'
          }));
        } else if (stockStrategy === 'SET_MIN_STOCK') {
          minimumStock = item.newMinStock;
        } else if (stockStrategy === 'BULK_INITIALIZE') {
          if (!isInitialized) {
            isInitialized = true;
            initialStock = item.newStock;
            remainingCount = item.newStock;
          }
          minimumStock = item.newMinStock;
        }

        const updatedItem: InventoryItem = {
          id: item.id,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemNameTamil: item.itemNameTamil,
          category: item.category || 'Other',
          unit: item.unit || 'Pcs',
          minimumStock,
          currentStock: remainingCount,
          active: true,
          isCountBased: true,
          isInitialized,
          initialStock,
          purchasedCount,
          soldCount,
          missingCount,
          remainingCount,
          purchases,
          createdAt: existing?.createdAt || now,
          updatedAt: now
        };

        // Update local list
        const idx = localInventory.findIndex((i) => i.id === item.id);
        if (idx >= 0) {
          localInventory[idx] = updatedItem;
        } else {
          localInventory.push(updatedItem);
        }

        // Add to Firestore batch
        const ref = doc(db, 'inventory_items', item.id);
        batch.set(ref, sanitizeForFirestore(updatedItem), { merge: true });
      });

      // Save to localStorage
      localStorage.setItem('pos_local_inventory', JSON.stringify(localInventory));

      // Commit Firestore batch
      try {
        await batch.commit();
      } catch (fbErr: any) {
        console.warn('Firestore inventory items batch notice:', fbErr?.message || fbErr);
      }

      // Notify other tabs and components
      window.dispatchEvent(new Event('pos_inventory_updated'));

      onApplySuccess(`Successfully updated stock levels for ${computedStockItems.length} items.`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update stock. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // 3. SAVE BATCH MATRIX SPREADSHEET CHANGES
  const handleSaveMatrixChanges = async () => {
    setSaving(true);
    setErrorMessage(null);

    try {
      let localMenuItems: MenuItem[] = [];
      try {
        const stored = localStorage.getItem('pos_local_menu_items');
        if (stored) localMenuItems = JSON.parse(stored);
      } catch (e) {}

      let localInventory: InventoryItem[] = [];
      try {
        const stored = localStorage.getItem('pos_local_inventory');
        if (stored) localInventory = JSON.parse(stored);
      } catch (e) {}

      const batch = writeBatch(db);
      const now = Date.now();

      selectedItems.forEach((item) => {
        const cell = matrixData[item.id];
        if (!cell) return;

        const newNonAc = parseFloat(cell.nonAcPrice);
        const newAc = parseFloat(cell.acPrice);
        const newStock = parseFloat(cell.stock);
        const newMin = parseFloat(cell.minStock);

        // 1. Menu Items update (prices)
        if (!isNaN(newNonAc) && !isNaN(newAc)) {
          const mIdx = localMenuItems.findIndex((m) => m.id === item.id || (m.itemCode && m.itemCode.toUpperCase() === item.itemCode.toUpperCase()));
          if (mIdx >= 0) {
            localMenuItems[mIdx] = {
              ...localMenuItems[mIdx],
              nonAcPrice: newNonAc,
              acPrice: newAc,
              updatedAt: now
            };
          }
          const mRef = doc(db, 'menu_items', item.id);
          batch.set(mRef, sanitizeForFirestore({ nonAcPrice: newNonAc, acPrice: newAc, updatedAt: now }), { merge: true });
        }

        // 2. Inventory Items update (stock)
        if (!isNaN(newStock) && !isNaN(newMin)) {
          const existing = localInventory.find((i) => i.id === item.id);
          const updatedInv: InventoryItem = {
            id: item.id,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemNameTamil: item.itemNameTamil,
            category: item.category || 'Other',
            unit: item.unit || 'Pcs',
            minimumStock: newMin,
            currentStock: newStock,
            remainingCount: newStock,
            active: true,
            isCountBased: true,
            isInitialized: true,
            initialStock: item.isInitialized ? (item.initialStock || 0) : newStock,
            purchasedCount: item.purchasedCount || 0,
            soldCount: item.soldCount || 0,
            missingCount: item.missingCount || 0,
            purchases: existing?.purchases || [],
            createdAt: existing?.createdAt || now,
            updatedAt: now
          };

          const iIdx = localInventory.findIndex((i) => i.id === item.id);
          if (iIdx >= 0) localInventory[iIdx] = updatedInv;
          else localInventory.push(updatedInv);

          const iRef = doc(db, 'inventory_items', item.id);
          batch.set(iRef, sanitizeForFirestore(updatedInv), { merge: true });
        }
      });

      localStorage.setItem('pos_local_menu_items', JSON.stringify(localMenuItems));
      localStorage.setItem('pos_local_inventory', JSON.stringify(localInventory));

      try {
        await batch.commit();
      } catch (fbErr: any) {
        console.warn('Firestore matrix batch notice:', fbErr?.message || fbErr);
      }

      window.dispatchEvent(new Event('pos_menu_updated'));
      window.dispatchEvent(new Event('pos_inventory_updated'));

      onApplySuccess(`Successfully updated ${selectedItems.length} items via Matrix Editor.`);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save matrix changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-sm font-black">
              {activeTab === 'PRICE' ? <DollarSign className="w-6 h-6" /> : activeTab === 'STOCK' ? <Boxes className="w-6 h-6" /> : <Table className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base sm:text-lg tracking-tight uppercase">
                  Bulk Operations Manager
                </h2>
                <span className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-2xs">
                  {selectedItems.length} {selectedItems.length === 1 ? 'Item' : 'Items'} Selected
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk adjust pricing or stock levels with instant synchronization to billing & POS terminals.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB SWITCHER */}
        <div className="bg-slate-100 border-b border-slate-200 px-5 pt-2 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('PRICE')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl flex items-center gap-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'PRICE'
                ? 'bg-white text-emerald-800 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>BULK UPDATE PRICES</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STOCK')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl flex items-center gap-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'STOCK'
                ? 'bg-white text-amber-900 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Boxes className="w-4 h-4 text-amber-600" />
            <span>BULK UPDATE STOCK LEVELS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl flex items-center gap-2 transition-all cursor-pointer border-t border-x ${
              activeTab === 'MATRIX'
                ? 'bg-white text-blue-900 border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Table className="w-4 h-4 text-blue-600" />
            <span>BATCH SPREADSHEET MATRIX</span>
          </button>
        </div>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 px-5 py-2.5 flex items-center gap-2 text-xs font-bold text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">

          {/* ========================================================================= */}
          {/* TAB 1: BULK PRICE UPDATE                                                 */}
          {/* ========================================================================= */}
          {activeTab === 'PRICE' && (
            <div className="space-y-5">
              
              {/* Strategy Selector Pills */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  1. Select Price Adjustment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'PERCENT_CHANGE', label: 'Percentage (%)', desc: 'Increase/Decrease by %', icon: Percent },
                    { id: 'FLAT_AMOUNT', label: 'Flat Amount (₹)', desc: 'Add/Subtract ₹ amount', icon: Tag },
                    { id: 'SET_FIXED', label: 'Set Fixed Price', desc: 'Apply exact ₹ to all', icon: DollarSign },
                    { id: 'SYNC_AC', label: 'Sync AC Markup', desc: 'AC = Non-AC + ₹ markup', icon: Sliders }
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = priceStrategy === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleStrategyChange(s.id as PriceStrategy)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-black ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                            {s.label}
                          </span>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <span className="text-[11px] text-slate-500">{s.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target & Parameter Controls */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                
                {/* Target Scope */}
                {priceStrategy !== 'SYNC_AC' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                      Target Price Type
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { id: 'BOTH', label: 'Both (Non-AC & AC Price)' },
                        { id: 'NON_AC', label: 'Standard / Non-AC Price Only' },
                        { id: 'AC', label: 'AC Hall Price Only' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPriceTarget(t.id as PriceTarget)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            priceTarget === t.id
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Specific Strategy Inputs */}
                {priceStrategy === 'PERCENT_CHANGE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Adjustment Direction
                      </label>
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => setPercentDirection('INCREASE')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                            percentDirection === 'INCREASE'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Increase (+)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPercentDirection('DECREASE')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                            percentDirection === 'DECREASE'
                              ? 'bg-red-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>Decrease (-)</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Percentage (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="200"
                          value={percentValue}
                          onChange={(e) => setPercentValue(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 10"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-black text-slate-400">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Rounding Rule
                      </label>
                      <select
                        value={roundingMode}
                        onChange={(e) => setRoundingMode(e.target.value as any)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="NEAREST_1">Round to nearest ₹1 (Standard)</option>
                        <option value="NEAREST_5">Round to nearest ₹5 (e.g. ₹45, ₹50)</option>
                        <option value="EXACT">No rounding (Exact)</option>
                      </select>
                    </div>
                  </div>
                )}

                {priceStrategy === 'FLAT_AMOUNT' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Adjustment Direction
                      </label>
                      <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white p-0.5">
                        <button
                          type="button"
                          onClick={() => setFlatDirection('INCREASE')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                            flatDirection === 'INCREASE'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Add (+ ₹)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlatDirection('DECREASE')}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${
                            flatDirection === 'DECREASE'
                              ? 'bg-red-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>Subtract (- ₹)</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Flat Amount (₹)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={flatAmountValue}
                          onChange={(e) => setFlatAmountValue(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 5"
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-black text-slate-400">₹</span>
                      </div>
                    </div>
                  </div>
                )}

                {priceStrategy === 'SET_FIXED' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Fixed Non-AC Price (₹)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={fixedNonAcPrice}
                          onChange={(e) => setFixedNonAcPrice(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Fixed AC Price (₹)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          disabled={syncFixedAcWithNonAc}
                          value={syncFixedAcWithNonAc ? fixedNonAcPrice : fixedAcPrice}
                          onChange={(e) => setFixedAcPrice(e.target.value)}
                          className={`w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500 ${
                            syncFixedAcWithNonAc ? 'bg-slate-100 text-slate-500' : ''
                          }`}
                          placeholder="e.g. 55"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={syncFixedAcWithNonAc}
                        onChange={(e) => setSyncFixedAcWithNonAc(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Keep AC Price equal to Non-AC Price</span>
                    </label>
                  </div>
                )}

                {priceStrategy === 'SYNC_AC' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      AC Room Markup over Non-AC Price (₹)
                    </label>
                    <div className="relative max-w-xs">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={acMarkupAmount}
                        onChange={(e) => setAcMarkupAmount(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 10"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-black text-slate-400">₹ markup</span>
                    </div>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Example: If an item is Non-AC ₹60 and markup is ₹10, AC price becomes ₹70.
                    </span>
                  </div>
                )}
              </div>

              {/* LIVE PREVIEW TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                    2. Live Preview of New Prices ({computedPriceItems.length} Items)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    You can click and edit any individual value before applying
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Item</th>
                          <th className="py-2.5 px-3 text-center">Current Non-AC</th>
                          <th className="py-2.5 px-3 text-center">New Non-AC</th>
                          <th className="py-2.5 px-3 text-center">Current AC</th>
                          <th className="py-2.5 px-3 text-center">New AC</th>
                          <th className="py-2.5 px-3 text-right">Adjustment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {computedPriceItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                  #{item.itemCode}
                                </span>
                                <span className="font-bold text-slate-900 truncate max-w-xs">{item.itemName}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              ₹{item.nonAcPrice}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={item.newNonAcPrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setPriceOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      nonAcPrice: isNaN(val) ? 0 : val
                                    }
                                  }));
                                }}
                                className="w-20 text-center font-mono font-black text-emerald-700 bg-emerald-50/50 border border-emerald-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              ₹{item.acPrice}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={item.newAcPrice}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setPriceOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      acPrice: isNaN(val) ? 0 : val
                                    }
                                  }));
                                }}
                                className="w-20 text-center font-mono font-black text-emerald-700 bg-emerald-50/50 border border-emerald-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-emerald-500 focus:bg-white"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <span className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.diffNonAc > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.diffNonAc < 0
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.diffNonAc > 0 ? `+₹${item.diffNonAc}` : item.diffNonAc < 0 ? `-₹${Math.abs(item.diffNonAc)}` : 'No change'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: BULK STOCK LEVEL UPDATE                                           */}
          {/* ========================================================================= */}
          {activeTab === 'STOCK' && (
            <div className="space-y-5">
              
              {/* Stock Strategy Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  1. Select Stock Adjustment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ADD_STOCK', label: 'Add Stock (+)', desc: 'Record inward shipment', icon: Plus },
                    { id: 'SET_EXACT', label: 'Set Exact Stock', desc: 'Set physical count', icon: Boxes },
                    { id: 'SET_MIN_STOCK', label: 'Minimum Safe Stock', desc: 'Alert threshold', icon: AlertTriangle },
                    { id: 'BULK_INITIALIZE', label: 'Initialize Starting Stock', desc: 'First time stock setup', icon: Sparkles }
                  ].map((s) => {
                    const Icon = s.icon;
                    const isSelected = stockStrategy === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleStockStrategyChange(s.id as StockStrategy)}
                        className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-black ${isSelected ? 'text-amber-900' : 'text-slate-800'}`}>
                            {s.label}
                          </span>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                        </div>
                        <span className="text-[11px] text-slate-500">{s.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strategy Parameters Form */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                {stockStrategy === 'ADD_STOCK' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Quantity to Add (+ Units to each item)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={addQuantityValue}
                            onChange={(e) => setAddQuantityValue(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                            placeholder="e.g. 25"
                          />
                          <span className="absolute right-3 top-2.5 text-xs font-black text-amber-600">+ units</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Supplier / Vendor (Optional)
                        </label>
                        <input
                          type="text"
                          value={stockSupplier}
                          onChange={(e) => setStockSupplier(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                          placeholder="e.g. Amul Distributor"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Invoice / Bill # (Optional)
                        </label>
                        <input
                          type="text"
                          value={stockInvoice}
                          onChange={(e) => setStockInvoice(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                          placeholder="e.g. INV-8821"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Audit Movement Note
                      </label>
                      <input
                        type="text"
                        value={stockNotes}
                        onChange={(e) => setStockNotes(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. Morning delivery stock replenishment"
                      />
                    </div>
                  </div>
                )}

                {stockStrategy === 'SET_EXACT' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Exact Remaining Stock Count (Units)
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={exactStockValue}
                        onChange={(e) => setExactStockValue(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. 50"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Audit Reason
                      </label>
                      <input
                        type="text"
                        value={exactAdjustmentReason}
                        onChange={(e) => setExactAdjustmentReason(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                        placeholder="e.g. Weekend physical audit count"
                      />
                    </div>
                  </div>
                )}

                {stockStrategy === 'SET_MIN_STOCK' && (
                  <div className="max-w-md">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Minimum Safe Stock Threshold (Units)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={minStockValue}
                      onChange={(e) => setMinStockValue(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                      placeholder="e.g. 15"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      When remaining stock drops to or below this count, the 8:00 AM daily low stock alert triggers.
                    </span>
                  </div>
                )}

                {stockStrategy === 'BULK_INITIALIZE' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Starting Physical Count
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={bulkInitStockValue}
                        onChange={(e) => setBulkInitStockValue(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Minimum Safe Stock
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={bulkInitMinValue}
                        onChange={(e) => setBulkInitMinValue(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Unit of Measurement
                      </label>
                      <select
                        value={bulkInitUnit}
                        onChange={(e) => setBulkInitUnit(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                      >
                        <option value="Pcs">Pieces (Pcs)</option>
                        <option value="Cups">Cups</option>
                        <option value="Bottles">Bottles</option>
                        <option value="Packets">Packets</option>
                        <option value="Units">Units</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* LIVE STOCK PREVIEW TABLE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                    2. Live Stock Preview ({computedStockItems.length} Items)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Adjust specific new stock quantities directly in the cells below
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">Item</th>
                          <th className="py-2.5 px-3 text-center">Current Stock</th>
                          <th className="py-2.5 px-3 text-center">New Stock</th>
                          <th className="py-2.5 px-3 text-center">Min Stock</th>
                          <th className="py-2.5 px-3 text-right">Adjustment Effect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {computedStockItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                  #{item.itemCode}
                                </span>
                                <span className="font-bold text-slate-900 truncate max-w-xs">{item.itemName}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                              {item.currentRemaining} {item.unit}
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={item.newStock}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setStockOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      newStock: isNaN(val) ? 0 : val
                                    }
                                  }));
                                }}
                                className="w-20 text-center font-mono font-black text-amber-800 bg-amber-50/60 border border-amber-300 rounded-lg py-1 px-1.5 focus:outline-none focus:border-amber-500 focus:bg-white"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={item.newMinStock}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setStockOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: {
                                      ...prev[item.id],
                                      newMinStock: isNaN(val) ? 1 : val
                                    }
                                  }));
                                }}
                                className="w-16 text-center font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg py-1 px-1 focus:outline-none focus:border-amber-500 focus:bg-white"
                              />
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                                {item.changeType}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: BATCH MATRIX SPREADSHEET                                          */}
          {/* ========================================================================= */}
          {activeTab === 'MATRIX' && (
            <div className="space-y-4">
              
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase">
                    Spreadsheet Quick Editor
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Directly type new prices and stock counts for each item. Use &ldquo;Copy Down&rdquo; to apply the first row&apos;s value to all rows.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleCopyFirstRowDown('nonAcPrice')}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Copy Non-AC Price Down
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyFirstRowDown('acPrice')}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Copy AC Price Down
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyFirstRowDown('stock')}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 cursor-pointer"
                  >
                    Copy Stock Down
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Item Code & Name</th>
                        <th className="py-2.5 px-3 text-center">Non-AC Price (₹)</th>
                        <th className="py-2.5 px-3 text-center">AC Price (₹)</th>
                        <th className="py-2.5 px-3 text-center">Stock Quantity</th>
                        <th className="py-2.5 px-3 text-center">Min Safe Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedItems.map((item) => {
                        const cell = matrixData[item.id] || {
                          nonAcPrice: item.nonAcPrice.toString(),
                          acPrice: item.acPrice.toString(),
                          stock: (item.remainingCount !== undefined ? item.remainingCount : item.currentStock).toString(),
                          minStock: (item.minimumStock || 10).toString()
                        };

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold mr-1.5">
                                #{item.itemCode}
                              </span>
                              <span className="font-bold text-slate-900">{item.itemName}</span>
                            </td>

                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={cell.nonAcPrice}
                                onChange={(e) => handleMatrixCellChange(item.id, 'nonAcPrice', e.target.value)}
                                className="w-24 text-center font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-lg py-1 px-2 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={cell.acPrice}
                                onChange={(e) => handleMatrixCellChange(item.id, 'acPrice', e.target.value)}
                                className="w-24 text-center font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-lg py-1 px-2 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={cell.stock}
                                onChange={(e) => handleMatrixCellChange(item.id, 'stock', e.target.value)}
                                className="w-24 text-center font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-lg py-1 px-2 focus:outline-none"
                              />
                            </td>

                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                step="1"
                                min="1"
                                value={cell.minStock}
                                onChange={(e) => handleMatrixCellChange(item.id, 'minStock', e.target.value)}
                                className="w-20 text-center font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 focus:border-slate-400 focus:bg-white rounded-lg py-1 px-1.5 focus:outline-none"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Applying changes will update Firestore and sync to active cashiers and KOT counters.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {activeTab === 'PRICE' && (
              <button
                type="button"
                onClick={handleSaveBulkPrices}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Applying Prices...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    <span>APPLY BULK PRICES ({computedPriceItems.length})</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'STOCK' && (
              <button
                type="button"
                onClick={handleSaveBulkStock}
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Updating Stock...</span>
                  </>
                ) : (
                  <>
                    <Boxes className="w-4 h-4" />
                    <span>APPLY BULK STOCK ({computedStockItems.length})</span>
                  </>
                )}
              </button>
            )}

            {activeTab === 'MATRIX' && (
              <button
                type="button"
                onClick={handleSaveMatrixChanges}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Matrix...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>SAVE MATRIX CHANGES ({selectedItems.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
