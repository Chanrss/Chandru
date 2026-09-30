import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Check, 
  X, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  Save,
  Key,
  Edit2,
  Trash2,
  Phone,
  Mail,
  UserCheck,
  UserX,
  Search,
  RotateCcw,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { User, Role, UserRole } from '../../types';
import { collection, onSnapshot, setDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DeleteConfirmationModal } from '../common/DeleteConfirmationModal';

const SYSTEM_ROLES: Role[] = [
  { id: 'owner', name: 'Owner / Administrator', permissions: ['all'], active: true },
  { id: 'manager', name: 'Restaurant Manager', permissions: ['billing', 'reports', 'inventory', 'menu'], active: true },
  { id: 'waiter', name: 'Floor Waiter', permissions: ['kot', 'billing_view'], active: true }
];

export const UserManagement: React.FC = () => {
  const { isOwner, firebaseUser, currentUser } = useAuth();

  // Helper to load clean initial users (clearing out any legacy dummy employees or deleted accounts)
  const getInitialUsers = (): User[] => {
    try {
      let deletedIds: string[] = [];
      const rawDeleted = localStorage.getItem('pos_deleted_user_ids');
      if (rawDeleted) {
        try {
          deletedIds = JSON.parse(rawDeleted);
        } catch (e) {}
      }

      const stored = localStorage.getItem('pos_local_users');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filter out legacy dummy users and deleted users
          const clean = parsed.filter(
            (u: any) =>
              !u.deleted &&
              !deletedIds.includes(u.uid) &&
              !['user_owner', 'user_manager', 'user_cashier', 'user_waiter1'].includes(u.uid)
          );
          if (clean.length !== parsed.length) {
            localStorage.setItem('pos_local_users', JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  };

  const [users, setUsers] = useState<User[]>(getInitialUsers);
  const [roles, setRoles] = useState<Role[]>(SYSTEM_ROLES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  
  // User Form State
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    pin: '',
    phone: '',
    email: '',
    roleId: 'waiter' as UserRole,
    active: true
  });

  // Quick PIN Modal State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [targetPinUser, setTargetPinUser] = useState<User | null>(null);
  const [newPinValue, setNewPinValue] = useState('');

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Synchronize staff records with Firestore and localStorage
  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubRoles: (() => void) | undefined;

    try {
      unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        let deletedIds: string[] = [];
        try {
          const rawDeleted = localStorage.getItem('pos_deleted_user_ids');
          if (rawDeleted) deletedIds = JSON.parse(rawDeleted);
        } catch (e) {}

        const list: User[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          // Filter out deleted users, cached deleted IDs, and old legacy mock users
          if (
            !data.deleted &&
            !deletedIds.includes(d.id) &&
            !['user_owner', 'user_manager', 'user_cashier', 'user_waiter1'].includes(d.id)
          ) {
            list.push({ uid: d.id, ...data });
          }
        });
        setUsers(list);
        localStorage.setItem('pos_local_users', JSON.stringify(list));
      }, (err) => {
        console.warn('Users Firestore listener note:', err?.message || err);
      });
    } catch (e) {
      console.warn('Users query notice:', e);
    }

    try {
      unsubRoles = onSnapshot(collection(db, 'roles'), (snap) => {
        const list: Role[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Role));
        if (list.length > 0) {
          setRoles(list);
        }
      }, (err) => {
        console.warn('Roles Firestore notice:', err?.message || err);
      });
    } catch (e) {
      console.warn('Roles query notice:', e);
    }

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubRoles) unsubRoles();
    };
  }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      username: '',
      pin: '',
      phone: '',
      email: '',
      roleId: 'waiter',
      active: true
    });
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormData({
      name: u.name || '',
      username: u.username || u.uid.replace('user_', ''),
      pin: u.pin || '1234',
      phone: (u as any).phone || '',
      email: u.email || '',
      roleId: (u.roleId?.toLowerCase() || 'waiter') as UserRole,
      active: u.active !== false
    });
    setModalOpen(true);
  };

  const openChangePinModal = (u: User) => {
    setTargetPinUser(u);
    setNewPinValue('');
    setPinModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setNotification({ type: 'error', message: 'Employee staff name is required.' });
      return;
    }

    const cleanUsername = (formData.username.trim() || formData.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    const cleanPin = formData.pin.trim() || '1234';
    const cleanEmail = formData.email.trim() || `${cleanUsername}@hotelpos.local`;
    const cleanPhone = formData.phone.trim();

    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Edit existing staff user
        const updatedData: Partial<User> = {
          name: formData.name.trim(),
          username: cleanUsername,
          pin: cleanPin,
          email: cleanEmail,
          roleId: formData.roleId,
          active: formData.active,
          updatedAt: Date.now()
        };
        (updatedData as any).phone = cleanPhone;

        try {
          await updateDoc(doc(db, 'users', editingUser.uid), updatedData);
        } catch (e: any) {
          console.warn('Firestore updateDoc notice:', e?.message || e);
        }

        setUsers((prev) => {
          const updated = prev.map((u) => u.uid === editingUser.uid ? { ...u, ...updatedData } as User : u);
          localStorage.setItem('pos_local_users', JSON.stringify(updated));
          return updated;
        });

        setNotification({ type: 'success', message: `Staff employee "${formData.name.trim()}" updated successfully.` });
      } else {
        // Add brand new staff user
        const uid = `staff_${cleanUsername}_${Date.now()}`;
        const userData: User = {
          uid,
          name: formData.name.trim(),
          username: cleanUsername,
          pin: cleanPin,
          email: cleanEmail,
          roleId: formData.roleId,
          active: formData.active,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        (userData as any).phone = cleanPhone;

        try {
          await setDoc(doc(db, 'users', uid), userData);
        } catch (e: any) {
          console.warn('Firestore setDoc notice:', e?.message || e);
        }

        setUsers((prev) => {
          const updated = [...prev.filter((u) => u.uid !== uid), userData];
          localStorage.setItem('pos_local_users', JSON.stringify(updated));
          return updated;
        });

        setNotification({ 
          type: 'success', 
          message: `Staff employee "${userData.name}" added (Username: @${cleanUsername}, PIN: ${cleanPin}).` 
        });
      }

      setModalOpen(false);
      setTimeout(() => setNotification(null), 3500);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to save staff details.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPinUser) return;
    if (newPinValue.length !== 4 || !/^\d{4}$/.test(newPinValue)) {
      setNotification({ type: 'error', message: 'PIN must be exactly 4 numeric digits (e.g. 1234).' });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', targetPinUser.uid), {
        pin: newPinValue,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Firestore PIN update notice:', e);
    }

    setUsers((prev) => {
      const updated = prev.map((u) => u.uid === targetPinUser.uid ? { ...u, pin: newPinValue, updatedAt: Date.now() } : u);
      localStorage.setItem('pos_local_users', JSON.stringify(updated));
      return updated;
    });

    setPinModalOpen(false);
    setNotification({ type: 'success', message: `PIN updated to "${newPinValue}" for ${targetPinUser.name}.` });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteUser = (u: User) => {
    // Prevent deleting own currently logged-in account
    if (currentUser?.uid === u.uid) {
      setNotification({ type: 'error', message: 'You cannot remove your own currently logged-in account.' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const roleName = roles.find((r) => r.id === u.roleId)?.name || u.roleId?.toUpperCase();

    setDeleteModalConfig({
      isOpen: true,
      title: 'Remove Staff Employee',
      itemName: u.name,
      itemSubtitle: `Username: @${u.username || u.uid} • Role: ${roleName}`,
      description: `Are you sure you want to permanently remove employee "${u.name}" from your restaurant staff?`,
      warningNote: 'This employee will immediately lose login, POS billing, and terminal access.',
      confirmButtonText: 'Remove Employee',
      onConfirm: async () => {
        setIsDeletingUser(true);
        try {
          // Attempt hard delete first; if restricted by Firestore rules, fallback to soft-delete
          try {
            await deleteDoc(doc(db, 'users', u.uid));
          } catch (deleteErr: any) {
            // Soft-delete in Firestore by updating record with deleted: true and active: false
            await setDoc(doc(db, 'users', u.uid), {
              deleted: true,
              active: false,
              deletedAt: Date.now()
            }, { merge: true });
          }

          // Cache deleted user ID locally so it is permanently excluded
          try {
            const rawDeleted = localStorage.getItem('pos_deleted_user_ids');
            const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
            if (!deletedIds.includes(u.uid)) {
              deletedIds.push(u.uid);
              localStorage.setItem('pos_deleted_user_ids', JSON.stringify(deletedIds));
            }
          } catch (e) {}

          setUsers((prev) => {
            const updated = prev.filter((item) => item.uid !== u.uid);
            localStorage.setItem('pos_local_users', JSON.stringify(updated));
            return updated;
          });
          setNotification({ type: 'success', message: `Employee "${u.name}" removed successfully.` });
          setTimeout(() => setNotification(null), 3000);
          setDeleteModalConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
          console.warn('Firestore delete user notice:', e);
          setNotification({ type: 'error', message: e?.message || 'Failed to remove employee.' });
        } finally {
          setIsDeletingUser(false);
        }
      }
    });
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        active: !currentActive,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Firestore toggle user active notice:', e);
    }
    setUsers((prev) => {
      const updated = prev.map((u) => u.uid === userId ? { ...u, active: !currentActive, updatedAt: Date.now() } : u);
      localStorage.setItem('pos_local_users', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearAllStaffData = async () => {
    if (!window.confirm('Clear all manually registered employees and start completely fresh? This cannot be undone.')) {
      return;
    }

    try {
      // Remove all records from Firestore users collection
      try {
        const batch = writeBatch(db);
        users.forEach((u) => {
          batch.delete(doc(db, 'users', u.uid));
        });
        await batch.commit();
      } catch (batchErr) {
        // Fallback to batch soft-delete if delete permission is restricted
        const batch = writeBatch(db);
        users.forEach((u) => {
          batch.set(doc(db, 'users', u.uid), {
            deleted: true,
            active: false,
            deletedAt: Date.now()
          }, { merge: true });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Firestore batch delete notice:', e);
    }

    try {
      const rawDeleted = localStorage.getItem('pos_deleted_user_ids');
      const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
      users.forEach((u) => {
        if (!deletedIds.includes(u.uid)) deletedIds.push(u.uid);
      });
      localStorage.setItem('pos_deleted_user_ids', JSON.stringify(deletedIds));
    } catch (e) {}

    localStorage.removeItem('pos_local_users');
    setUsers([]);
    setNotification({ type: 'success', message: 'All staff records have been cleared. Enter employee details manually.' });
    setTimeout(() => setNotification(null), 4000);
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name.toLowerCase().includes(q);
    const userMatch = (u.username || '').toLowerCase().includes(q);
    const roleMatch = (u.roleId || '').toLowerCase().includes(q);
    const phoneMatch = ((u as any).phone || '').includes(q);
    return nameMatch || userMatch || roleMatch || phoneMatch;
  });

  const activeCount = users.filter((u) => u.active !== false).length;
  const waiterCount = users.filter((u) => u.roleId?.toLowerCase() === 'waiter').length;
  const managerCount = users.filter((u) => u.roleId?.toLowerCase() === 'manager').length;
  const ownerCount = users.filter((u) => u.roleId?.toLowerCase() === 'owner').length;

  return (
    <div className="flex flex-col min-h-full bg-slate-100/90 text-slate-800 p-2 sm:p-4 gap-3 sm:gap-4 overflow-y-auto pb-24 md:pb-6 font-sans">
      
      {/* 1. Header Bar matching Direct Billing palette */}
      <div className="flex flex-wrap items-center justify-between bg-white border border-slate-200 rounded-xl px-3 sm:px-4 py-3 gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Users className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base tracking-tight text-slate-900 uppercase leading-none">
                Users & Roles Management
              </h2>
              <span className="hidden sm:inline-block text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Manual Employee Registry
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your staff details manually with 4-digit PINs and role access
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {users.length > 0 && (
            <button
              type="button"
              onClick={handleClearAllStaffData}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Clear all staff data to re-enter manually"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear All Staff</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <UserPlus className="w-4 h-4" /> 
            <span>Add Employee</span>
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

      {/* 2. Top Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Staff</div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">{users.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{activeCount} active on floor</div>
        </div>

        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Waiters</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{waiterCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">KOT floor service</div>
        </div>

        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Managers</div>
          <div className="text-xl sm:text-2xl font-black text-blue-600 mt-0.5">{managerCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Billing & operations</div>
        </div>

        <div className="bg-white border border-slate-200 p-2.5 sm:p-3 rounded-xl shadow-2xs">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Owners / Admins</div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{ownerCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Full master access</div>
        </div>
      </div>

      {/* 3. Filter & View Switcher Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search staff by name, @username, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px] font-bold text-slate-400 mr-1 hidden sm:inline">View:</span>
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              viewMode === 'cards' 
                ? 'bg-amber-500 text-white border-amber-600 shadow-2xs' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Card View (optimized for mobile/tablet)"
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
            title="Table View (optimized for PC/Laptop)"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      {/* 4. Staff Content: Empty State vs Cards / Table */}
      {users.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900">No Employees Registered Yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-1 mb-5">
            All default mock data has been removed. As the administrator, add your employees manually with their name, role (Manager, Waiter, Cashier), and 4-digit security PIN.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center gap-2 shadow-sm cursor-pointer transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add First Employee</span>
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
          No employees match search query "{searchQuery}".
        </div>
      ) : viewMode === 'cards' ? (
        /* Mobile, Tablet & PC Responsive Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredUsers.map((u) => {
            const roleLower = u.roleId?.toLowerCase() || 'waiter';
            const roleBadgeStyle = 
              roleLower === 'owner' 
                ? 'bg-amber-100 text-amber-900 border-amber-300' 
                : roleLower === 'manager' 
                ? 'bg-blue-100 text-blue-900 border-blue-300' 
                : 'bg-emerald-100 text-emerald-900 border-emerald-300';

            return (
              <div 
                key={u.uid} 
                className={`bg-white border rounded-xl p-3.5 flex flex-col justify-between shadow-2xs hover:shadow-xs transition-shadow ${
                  u.active === false ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                        roleLower === 'owner' ? 'bg-amber-500 text-white' : roleLower === 'manager' ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'
                      }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-slate-900 truncate">{u.name}</h4>
                        <div className="text-[11px] font-mono text-amber-700 font-bold truncate">
                          @{u.username || u.uid.replace('user_', '')}
                        </div>
                      </div>
                    </div>

                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider shrink-0 ${roleBadgeStyle}`}>
                      {roleLower}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <Key className="w-3 h-3 text-slate-400" /> Security PIN:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {u.pin || '1234'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openChangePinModal(u)}
                          className="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    </div>

                    {(u as any).phone && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" /> Mobile:
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-800">
                          {(u as any).phone}
                        </span>
                      </div>
                    )}

                    {u.email && !u.email.includes('@hotelpos.local') && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" /> Email:
                        </span>
                        <span className="text-[11px] text-slate-600 truncate max-w-[150px]">
                          {u.email}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        u.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}>
                        {u.active !== false ? '● Active' : '○ Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(u.uid, u.active !== false)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      u.active !== false 
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {u.active !== false ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(u)}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="Delete Employee"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* High-Density Responsive Table View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Employee Details</th>
                  <th className="py-2.5 px-3">Username & PIN</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const roleLower = u.roleId?.toLowerCase() || 'waiter';
                  const roleBadgeStyle = 
                    roleLower === 'owner' 
                      ? 'bg-amber-100 text-amber-900 border-amber-300' 
                      : roleLower === 'manager' 
                      ? 'bg-blue-100 text-blue-900 border-blue-300' 
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-extrabold text-slate-900">{u.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">UID: {u.uid}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <div className="text-amber-800 font-bold">@{u.username || u.uid.replace('user_', '')}</div>
                        <div className="text-[11px] text-slate-600">
                          PIN: <span className="font-bold text-slate-900 bg-slate-100 px-1 rounded">{u.pin || '1234'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {(u as any).phone ? (
                          <div className="font-mono text-slate-700 font-medium">{(u as any).phone}</div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No phone</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider ${roleBadgeStyle}`}>
                          {roleLower}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {u.active !== false ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[11px] font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u.uid, u.active !== false)}
                            className="text-[11px] text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                          >
                            {u.active !== false ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Role Capabilities Guide */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-2xs space-y-2">
        <h3 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          Role Permissions & Operational Responsibilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
            <div className="font-extrabold text-amber-900 flex items-center gap-1">👑 OWNER / ADMIN</div>
            <p className="text-[11px] text-slate-600 mt-1">
              Full access to Direct Billing, POS, KOTs, Bill Cancellations, Menu & Category CRUD, Price modifications, Sales Reports, Staff PIN setup, and Store Settings.
            </p>
          </div>

          <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
            <div className="font-extrabold text-blue-900 flex items-center gap-1">💼 RESTAURANT MANAGER</div>
            <p className="text-[11px] text-slate-600 mt-1">
              Store operations: Direct Billing, POS checkout, KOT management, thermal bill reprint, inventory receipts, and menu item updates.
            </p>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
            <div className="font-extrabold text-emerald-900 flex items-center gap-1">🍽️ FLOOR WAITER</div>
            <p className="text-[11px] text-slate-600 mt-1">
              Dedicated table service: Create KOT orders, punch food items to kitchen, monitor ticket readiness, and trigger kitchen print slips.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: Add / Edit Employee */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                  {editingUser ? <Edit2 className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                </div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {editingUser ? `Edit Staff: ${editingUser.name}` : 'Register New Employee'}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-4 sm:p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  EMPLOYEE FULL NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar / Priya Sundar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    LOGIN USERNAME <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-mono">@</span>
                    <input
                      type="text"
                      required
                      placeholder="ramesh"
                      value={formData.username}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') 
                      })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-7 pr-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    4-DIGIT PIN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={formData.pin}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      pin: e.target.value.replace(/[^0-9]/g, '') 
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono text-center tracking-widest text-base font-bold focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    ASSIGNED ROLE <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:outline-none focus:border-amber-500 focus:bg-white cursor-pointer"
                  >
                    <option value="waiter">🍽️ Floor Waiter (KOT focus)</option>
                    <option value="manager">💼 Manager (Operations & Billing)</option>
                    <option value="owner">👑 Owner / Admin (Full Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    CONTACT PHONE (OPTIONAL)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  EMAIL ADDRESS (OPTIONAL)
                </label>
                <input
                  type="email"
                  placeholder="e.g. employee@hotelpos.internal"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user-active-checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <label htmlFor="user-active-checkbox" className="font-bold text-slate-700 cursor-pointer">
                  Employee account is active and allowed to login
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingUser ? 'Save Employee Changes' : 'Save New Employee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Quick Change PIN */}
      {pinModalOpen && targetPinUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-slate-900">Change PIN: {targetPinUser.name}</h3>
              <button onClick={() => setPinModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdatePin} className="p-4 space-y-3 text-xs">
              <p className="text-slate-500 text-[11px]">
                Enter a new 4-digit numeric PIN for <b className="text-slate-800">@{targetPinUser.username || targetPinUser.name}</b>.
              </p>

              <div>
                <input
                  type="password"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={newPinValue}
                  onChange={(e) => setNewPinValue(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 text-center font-mono text-xl font-bold tracking-widest text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg"
                >
                  Update PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Staff User Deletion */}
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
        isDeleting={isDeletingUser}
      />

    </div>
  );
};
