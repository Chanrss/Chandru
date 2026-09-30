import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  CheckCircle, 
  AlertCircle, 
  FolderPlus, 
  Layers, 
  Eye, 
  EyeOff, 
  Save, 
  X,
  RefreshCw,
  Sparkles,
  RotateCcw,
  IndianRupee,
  LayoutGrid,
  List,
  Check,
  Tag,
  ArrowUpDown,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Category, MenuItem } from '../../types';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../services/firebase';
import { getTamilItemName, suggestTamilName } from '../../services/tamilTranslation';
import { DEFAULT_FALLBACK_MENU_ITEMS, DEFAULT_CATEGORIES } from '../../data/fallbackMenu';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';

export const MenuManagement: React.FC = () => {
  const { isOwner, isManager } = useAuth();

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const stored = localStorage.getItem('pos_local_categories');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
    try {
      const stored = localStorage.getItem('pos_local_menu_items');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [clearingAll, setClearingAll] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Quick Price Edit inline state: { [itemId]: { nonAcPrice: string; acPrice: string } }
  const [quickPriceEditingId, setQuickPriceEditingId] = useState<string | null>(null);
  const [inlinePriceForm, setInlinePriceForm] = useState({ nonAcPrice: '', acPrice: '' });

  // Menu Item Modal State
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState({
    itemCode: '',
    itemName: '',
    itemNameTamil: '',
    categoryId: '',
    nonAcPrice: '',
    acPrice: '',
    imageUrl: '',
    active: true
  });

  // Category Modal State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    categoryName: '',
    categoryCode: '',
    displayOrder: '1',
    active: true
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Deletion Confirmation Modal State
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    itemName: string;
    itemSubtitle?: string;
    description?: string;
    warningNote?: string;
    confirmButtonText?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    itemName: '',
    onConfirm: () => {}
  });
  const [isExecutingDelete, setIsExecutingDelete] = useState(false);

  // Firestore listeners for Real-time sync
  useEffect(() => {
    const unsubCats = onSnapshot(collection(db, 'categories'), (snap) => {
      const list: Category[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Category));
      // Store in state & localStorage (never re-inject fallback automatically)
      const sorted = list.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
      setCategories(sorted);
      localStorage.setItem('pos_local_categories', JSON.stringify(sorted));
    }, (err) => {
      console.warn('Menu categories Firestore listener notice:', err?.message || err);
    });

    const unsubItems = onSnapshot(collection(db, 'menu_items'), (snap) => {
      const list: MenuItem[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MenuItem));
      // Store in state & localStorage (never re-inject fallback automatically)
      setMenuItems(list);
      localStorage.setItem('pos_local_menu_items', JSON.stringify(list));
    }, (err) => {
      console.warn('Menu items Firestore listener notice:', err?.message || err);
    });

    return () => {
      unsubCats();
      unsubItems();
    };
  }, []);

  // Quick Inline Price Editing
  const startQuickPriceEdit = (item: MenuItem) => {
    setQuickPriceEditingId(item.id);
    setInlinePriceForm({
      nonAcPrice: item.nonAcPrice.toString(),
      acPrice: item.acPrice.toString()
    });
  };

  const cancelQuickPriceEdit = () => {
    setQuickPriceEditingId(null);
  };

  const saveQuickPriceEdit = async (item: MenuItem) => {
    const nonAc = parseFloat(inlinePriceForm.nonAcPrice);
    const ac = parseFloat(inlinePriceForm.acPrice);

    if (isNaN(nonAc) || isNaN(ac) || nonAc < 0 || ac < 0) {
      setNotification({ type: 'error', message: 'Please enter valid non-negative prices.' });
      return;
    }

    try {
      await updateDoc(doc(db, 'menu_items', item.id), {
        nonAcPrice: nonAc,
        acPrice: ac,
        updatedAt: Date.now()
      });
      setMenuItems((prev) => 
        prev.map((m) => m.id === item.id ? { ...m, nonAcPrice: nonAc, acPrice: ac, updatedAt: Date.now() } : m)
      );
      setQuickPriceEditingId(null);
      setNotification({ 
        type: 'success', 
        message: `Updated price for "${item.itemName}": Non-AC ₹${nonAc}, AC ₹${ac}` 
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to update price.' });
    }
  };

  // Item Handlers
  const openNewItemModal = () => {
    setEditingItem(null);
    // Suggest next numeric item code
    const codes = menuItems.map(i => parseInt(i.itemCode, 10)).filter(n => !isNaN(n));
    const nextCode = codes.length > 0 ? (Math.max(...codes) + 1).toString() : '1';

    setItemForm({
      itemCode: nextCode,
      itemName: '',
      itemNameTamil: '',
      categoryId: categories[0]?.id || '',
      nonAcPrice: '',
      acPrice: '',
      imageUrl: '',
      active: true
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemNameTamil: item.itemNameTamil || '',
      categoryId: item.categoryId,
      nonAcPrice: item.nonAcPrice.toString(),
      acPrice: item.acPrice.toString(),
      imageUrl: item.imageUrl || '',
      active: item.active !== false
    });
    setItemModalOpen(true);
  };

  const handleItemNameChange = (val: string) => {
    setItemForm((prev) => {
      const suggested = suggestTamilName(val);
      return {
        ...prev,
        itemName: val,
        itemNameTamil: prev.itemNameTamil && prev.itemNameTamil !== '' ? prev.itemNameTamil : suggested
      };
    });
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.itemCode.trim() || !itemForm.itemName.trim() || !itemForm.nonAcPrice || !itemForm.acPrice) {
      setNotification({ type: 'error', message: 'Please fill in all required fields (Name, Code, Prices).' });
      return;
    }

    const nonAc = parseFloat(itemForm.nonAcPrice);
    const ac = parseFloat(itemForm.acPrice);
    if (isNaN(nonAc) || isNaN(ac) || nonAc < 0 || ac < 0) {
      setNotification({ type: 'error', message: 'Please enter valid non-negative prices.' });
      return;
    }

    // Check unique code
    const existingCode = menuItems.find(
      (m) => m.itemCode.toUpperCase() === itemForm.itemCode.trim().toUpperCase() && m.id !== editingItem?.id
    );
    if (existingCode) {
      setNotification({ type: 'error', message: `Item code "${itemForm.itemCode}" is already in use by "${existingCode.itemName}".` });
      return;
    }

    setSaving(true);
    try {
      const targetCategory = categories.find((c) => c.id === itemForm.categoryId);
      const itemId = editingItem ? editingItem.id : `item_${itemForm.itemCode.trim().toLowerCase()}_${Date.now()}`;
      const now = Date.now();

      const itemData: MenuItem = {
        id: itemId,
        itemCode: itemForm.itemCode.trim().toUpperCase(),
        itemName: itemForm.itemName.trim(),
        itemNameTamil: itemForm.itemNameTamil.trim() || getTamilItemName(itemForm.itemName.trim()),
        categoryId: itemForm.categoryId || (categories[0]?.id || 'general'),
        categoryName: targetCategory?.categoryName || 'General',
        nonAcPrice: nonAc,
        acPrice: ac,
        active: itemForm.active,
        createdAt: editingItem?.createdAt || now,
        updatedAt: now
      };

      if (itemForm.imageUrl && itemForm.imageUrl.trim()) {
        itemData.imageUrl = itemForm.imageUrl.trim();
      }

      await setDoc(doc(db, 'menu_items', itemId), sanitizeForFirestore(itemData));
      
      setMenuItems((prev) => {
        const updated = [...prev.filter((m) => m.id !== itemId), itemData];
        localStorage.setItem('pos_local_menu_items', JSON.stringify(updated));
        return updated;
      });

      setItemModalOpen(false);
      setNotification({
        type: 'success',
        message: `Dish "${itemData.itemName}" saved successfully.`
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save dish.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (item: MenuItem) => {
    setDeleteModalConfig({
      isOpen: true,
      title: 'Delete Menu Item',
      itemName: item.itemName,
      itemSubtitle: `Code: #${item.itemCode} • Price: Non-AC ₹${item.nonAcPrice} / AC ₹${item.acPrice || item.nonAcPrice}`,
      description: `Are you sure you want to permanently remove "${item.itemName}" from your restaurant catalog?`,
      warningNote: 'This item will be removed immediately from POS and Direct Billing dish listings.',
      confirmButtonText: 'Delete Dish',
      onConfirm: async () => {
        setIsExecutingDelete(true);
        try {
          await deleteDoc(doc(db, 'menu_items', item.id));
          setMenuItems((prev) => {
            const updated = prev.filter((m) => m.id !== item.id);
            localStorage.setItem('pos_local_menu_items', JSON.stringify(updated));
            return updated;
          });
          setNotification({ type: 'success', message: `Dish "${item.itemName}" deleted successfully.` });
          setTimeout(() => setNotification(null), 3000);
          setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setNotification({ type: 'error', message: 'Failed to delete dish.' });
        } finally {
          setIsExecutingDelete(false);
        }
      }
    });
  };

  const handleToggleItemStatus = async (item: MenuItem) => {
    try {
      await updateDoc(doc(db, 'menu_items', item.id), {
        active: !item.active,
        updatedAt: Date.now()
      });
      setMenuItems((prev) => {
        const updated = prev.map((m) => m.id === item.id ? { ...m, active: !item.active, updatedAt: Date.now() } : m);
        localStorage.setItem('pos_local_menu_items', JSON.stringify(updated));
        return updated;
      });
      setNotification({
        type: 'success',
        message: `Dish "${item.itemName}" is now ${!item.active ? 'Active' : 'Disabled'}.`
      });
      setTimeout(() => setNotification(null), 2500);
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to update dish status.' });
    }
  };

  // Category Handlers
  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      categoryName: '',
      categoryCode: '',
      displayOrder: (categories.length + 1).toString(),
      active: true
    });
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      categoryName: cat.categoryName || '',
      categoryCode: cat.categoryCode || '',
      displayOrder: (cat.displayOrder !== undefined ? cat.displayOrder : 1).toString(),
      active: cat.active !== false
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.categoryName.trim()) {
      setNotification({ type: 'error', message: 'Category name is required.' });
      return;
    }

    setSaving(true);
    try {
      const catId = editingCategory ? editingCategory.id : `cat_${Date.now()}`;
      const now = Date.now();

      const catData: Category = {
        id: catId,
        categoryCode: categoryForm.categoryCode.trim().toUpperCase() || categoryForm.categoryName.trim().toUpperCase().slice(0, 4),
        categoryName: categoryForm.categoryName.trim(),
        displayOrder: parseInt(categoryForm.displayOrder, 10) || 1,
        active: categoryForm.active,
        createdAt: editingCategory?.createdAt || now,
        updatedAt: now
      };

      await setDoc(doc(db, 'categories', catId), sanitizeForFirestore(catData));
      
      setCategories((prev) => {
        const updated = [...prev.filter((c) => c.id !== catId), catData].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        localStorage.setItem('pos_local_categories', JSON.stringify(updated));
        return updated;
      });

      setCategoryModalOpen(false);
      setNotification({
        type: 'success',
        message: `Category "${catData.categoryName}" saved.`
      });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to save category.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    const assignedItems = menuItems.filter((m) => m.categoryId === cat.id);
    const hasAssigned = assignedItems.length > 0;

    setDeleteModalConfig({
      isOpen: true,
      title: 'Delete Category',
      itemName: cat.categoryName,
      itemSubtitle: `Code: ${cat.categoryCode || 'N/A'} • ${assignedItems.length} dishes attached`,
      description: hasAssigned 
        ? `Category "${cat.categoryName}" currently has ${assignedItems.length} dish${assignedItems.length > 1 ? 'es' : ''} assigned to it. Deleting this category will keep those dishes in your catalog as Uncategorized.`
        : `Are you sure you want to permanently delete category "${cat.categoryName}"?`,
      warningNote: hasAssigned
        ? 'Assigned dishes will remain preserved in your menu under General/Uncategorized.'
        : 'This action cannot be undone.',
      confirmButtonText: 'Delete Category',
      onConfirm: async () => {
        setIsExecutingDelete(true);
        try {
          await deleteDoc(doc(db, 'categories', cat.id));
          setCategories((prev) => {
            const updated = prev.filter((c) => c.id !== cat.id);
            localStorage.setItem('pos_local_categories', JSON.stringify(updated));
            return updated;
          });
          setNotification({ type: 'success', message: `Category "${cat.categoryName}" deleted.` });
          setTimeout(() => setNotification(null), 3000);
          setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (e) {
          setNotification({ type: 'error', message: 'Failed to delete category.' });
        } finally {
          setIsExecutingDelete(false);
        }
      }
    });
  };

  // Complete Clear All Menu & Categories (User can start completely manual)
  const handleClearAllMenuData = () => {
    setDeleteModalConfig({
      isOpen: true,
      title: 'Wipe All Dishes & Categories',
      itemName: `All Menu Items (${menuItems.length}) & Categories (${categories.length})`,
      itemSubtitle: 'Complete Catalog Reset',
      description: 'This will completely wipe all dishes and categories from both the cloud database and local storage so you can enter your restaurant menu manually from scratch.',
      warningNote: 'CRITICAL: This action is permanent and cannot be undone. All custom pricing and categories will be cleared.',
      confirmButtonText: 'Wipe Entire Menu',
      onConfirm: async () => {
        setIsExecutingDelete(true);
        setClearingAll(true);
        try {
          // 1. Delete all menu_items
          const itemSnaps = await getDocs(collection(db, 'menu_items'));
          const batch1 = writeBatch(db);
          itemSnaps.forEach((d) => batch1.delete(d.ref));
          await batch1.commit();

          // 2. Delete all categories
          const catSnaps = await getDocs(collection(db, 'categories'));
          const batch2 = writeBatch(db);
          catSnaps.forEach((d) => batch2.delete(d.ref));
          await batch2.commit();

          // 3. Clear local storage
          localStorage.setItem('pos_local_menu_items', JSON.stringify([]));
          localStorage.setItem('pos_local_categories', JSON.stringify([]));

          setMenuItems([]);
          setCategories([]);
          setSelectedCategory('all');

          setNotification({ 
            type: 'success', 
            message: 'All dishes and categories cleared. You can now add categories and items manually!' 
          });
          setTimeout(() => setNotification(null), 5000);
          setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          setNotification({ type: 'error', message: err.message || 'Error clearing menu.' });
        } finally {
          setClearingAll(false);
          setIsExecutingDelete(false);
        }
      }
    });
  };

  // Optional Template: Load 170 Tamil dishes if user ever requests it
  const handleLoadSampleMenu = async () => {
    if (!window.confirm('Load standard Indian / Tamil restaurant menu template (170 items, 7 categories)?')) {
      return;
    }

    setLoadingDefaults(true);
    try {
      for (const cat of DEFAULT_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), sanitizeForFirestore(cat));
      }
      for (const item of DEFAULT_FALLBACK_MENU_ITEMS) {
        await setDoc(doc(db, 'menu_items', item.id), sanitizeForFirestore(item));
      }
      setCategories(DEFAULT_CATEGORIES);
      setMenuItems(DEFAULT_FALLBACK_MENU_ITEMS);
      localStorage.setItem('pos_local_categories', JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('pos_local_menu_items', JSON.stringify(DEFAULT_FALLBACK_MENU_ITEMS));

      setNotification({ 
        type: 'success', 
        message: `Loaded ${DEFAULT_FALLBACK_MENU_ITEMS.length} dishes and ${DEFAULT_CATEGORIES.length} categories.` 
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to load sample menu.' });
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCat = selectedCategory === 'all' || item.categoryId === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        item.itemCode.toLowerCase().includes(q) || 
        item.itemName.toLowerCase().includes(q) ||
        (item.itemNameTamil && item.itemNameTamil.includes(q));
      return matchesCat && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  return (
    <div className="flex flex-col min-h-full bg-slate-100/90 text-slate-800 p-2 sm:p-4 gap-3 sm:gap-4 overflow-y-auto pb-24 md:pb-6 font-sans">
      
      {/* 1. Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-3 gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Utensils className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base tracking-tight text-slate-900 uppercase leading-none">
                Menu & Category Management
              </h2>
              <span className="hidden sm:inline-block text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Live Pricing Control
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Add dishes, edit prices instantly, and organize categories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Clear all dishes & categories */}
          {(menuItems.length > 0 || categories.length > 0) && (
            <button
              type="button"
              onClick={handleClearAllMenuData}
              disabled={clearingAll}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Remove all dishes and categories to start manually"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${clearingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{clearingAll ? 'Clearing...' : 'Clear All Menu & Categories'}</span>
              <span className="sm:hidden">Clear All</span>
            </button>
          )}

          {/* Load Sample Menu if completely blank */}
          {menuItems.length === 0 && (
            <button
              type="button"
              onClick={handleLoadSampleMenu}
              disabled={loadingDefaults}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              title="Load 170 standard Indian / Tamil dishes template"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <span>{loadingDefaults ? 'Loading...' : 'Load Sample Template'}</span>
            </button>
          )}

          {/* Add Category Button */}
          <button
            type="button"
            onClick={openNewCategoryModal}
            className="px-3 py-1.5 sm:py-2 bg-slate-800 hover:bg-slate-900 active:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-amber-400" />
            <span>Add Category</span>
          </button>

          {/* Add Item Button */}
          <button
            type="button"
            onClick={openNewItemModal}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs animate-in fade-in shrink-0 ${
          notification.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 2. Sub-tab Switcher: Dishes vs Categories */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-2xs shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'items'
              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Menu Dishes ({menuItems.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-amber-500 text-slate-950 font-black shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Categories ({categories.length})</span>
        </button>
      </div>

      {/* 3. DISHES TAB */}
      {activeTab === 'items' && (
        <div className="flex flex-col gap-3">
          
          {/* Search, Category Filter & View Mode Controls */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search dish by name, Tamil name, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">View:</span>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'cards' 
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  viewMode === 'table' 
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>

          {/* Horizontal Category Filter Pills with Smooth Scroll */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-amber-600 text-white shadow-2xs font-black'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All Dishes ({menuItems.length})
              </button>

              {categories.map((c) => {
                const count = menuItems.filter((m) => m.categoryId === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      selectedCategory === c.id
                        ? 'bg-amber-600 text-white shadow-2xs font-black'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {c.categoryName} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* EMPTY STATE */}
          {menuItems.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
                <Utensils className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">Your Menu is Empty</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1 mb-5">
                All pre-loaded items have been removed. Add your restaurant's categories and dishes manually, with custom AC and Non-AC prices that you can change anytime!
              </p>
              <div className="flex flex-wrap items-center gap-2 justify-center">
                <button
                  type="button"
                  onClick={openNewCategoryModal}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-amber-400" />
                  <span>1. Add First Category</span>
                </button>
                <button
                  type="button"
                  onClick={openNewItemModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>2. Add First Dish</span>
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
              No dishes match category or search query "{searchQuery}".
            </div>
          ) : viewMode === 'cards' ? (
            /* Responsive Cards Grid for Mobile & PC with Quick Price Edit */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const isQuickEditing = quickPriceEditingId === item.id;
                const catName = categories.find((c) => c.id === item.categoryId)?.categoryName || item.categoryName || 'General';

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow ${
                      item.active === false ? 'opacity-60 bg-slate-50 border-slate-200' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top: Item Code & Category */}
                      <div className="flex items-center justify-between gap-1 text-[11px] mb-1">
                        <span className="font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          #{item.itemCode}
                        </span>
                        <span className="text-slate-400 font-medium truncate max-w-[130px]">
                          {catName}
                        </span>
                      </div>

                      {/* Dish Names */}
                      <h4 className="font-extrabold text-sm text-slate-900 mt-1 leading-snug">
                        {item.itemName}
                      </h4>
                      {item.itemNameTamil && (
                        <div className="text-xs text-slate-500 font-semibold mt-0.5">
                          {item.itemNameTamil}
                        </div>
                      )}

                      {/* Price Section with Quick Inline Editing */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        {isQuickEditing ? (
                          /* Inline Price Form */
                          <div className="bg-amber-50/70 border border-amber-300 p-2 rounded-lg space-y-2 animate-in fade-in">
                            <div className="text-[10px] font-extrabold text-amber-900 uppercase">
                              Edit Dish Prices:
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Non-AC (₹)</label>
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlinePriceForm.nonAcPrice}
                                  onChange={(e) => setInlinePriceForm({ ...inlinePriceForm, nonAcPrice: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">AC (₹)</label>
                                <input
                                  type="number"
                                  value={inlinePriceForm.acPrice}
                                  onChange={(e) => setInlinePriceForm({ ...inlinePriceForm, acPrice: e.target.value })}
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={cancelQuickPriceEdit}
                                className="px-2 py-1 text-[11px] bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveQuickPriceEdit(item)}
                                className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal Price Display with Quick Edit Trigger */
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="bg-slate-100 px-2 py-1 rounded-md">
                                <span className="text-[10px] text-slate-400 block font-medium">Non-AC</span>
                                <span className="text-xs font-black text-slate-900 font-mono">₹{item.nonAcPrice}</span>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                                <span className="text-[10px] text-amber-700 block font-medium">AC</span>
                                <span className="text-xs font-black text-amber-900 font-mono">₹{item.acPrice}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => startQuickPriceEdit(item)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Edit price instantly"
                            >
                              <IndianRupee className="w-3 h-3 text-amber-700" />
                              <span>Edit Price</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          item.active !== false
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                            : 'text-slate-500 bg-slate-100 hover:bg-slate-200'
                        }`}
                      >
                        {item.active !== false ? '● Active' : '○ Disabled'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditItemModal(item)}
                          className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Delete dish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* High Density Table View with Quick Price Edit */
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Dish Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Non-AC Price</th>
                      <th className="py-2.5 px-3">AC Price</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item) => {
                      const isQuickEditing = quickPriceEditingId === item.id;
                      const catName = categories.find((c) => c.id === item.categoryId)?.categoryName || item.categoryName || 'General';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-800">
                            #{item.itemCode}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900">{item.itemName}</div>
                            {item.itemNameTamil && (
                              <div className="text-[11px] text-slate-500">{item.itemNameTamil}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {catName}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold">
                            {isQuickEditing ? (
                              <input
                                type="number"
                                value={inlinePriceForm.nonAcPrice}
                                onChange={(e) => setInlinePriceForm({ ...inlinePriceForm, nonAcPrice: e.target.value })}
                                className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900"
                              />
                            ) : (
                              <span>₹{item.nonAcPrice}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
                            {isQuickEditing ? (
                              <input
                                type="number"
                                value={inlinePriceForm.acPrice}
                                onChange={(e) => setInlinePriceForm({ ...inlinePriceForm, acPrice: e.target.value })}
                                className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-900"
                              />
                            ) : (
                              <span>₹{item.acPrice}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleItemStatus(item)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                                item.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {item.active !== false ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isQuickEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => saveQuickPriceEdit(item)}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelQuickPriceEdit}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[11px] font-bold cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startQuickPriceEdit(item)}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold cursor-pointer"
                                >
                                  Edit Price
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditItemModal(item)}
                                  className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                                  title="Full Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-2xs">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Restaurant Menu Categories</h3>
              <p className="text-xs text-slate-500">Categories group dishes on Direct Billing and POS screens</p>
            </div>
            <button
              type="button"
              onClick={openNewCategoryModal}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>

          {categories.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No categories created yet. Click "Add Category" above to create your first category (e.g. Hot Drinks, Tiffin, Meals).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const assignedItems = menuItems.filter((m) => m.categoryId === cat.id);

                return (
                  <div key={cat.id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-bold text-slate-400">Order #{cat.displayOrder || 1}</span>
                        <span className="font-mono font-black text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px]">
                          {cat.categoryCode || 'CAT'}
                        </span>
                      </div>
                      <h4 className="font-black text-base text-slate-900">{cat.categoryName}</h4>
                      <div className="text-xs text-slate-500 mt-1 font-semibold">
                        {assignedItems.length} dishes in this category
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cat.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {cat.active !== false ? 'Active' : 'Disabled'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditCategoryModal(cat)}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Add / Edit Menu Item */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  {editingItem ? <Edit3 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {editingItem ? `Edit Dish: ${editingItem.itemName}` : 'Add New Restaurant Dish'}
                </h3>
              </div>
              <button onClick={() => setItemModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">
                    ITEM CODE <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1"
                    value={itemForm.itemCode}
                    onChange={(e) => setItemForm({ ...itemForm, itemCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    CATEGORY <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={itemForm.categoryId}
                      onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.categoryName}</option>
                      ))}
                      {categories.length === 0 && (
                        <option value="">No categories created yet</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  DISH NAME (ENGLISH) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Ghee Masala Roast"
                  value={itemForm.itemName}
                  onChange={(e) => handleItemNameChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  DISH NAME IN TAMIL (AUTO-SUGGESTED / EDITABLE)
                </label>
                <input
                  type="text"
                  placeholder="e.g. நெய் மசால் தோசை"
                  value={itemForm.itemNameTamil}
                  onChange={(e) => setItemForm({ ...itemForm, itemNameTamil: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              {/* Prices Section */}
              <div className="bg-amber-50/60 border border-amber-200/80 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-900 text-xs">PRICE SPECIFICATION (₹)</span>
                  <button
                    type="button"
                    onClick={() => setItemForm((prev) => ({ ...prev, acPrice: prev.nonAcPrice }))}
                    className="text-[11px] font-bold text-amber-800 underline cursor-pointer"
                  >
                    Set AC = Non-AC
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      NON-AC PRICE (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 50"
                      value={itemForm.nonAcPrice}
                      onChange={(e) => setItemForm({ ...itemForm, nonAcPrice: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-base font-black focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      AC PRICE (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 60"
                      value={itemForm.acPrice}
                      onChange={(e) => setItemForm({ ...itemForm, acPrice: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-base font-black focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="item-active-check"
                  checked={itemForm.active}
                  onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="item-active-check" className="font-bold text-slate-700 cursor-pointer">
                  Dish is available on menu for billing and KOT orders
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingItem ? 'Save Dish Changes' : 'Save New Dish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Category */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingCategory ? `Edit Category: ${editingCategory.categoryName}` : 'Add Menu Category'}
              </h3>
              <button onClick={() => setCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  CATEGORY NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tiffin & Breakfast, Hot Drinks, Meals"
                  value={categoryForm.categoryName}
                  onChange={(e) => setCategoryForm({ ...categoryForm, categoryName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    SHORT CODE
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. TIF"
                    value={categoryForm.categoryCode}
                    onChange={(e) => setCategoryForm({ ...categoryForm, categoryCode: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    DISPLAY ORDER
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={categoryForm.displayOrder}
                    onChange={(e) => setCategoryForm({ ...categoryForm, displayOrder: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cat-active-check"
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="cat-active-check" className="font-bold text-slate-700 cursor-pointer">
                  Category is active and visible in billing tabs
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Menu Items, Categories, and Catalog Reset */}
      <DeleteConfirmationModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={deleteModalConfig.onConfirm}
        title={deleteModalConfig.title}
        itemName={deleteModalConfig.itemName}
        itemSubtitle={deleteModalConfig.itemSubtitle}
        description={deleteModalConfig.description}
        warningNote={deleteModalConfig.warningNote}
        confirmButtonText={deleteModalConfig.confirmButtonText}
        isDeleting={isExecutingDelete}
      />

    </div>
  );
};
