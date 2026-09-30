import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Tag,
  Zap,
  Cloud,
  Eye,
  Utensils,
  Maximize2,
  Minimize2,
  X,
  Receipt,
  Layers,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  CartItem, 
  Category, 
  MenuItem, 
  OrderType, 
  PriceType, 
  RestaurantSettings, 
  Bill, 
  BillItem 
} from '../../types';
import { safeStorage } from '../../utils/safeStorage';
import { BillingEngine } from '../../services/billingEngine';
import { PrinterService } from '../../services/printerService';
import { getBusinessDate, syncBusinessDaySequence } from '../../services/billNumberEngine';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { saveBillingDraft, getBillingDraft, clearBillingDraft } from '../../services/billingDraftService';
import { DEFAULT_FALLBACK_MENU_ITEMS, DEFAULT_CATEGORIES } from '../../data/fallbackMenu';
import { DEFAULT_RESTAURANT_LOGO } from '../../data/defaultLogo';
import { 
  filterPosMenuItems, 
  getPosCategoryDishCount, 
  isDinnerCategory, 
  isTiffinCategory, 
  isLunchCategory, 
  isServicePeriodCategory, 
  isDosaItem, 
  isIdlyItem, 
  CONSOLIDATED_POS_CATEGORIES, 
  ServicePeriod 
} from '../../utils/menuItemHelpers';

interface PosScreenProps {
  settings?: RestaurantSettings;
}

interface HeldOrder {
  id: string;
  name: string;
  items: CartItem[];
  orderType: OrderType;
  priceType: PriceType;
  tableNumber: string;
  createdAt: number;
}

interface DeleteConfirmItemState {
  index: number;
  itemCode: string;
  name: string;
  quantity: number;
  price: number;
}

export const PosScreen: React.FC<PosScreenProps> = ({ settings }) => {
  const { currentUser } = useAuth();

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const stored = localStorage.getItem('pos_local_categories');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_CATEGORIES;
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const stored = localStorage.getItem('pos_local_menu_items');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_FALLBACK_MENU_ITEMS;
  });

  const [activeServicePeriod, setActiveServicePeriod] = useState<ServicePeriod>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemCodeInput, setItemCodeInput] = useState('');
  const itemCodeInputRef = useRef<HTMLInputElement>(null);

  const [priceType, setPriceType] = useState<PriceType>('NON_AC');
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isInitialMount = useRef(true);
  const autoSaveTimerRef = useRef<any>(null);

  const [lastPrintedBill, setLastPrintedBill] = useState<{ bill: Bill; items: BillItem[] } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Delete Confirmation States
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<DeleteConfirmItemState | null>(null);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [deleteConfirmHeldId, setDeleteConfirmHeldId] = useState<string | null>(null);

  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Held Bills
  const [heldBills, setHeldBills] = useState<HeldOrder[]>(() => {
    try {
      const stored = safeStorage.getItem('pos_touch_held_bills');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  // Saved receipt preview modal
  const [savedBill, setSavedBill] = useState<Bill | null>(null);
  const [savedBillItems, setSavedBillItems] = useState<BillItem[]>([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Track Fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    } catch (e) {
      console.warn('Fullscreen request notice:', e);
    }
  };

  // Fetch Categories and Menu Items from Firestore
  useEffect(() => {
    const bDate = getBusinessDate(settings?.businessDayStart || '04:00');
    syncBusinessDaySequence(bDate);

    const unsubCats = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) => cats.push({ id: doc.id, ...doc.data() } as Category));
      const activeCats = cats.filter((c) => c.active !== false).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setCategories(activeCats);
      localStorage.setItem('pos_local_categories', JSON.stringify(activeCats));
    }, (err) => {
      console.warn('Categories Firestore notice:', err?.message || err);
    });

    const unsubItems = onSnapshot(
      query(collection(db, 'menu_items'), where('active', '==', true)),
      (snapshot) => {
        const items: MenuItem[] = [];
        snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() } as MenuItem));
        setMenuItems(items);
        localStorage.setItem('pos_local_menu_items', JSON.stringify(items));
      },
      (err) => {
        console.warn('Menu items Firestore notice:', err?.message || err);
      }
    );

    return () => {
      unsubCats();
      unsubItems();
    };
  }, [settings?.businessDayStart]);

  // Restore in-progress draft from Firestore on mount
  useEffect(() => {
    let isMounted = true;
    const restoreDraft = async () => {
      try {
        const draft = await getBillingDraft('pos', currentUser?.uid);
        if (draft && isMounted && draft.items && draft.items.length > 0) {
          setCart(draft.items);
          if (draft.orderType) setOrderType(draft.orderType);
          if (draft.priceType) setPriceType(draft.priceType);
          if (draft.tableNumber) setTableNumber(draft.tableNumber);
          if (draft.discount !== undefined) setDiscount(draft.discount);
          setAutoSaveStatus('saved');
          setNotification({
            type: 'success',
            message: `Restored ${draft.items.length} bill-in-progress item${draft.items.length > 1 ? 's' : ''}.`
          });
          setTimeout(() => setNotification(null), 3500);
        }
      } catch (err) {
        console.warn('POS Draft restoration notice:', err);
      } finally {
        if (isMounted) {
          setTimeout(() => {
            isInitialMount.current = false;
          }, 400);
        }
      }
    };

    restoreDraft();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid]);

  // Add Item to Cart
  const handleAddToCart = (item: MenuItem) => {
    const applicablePrice = BillingEngine.getApplicablePrice(item, priceType);
    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.itemId === item.id && i.priceType === priceType);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          totalPrice: BillingEngine.calculateItemTotal(applicablePrice, newQty)
        };
        return updated;
      }
      const newItem: CartItem = {
        itemId: item.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemNameTamil: item.itemNameTamil,
        quantity: 1,
        unitPrice: applicablePrice,
        totalPrice: applicablePrice,
        priceType
      };
      return [...prev, newItem];
    });
  };

  // Fast Item Code Search & Add (Enter key)
  const handleItemCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = itemCodeInput.trim();
    if (!code) return;
    const match = menuItems.find(
      (m) => m.itemCode.toLowerCase() === code.toLowerCase()
    );
    if (match) {
      handleAddToCart(match);
      setItemCodeInput('');
      setNotification({
        type: 'success',
        message: `Added #${match.itemCode} - ${match.itemName}`
      });
      setTimeout(() => setNotification(null), 2000);
    } else {
      setNotification({
        type: 'error',
        message: `Item code #${code} not found in menu.`
      });
      setTimeout(() => setNotification(null), 2500);
    }
  };

  // Handle Qty Update with Delete Confirmation if decreasing to 0
  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      const targetItem = cart[index];
      if (targetItem) {
        setDeleteConfirmItem({
          index,
          itemCode: targetItem.itemCode,
          name: targetItem.itemName,
          quantity: targetItem.quantity,
          price: targetItem.totalPrice
        });
      }
      return;
    }
    setCart((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: newQty,
        totalPrice: BillingEngine.calculateItemTotal(updated[index].unitPrice, newQty)
      };
      return updated;
    });
  };

  // Trigger Delete Confirmation for Cart Item
  const handleRequestRemoveFromCart = (index: number) => {
    const targetItem = cart[index];
    if (targetItem) {
      setDeleteConfirmItem({
        index,
        itemCode: targetItem.itemCode,
        name: targetItem.itemName,
        quantity: targetItem.quantity,
        price: targetItem.totalPrice
      });
    }
  };

  // Confirm Item Deletion
  const handleConfirmRemoveItem = () => {
    if (deleteConfirmItem !== null) {
      const idx = deleteConfirmItem.index;
      setCart((prev) => prev.filter((_, i) => i !== idx));
      setDeleteConfirmItem(null);
      setNotification({
        type: 'success',
        message: `Removed ${deleteConfirmItem.name} from cart.`
      });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  // Trigger Clear Cart Confirmation
  const handleRequestClearCart = () => {
    if (cart.length > 0) {
      setShowClearCartConfirm(true);
    }
  };

  // Confirm Clear Cart
  const handleConfirmClearCart = () => {
    setCart([]);
    setDiscount(0);
    setTableNumber('');
    setAutoSaveStatus('idle');
    clearBillingDraft('pos', currentUser?.uid);
    setShowClearCartConfirm(false);
    setNotification({
      type: 'success',
      message: 'Cart cleared successfully.'
    });
    setTimeout(() => setNotification(null), 2000);
  };

  // Switch Service Period with Dosa & Idly Persistence across Tiffin & Dinner only
  const handleSelectServicePeriod = (period: ServicePeriod) => {
    setActiveServicePeriod(period);

    if (period === 'LUNCH') {
      // In Lunch: Dosa and Idly are excluded and categories do not apply
      if (selectedCategory === 'cat_dosa' || selectedCategory === 'cat_idly') {
        const lCat = categories.find((c) => isLunchCategory(c));
        setSelectedCategory(lCat ? lCat.id : 'all');
      }
    } else if (period === 'TIFFIN' || period === 'DINNER') {
      // Across Tiffin and Dinner: if Dosa or Idly category is active, KEEP it persistent!
      if (selectedCategory === 'cat_dosa' || selectedCategory === 'cat_idly') {
        return;
      }
      if (period === 'TIFFIN') {
        const tCat = categories.find((c) => isTiffinCategory(c));
        if (tCat) setSelectedCategory(tCat.id);
      } else if (period === 'DINNER') {
        const dCat = categories.find((c) => isDinnerCategory(c));
        if (dCat) setSelectedCategory(dCat.id);
      }
    }
  };

  // Hold Order
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      setNotification({ type: 'error', message: 'Cart is empty. Nothing to hold.' });
      setTimeout(() => setNotification(null), 2500);
      return;
    }
    const newHeld: HeldOrder = {
      id: `held_${Date.now()}`,
      name: tableNumber ? `Table ${tableNumber}` : `${orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In'} #${heldBills.length + 1}`,
      items: [...cart],
      orderType,
      priceType,
      tableNumber,
      createdAt: Date.now()
    };
    const updated = [...heldBills, newHeld];
    setHeldBills(updated);
    safeStorage.setItem('pos_touch_held_bills', JSON.stringify(updated));
    setCart([]);
    setDiscount(0);
    setTableNumber('');
    setAutoSaveStatus('idle');
    clearBillingDraft('pos', currentUser?.uid);
    setNotification({ type: 'success', message: `Order held as "${newHeld.name}"` });
    setTimeout(() => setNotification(null), 3000);
  };

  // Restore Held Order
  const handleRestoreHeldBill = (id: string) => {
    const target = heldBills.find((h) => h.id === id);
    if (!target) return;
    setCart(target.items);
    setOrderType(target.orderType);
    setPriceType(target.priceType);
    setTableNumber(target.tableNumber || '');
    const updated = heldBills.filter((h) => h.id !== id);
    setHeldBills(updated);
    safeStorage.setItem('pos_touch_held_bills', JSON.stringify(updated));
    setShowHeldBillsModal(false);
    setNotification({ type: 'success', message: `Restored order "${target.name}"` });
    setTimeout(() => setNotification(null), 3000);
  };

  // Confirm Delete Held Order
  const handleConfirmDeleteHeldOrder = () => {
    if (deleteConfirmHeldId) {
      const updated = heldBills.filter((h) => h.id !== deleteConfirmHeldId);
      setHeldBills(updated);
      safeStorage.setItem('pos_touch_held_bills', JSON.stringify(updated));
      setDeleteConfirmHeldId(null);
      setNotification({ type: 'success', message: 'Held order removed.' });
      setTimeout(() => setNotification(null), 2000);
    }
  };

  // Save Order (without printing)
  const handleSaveOrder = async () => {
    if (cart.length === 0) {
      setNotification({ type: 'error', message: 'Cart is empty. Please add items before saving.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const prepared = await BillingEngine.prepareBill({
        items: cart,
        orderType,
        priceType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        discount,
        userId: currentUser?.uid || 'pos_user',
        userName: currentUser?.name || currentUser?.username || 'Staff Cashier',
        businessDayStart: settings?.businessDayStart || '04:00'
      });

      prepared.bill.paymentMethod = 'CASH';

      clearBillingDraft('pos', currentUser?.uid);
      setAutoSaveStatus('idle');

      setLastPrintedBill({ bill: prepared.bill, items: prepared.items });
      setSavedBill(prepared.bill);
      setSavedBillItems(prepared.items);

      setNotification({
        type: 'success',
        message: `Order #${prepared.bill.billNumber} Saved (₹${prepared.bill.grandTotal})`
      });
      setTimeout(() => setNotification(null), 4000);

      setCart([]);
      setDiscount(0);
      setTableNumber('');
      setMobileTab('catalog');

      BillingEngine.persistBillAsync(
        prepared.bill,
        prepared.items,
        undefined,
        currentUser?.uid || 'pos_user'
      ).catch((err) => {
        console.warn('POS background persist notice:', err);
      });
    } catch (err: any) {
      console.error('POS Bill Error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to save order' });
    } finally {
      setSaving(false);
    }
  };

  // Print Bill (Save & Print)
  const handlePrintBill = async () => {
    if (cart.length === 0) {
      setNotification({ type: 'error', message: 'Cart is empty. Please add items before printing.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const prepared = await BillingEngine.prepareBill({
        items: cart,
        orderType,
        priceType,
        tableNumber: orderType === 'DINE_IN' ? tableNumber : undefined,
        discount,
        userId: currentUser?.uid || 'pos_user',
        userName: currentUser?.name || currentUser?.username || 'Staff Cashier',
        businessDayStart: settings?.businessDayStart || '04:00'
      });

      prepared.bill.paymentMethod = 'CASH';

      clearBillingDraft('pos', currentUser?.uid);
      setAutoSaveStatus('idle');

      // Trigger Thermal Print
      PrinterService.printBill(prepared.bill, prepared.items, settings, true);

      setLastPrintedBill({ bill: prepared.bill, items: prepared.items });
      setSavedBill(prepared.bill);
      setSavedBillItems(prepared.items);

      setNotification({
        type: 'success',
        message: `Bill #${prepared.bill.billNumber} Saved & Printed (₹${prepared.bill.grandTotal})`
      });
      setTimeout(() => setNotification(null), 4000);

      // Reset for next customer
      setCart([]);
      setDiscount(0);
      setTableNumber('');
      setMobileTab('catalog');

      BillingEngine.persistBillAsync(
        prepared.bill,
        prepared.items,
        undefined,
        currentUser?.uid || 'pos_user'
      ).catch((err) => {
        console.warn('POS background persist notice:', err);
      });
    } catch (err: any) {
      console.error('POS Bill Error:', err);
      setNotification({ type: 'error', message: err.message || 'Failed to print bill' });
    } finally {
      setSaving(false);
    }
  };

  // Keyboard Shortcuts: Ctrl+Enter to Print, F8 Hold, F10 Save, Escape to Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (cart.length > 0 && !saving) {
          handlePrintBill();
        }
      }
      if (e.key === 'F8') {
        e.preventDefault();
        handleHoldOrder();
      }
      if (e.key === 'F10') {
        e.preventDefault();
        handleSaveOrder();
      }
      if (e.key === 'Escape') {
        if (showClearCartConfirm) {
          setShowClearCartConfirm(false);
        } else if (deleteConfirmItem !== null) {
          setDeleteConfirmItem(null);
        } else if (deleteConfirmHeldId !== null) {
          setDeleteConfirmHeldId(null);
        } else if (showHeldBillsModal) {
          setShowHeldBillsModal(false);
        } else if (cart.length > 0) {
          setShowClearCartConfirm(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, saving, showClearCartConfirm, deleteConfirmItem, deleteConfirmHeldId, showHeldBillsModal]);

  // Menu items filter - Dosa and Idly items are included only in Tiffin and Dinner
  const filteredItems = useMemo(() => {
    return filterPosMenuItems(menuItems, selectedCategory, categories, searchQuery, activeServicePeriod);
  }, [menuItems, selectedCategory, categories, searchQuery, activeServicePeriod]);

  const subtotal = BillingEngine.calculateSubtotal(cart);
  const grandTotal = BillingEngine.calculateGrandTotal(subtotal, discount);

  // Debounced Auto-save to Firestore & LocalStorage
  useEffect(() => {
    if (isInitialMount.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (cart.length === 0) {
      setAutoSaveStatus('idle');
      clearBillingDraft('pos', currentUser?.uid);
      return;
    }

    setAutoSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveBillingDraft({
          screen: 'pos',
          userId: currentUser?.uid,
          userName: currentUser?.name,
          orderType,
          priceType,
          tableNumber,
          items: cart,
          discount,
          subtotal,
          grandTotal
        });
        setAutoSaveStatus('saved');
      } catch (e) {
        console.warn('Auto-save draft note:', e);
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [cart, orderType, priceType, tableNumber, discount, subtotal, grandTotal, currentUser?.uid, currentUser?.name]);

  // Dosa & Idly persistent across only periods (Tiffin, Dinner) and All
  const isDosaIdlyPeriodAvailable = activeServicePeriod === 'TIFFIN' || activeServicePeriod === 'DINNER' || activeServicePeriod === 'ALL';

  const heldTarget = heldBills.find((h) => h.id === deleteConfirmHeldId);

  return (
    <div className="w-full h-full max-w-full flex flex-col overflow-hidden bg-slate-100 p-1.5 sm:p-2 gap-1.5 sm:gap-2 box-border select-none">
      
      {/* Toast Notification (Compact) */}
      {notification && (
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between shadow-2xs shrink-0 animate-in fade-in ${
          notification.type === 'success' 
            ? 'bg-emerald-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setNotification(null)}
            className="p-0.5 hover:bg-white/20 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile Tab Switcher (Catalog vs Cart) */}
      <div className="lg:hidden flex bg-white border border-slate-200 p-1 rounded-xl shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileTab('catalog')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'catalog'
              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Menu Products ({filteredItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
            mobileTab === 'cart'
              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</span>
          {cart.length > 0 && (
            <span className="font-mono text-[11px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-black ml-1">
              ₹{grandTotal}
            </span>
          )}
        </button>
      </div>

      {/* Main POS 2-Panel Area: Left Menu (70-75%) + Right Cart (25-30%) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 gap-2 overflow-hidden w-full">
        
        {/* LEFT / MAIN AREA: MENU & ITEM SELECTION (70% - 75%) */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden ${
          mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Top Controls Bar: Search, Code Entry, Service Period Selector, AC/Non-AC, Dine In/Take Away */}
          <div className="p-2 sm:p-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 shrink-0">
            
            {/* 1. Item Name Search */}
            <div className="relative flex-1 min-w-[130px] sm:min-w-[170px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search dish name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 2. Fast Item Code Search & Instant Enter to Add */}
            <form onSubmit={handleItemCodeSubmit} className="flex items-center gap-1 shrink-0">
              <div className="relative">
                <input
                  ref={itemCodeInputRef}
                  type="text"
                  placeholder="Code (e.g. 101)"
                  value={itemCodeInput}
                  onChange={(e) => setItemCodeInput(e.target.value)}
                  className="w-24 sm:w-28 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 placeholder-slate-400"
                />
              </div>
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Enter code & press Enter to add dish"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </form>

            {/* 3. Service Period Selector (Dosa & Idly persistent across Tiffin and Dinner only) */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 shrink-0">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1.5 hidden md:inline">
                Period:
              </span>
              {(['ALL', 'TIFFIN', 'LUNCH', 'DINNER'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => handleSelectServicePeriod(period)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    activeServicePeriod === period
                      ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title={
                    period === 'LUNCH'
                      ? 'Lunch / Meals Period (Dosa & Idly excluded)'
                      : period === 'ALL'
                      ? 'All Periods'
                      : `${period} Period (Dosa & Idly included)`
                  }
                >
                  {period === 'ALL' ? 'ALL' : period}
                </button>
              ))}
            </div>

            {/* 4. AC / Non-AC Switcher */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/80 shrink-0">
              <button
                type="button"
                onClick={() => setPriceType('NON_AC')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  priceType === 'NON_AC'
                    ? 'bg-white text-amber-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Non-AC
              </button>
              <button
                type="button"
                onClick={() => setPriceType('AC')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  priceType === 'AC'
                    ? 'bg-white text-amber-900 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                AC
              </button>
            </div>

            {/* 5. Dine In / Take Away Switcher */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg border border-slate-300/80 shrink-0">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  orderType === 'DINE_IN'
                    ? 'bg-blue-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dine In
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('TAKE_AWAY');
                  setTableNumber('');
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  orderType === 'TAKE_AWAY'
                    ? 'bg-blue-600 text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Take Away
              </button>
            </div>

            {/* 6. Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer shadow-2xs shrink-0"
              title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

          </div>

          {/* Quick Table Selection Bar when DINE_IN */}
          {orderType === 'DINE_IN' && (
            <div className="flex items-center gap-1 overflow-x-auto px-2 py-1 bg-white border-b border-slate-100 shrink-0 scrollbar-thin">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                Table:
              </span>
              {['T-1', 'T-2', 'T-3', 'T-4', 'T-5', 'T-6', 'T-7', 'T-8', 'T-9', 'T-10', 'T-11', 'T-12'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTableNumber(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer shrink-0 border ${
                    tableNumber === t
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Horizontal Scrolling Compact Category Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0 scrollbar-thin">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                if (activeServicePeriod === 'LUNCH') {
                  // Keep lunch filter
                } else {
                  setActiveServicePeriod('ALL');
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({filteredItems.length})
            </button>

            {/* Consolidated Quick Categories: 'Dosa' and 'Idly' persistent across only periods (Tiffin, Dinner) */}
            {isDosaIdlyPeriodAvailable &&
              CONSOLIDATED_POS_CATEGORIES.map((cCat) => {
                const count = getPosCategoryDishCount(cCat, menuItems);
                return (
                  <button
                    key={cCat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cCat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 flex items-center gap-1 ${
                      selectedCategory === cCat.id
                        ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                        : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    }`}
                    title={`${cCat.categoryName} (Available across Tiffin & Dinner periods)`}
                  >
                    <span>{cCat.categoryName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      selectedCategory === cCat.id ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-950'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}

            {/* All Menu Categories */}
            {categories.map((cat) => {
              const count = getPosCategoryDishCount(cat, menuItems);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (isTiffinCategory(cat)) setActiveServicePeriod('TIFFIN');
                    else if (isDinnerCategory(cat)) setActiveServicePeriod('DINNER');
                    else if (isLunchCategory(cat)) setActiveServicePeriod('LUNCH');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer border shrink-0 flex items-center gap-1 ${
                    selectedCategory === cat.id
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.categoryName}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded-full font-mono font-bold ${
                    selectedCategory === cat.id ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Product Cards Grid with Independent Scrolling */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {menuItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Utensils className="w-10 h-10 text-amber-500 mb-2" />
                <h4 className="font-bold text-sm text-slate-800">Menu is Empty</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Add dishes in Menu Management to begin billing.
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs">
                No dishes found matching {searchQuery ? `query "${searchQuery}"` : 'selected category/period'}.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {filteredItems.map((item) => {
                  const currentPrice = BillingEngine.getApplicablePrice(item, priceType);
                  const isDosaOrIdly = isDosaItem(item) || isIdlyItem(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className="bg-white hover:bg-amber-50/40 border border-slate-200 hover:border-amber-400 rounded-xl p-2 flex flex-col justify-between text-left transition-all group shadow-2xs hover:shadow-xs cursor-pointer active:scale-[0.98] min-h-[110px]"
                    >
                      <div className="flex items-center gap-2 w-full mb-1">
                        {/* Dish Image Thumbnail */}
                        <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.itemName}
                              className="w-full h-full object-cover rounded-md"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = DEFAULT_RESTAURANT_LOGO;
                              }}
                            />
                          ) : (
                            <Utensils className="w-5 h-5 text-amber-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[10px] bg-amber-100 text-amber-900 px-1 rounded border border-amber-300">
                              #{item.itemCode}
                            </span>
                            {isDosaOrIdly ? (
                              <span className="text-[8.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded truncate max-w-[70px]">
                                Tiffin/Dinner
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 truncate max-w-[65px]">{item.categoryName}</span>
                            )}
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-1 leading-tight mt-0.5 group-hover:text-amber-900">
                            {item.itemName}
                          </h4>
                          {item.itemNameTamil && (
                            <p className="text-[9px] text-slate-400 truncate leading-tight">
                              {item.itemNameTamil}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Prices: AC & Non-AC */}
                      <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between w-full font-mono text-[10.5px]">
                        <div className="flex items-center gap-1 truncate pr-1">
                          <span className={`${priceType === 'AC' ? 'font-black text-amber-950 bg-amber-100 px-1 rounded' : 'text-slate-500'}`}>
                            AC: ₹{item.acPrice}
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className={`${priceType === 'NON_AC' ? 'font-black text-amber-950 bg-amber-100 px-1 rounded' : 'text-slate-500'}`}>
                            Non-AC: ₹{item.nonAcPrice}
                          </span>
                        </div>
                        <div className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Bottom Cart Indicator on Mobile in Catalog view */}
          {cart.length > 0 && mobileTab === 'catalog' && (
            <div className="lg:hidden p-2 bg-white border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab('cart')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl shadow-lg flex items-center justify-between font-bold text-xs transition-all active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-100" />
                  <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items in Cart</span>
                </div>
                <div className="font-mono text-sm font-black">
                  <span>View Bill (₹{grandTotal}) →</span>
                </div>
              </button>
            </div>
          )}

        </div>

        {/* RIGHT / BILL AREA: CURRENT ORDER / CART (25% - 30%) */}
        <div className={`w-full lg:w-[320px] xl:w-[360px] 2xl:w-[400px] shrink-0 flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs ${
          mobileTab === 'cart' ? 'flex' : 'hidden lg:flex'
        }`}>
          
          {/* Cart Header */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">Customer Bill</span>
              <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {orderType === 'DINE_IN' && (
                <input
                  type="text"
                  placeholder="Table #"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-16 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                  title="Table Number"
                />
              )}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleRequestClearCart}
                  className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                  title="Clear Cart"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Table Headers */}
          <div className="grid grid-cols-[2.8rem_1fr_4.5rem_3.2rem_3.8rem_1.5rem] items-center px-2.5 py-1.5 bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 font-mono">
            <span>Code</span>
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Total</span>
            <span></span>
          </div>

          {/* Cart Items List (Independent scroll) */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100 px-2 py-0.5 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-slate-400 text-center p-4">
                <ShoppingBag className="w-8 h-8 text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600">Cart is empty</p>
                <p className="text-[11px] text-slate-400">Click products or enter item code</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.itemId}_${item.priceType}_${idx}`} className="grid grid-cols-[2.8rem_1fr_4.5rem_3.2rem_3.8rem_1.5rem] items-center py-1.5 gap-1 text-xs">
                  <span className="font-mono font-bold text-amber-800 text-[11px]">#{item.itemCode}</span>
                  <div className="min-w-0 pr-1">
                    <span className="font-bold text-slate-900 truncate block text-[11px] leading-tight">{item.itemName}</span>
                    <span className="text-[9px] text-slate-400 font-mono block leading-none">{item.priceType}</span>
                  </div>
                  
                  {/* Quantity Controls with Delete Confirmation on 0 */}
                  <div className="flex items-center justify-center gap-0.5 bg-slate-100 rounded p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                      className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                      title={item.quantity === 1 ? 'Remove item (confirm)' : 'Decrease quantity'}
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-[11px] min-w-[14px] text-center text-slate-900">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                      className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-mono text-right text-[11px] text-slate-600">₹{item.unitPrice}</span>
                  <span className="font-mono text-right text-[11px] font-black text-slate-900">₹{item.totalPrice}</span>
                  
                  {/* Delete Item with Confirmation */}
                  <button
                    type="button"
                    onClick={() => handleRequestRemoveFromCart(idx)}
                    className="text-slate-300 hover:text-red-600 p-0.5 flex justify-center cursor-pointer transition-colors"
                    title="Delete item (requires confirmation)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Flexible Empty Space */}
          <div className="flex-1 min-h-0" />

          {/* Totals Section (Fixed at bottom - NO TAX, NO PAYMENT SECTION) */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Subtotal ({cart.reduce((s, i) => s + i.quantity, 0)} items):</span>
                <span className="font-mono font-bold text-slate-900 text-sm">₹{subtotal}</span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                <span className="font-black text-sm text-slate-900 uppercase">Grand Total:</span>
                <span className="font-mono text-2xl font-black text-emerald-700">₹{grandTotal}</span>
              </div>
            </div>

            {/* Compact Action Buttons */}
            <div className="grid grid-cols-4 gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={handleHoldOrder}
                disabled={cart.length === 0}
                className="py-2 px-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs transition-colors"
                title="Hold current order (F8)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px]">Hold</span>
              </button>

              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={cart.length === 0 || saving}
                className="py-2 px-1 rounded-lg text-xs font-bold bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-800 border border-blue-200 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-2xs transition-colors"
                title="Save order without printing (F10)"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-[10px]">{saving ? '...' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrintBill}
                disabled={cart.length === 0 || saving}
                className="col-span-2 py-2 px-2 rounded-lg text-xs font-black bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
                title="Save & Print Bill (Ctrl + Enter)"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span className="truncate">{saving ? 'Printing...' : 'Print Bill (Ctrl+↵)'}</span>
              </button>
            </div>

            {/* Cancel & Held Orders Bar */}
            <div className="flex justify-between items-center pt-0.5 text-[11px]">
              <button
                type="button"
                onClick={handleRequestClearCart}
                disabled={cart.length === 0}
                className="text-red-600 hover:text-red-700 hover:underline disabled:opacity-30 cursor-pointer font-semibold flex items-center gap-1"
                title="Cancel order (requires confirmation)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Cancel Order [Esc]</span>
              </button>
              {heldBills.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHeldBillsModal(true)}
                  className="text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-bold text-[10px] cursor-pointer flex items-center gap-1"
                >
                  <Layers className="w-3 h-3 text-amber-600" />
                  <span>Held ({heldBills.length})</span>
                </button>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Held Orders Modal */}
      {showHeldBillsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 max-w-md w-full space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Held Orders ({heldBills.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHeldBillsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 space-y-1">
              {heldBills.map((hb) => (
                <div key={hb.id} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900">{hb.name}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {hb.items.length} items • {hb.priceType} • {new Date(hb.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRestoreHeldBill(hb.id)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-xs cursor-pointer"
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmHeldId(hb.id)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      title="Delete held order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* On-screen Thermal Receipt Preview Modal */}
      {isReceiptModalOpen && savedBill && (
        <ThermalReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          bill={savedBill}
          items={savedBillItems}
          settings={settings}
        />
      )}

      {/* Delete Cart Item Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmItem !== null}
        onClose={() => setDeleteConfirmItem(null)}
        onConfirm={handleConfirmRemoveItem}
        title="Remove Item from Order"
        itemName={deleteConfirmItem?.name || ''}
        itemSubtitle={deleteConfirmItem ? `Item #${deleteConfirmItem.itemCode} • Qty: ${deleteConfirmItem.quantity} • Total: ₹${deleteConfirmItem.price}` : undefined}
        description="Are you sure you want to remove this dish from the active bill?"
        warningNote="This dish will be removed from current order total."
        confirmButtonText="Remove Dish"
      />

      {/* Clear Entire Cart Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showClearCartConfirm}
        onClose={() => setShowClearCartConfirm(false)}
        onConfirm={handleConfirmClearCart}
        title="Cancel & Clear Order"
        itemName={`All ${cart.length} item(s) in cart`}
        itemSubtitle={`Current Order Total: ₹${grandTotal}`}
        description="Are you sure you want to clear the entire order cart? All entered items will be removed."
        warningNote="This action cannot be undone. A fresh customer bill will be started."
        confirmButtonText="Clear Entire Cart"
      />

      {/* Delete Held Order Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteConfirmHeldId !== null}
        onClose={() => setDeleteConfirmHeldId(null)}
        onConfirm={handleConfirmDeleteHeldOrder}
        title="Delete Held Order"
        itemName={heldTarget?.name || 'Held Order'}
        itemSubtitle={heldTarget ? `${heldTarget.items.length} items • ${heldTarget.priceType}` : undefined}
        description="Are you sure you want to discard this held order from saved memory?"
        warningNote="This held order will be deleted permanently."
        confirmButtonText="Delete Held Order"
      />

    </div>
  );
};
