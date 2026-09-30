import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  LogOut, 
  LogIn, 
  UtensilsCrossed, 
  Menu as MenuIcon,
  Receipt,
  Printer,
  ExternalLink,
  Maximize2,
  Minimize2,
  LayoutDashboard,
  ShoppingBag,
  Zap,
  ChefHat,
  Flame,
  Utensils,
  Boxes,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RestaurantSettings } from '../../types';
import { DEFAULT_RESTAURANT_LOGO, SRI_SARAVANA_BHAVAN_SVG } from '../../data/defaultLogo';
import { getBusinessDate, formatBillNumber } from '../../services/billNumberEngine';
import { getLocalBills } from '../../services/localBillStore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { PrinterStatusService, PrinterHealthCheck } from '../../services/printerStatusService';
import { PrinterTroubleshootModal } from './PrinterTroubleshootModal';
import { NavTab } from './Sidebar';

export interface HeaderProps {
  settings?: RestaurantSettings;
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
  onOpenAuth: () => void;
  onToggleSidebar?: () => void;
  onNavigateSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  settings, 
  activeTab, 
  onSelectTab, 
  onOpenAuth, 
  onToggleSidebar, 
  onNavigateSettings 
}) => {
  const { currentUser, isOnline: authOnline, logout, firebaseUser, hasPermission, isOwner, isManager, isWaiter } = useAuth();
  const [networkOnline, setNetworkOnline] = useState<boolean>(navigator.onLine);
  const [firestoreServerSynced, setFirestoreServerSynced] = useState<boolean>(false);
  const [time, setTime] = useState(new Date());
  const [currentBillNo, setCurrentBillNo] = useState<string>('01');
  const [printerCheck, setPrinterCheck] = useState<PrinterHealthCheck | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Track Fullscreen State
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
    } catch (err) {
      console.warn('Fullscreen request notice:', err);
    }
  };

  // Subscribe to live printer status
  useEffect(() => {
    const unsub = PrinterStatusService.subscribe((check) => {
      setPrinterCheck(check);
    });
    return unsub;
  }, [settings]);

  // Real-time connectivity listener using browser network listeners + Firestore onSnapshot metadata
  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => {
      setNetworkOnline(false);
      setFirestoreServerSynced(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to Firestore metadata changes for deep cloud connectivity verification
    let unsubscribe: (() => void) | null = null;
    try {
      const docRef = doc(db, 'settings', 'restaurant');
      unsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          const isFromCache = snapshot.metadata.fromCache;
          if (!isFromCache) {
            setFirestoreServerSynced(true);
          }
          if (navigator.onLine) {
            setNetworkOnline(true);
          }
        },
        (error) => {
          console.debug('Firestore connectivity snapshot notice (operating in offline/cached mode):', error?.message);
          setFirestoreServerSynced(false);
          if (!navigator.onLine) {
            setNetworkOnline(false);
          }
        }
      );
    } catch (err) {
      console.debug('Failed to attach Firestore connectivity listener:', err);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const isCurrentlyOnline = networkOnline && authOnline !== false;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCurrentBillNo = (): string => {
    try {
      const businessDate = getBusinessDate(settings?.businessDayStartHour || '04:00');
      
      // 1. Check local sequence counter for today
      const localBillKey = `pos_last_bill_${businessDate}`;
      const storedCounter = localStorage.getItem(localBillKey);
      if (storedCounter && parseInt(storedCounter, 10) > 0) {
        return formatBillNumber(parseInt(storedCounter, 10));
      }

      // 2. Check last printed bill in cache
      const lastPrintedRaw = localStorage.getItem('pos_last_printed_bill');
      if (lastPrintedRaw) {
        const parsed = JSON.parse(lastPrintedRaw);
        if (parsed?.bill?.billNumber) {
          return parsed.bill.billNumber;
        }
      }

      // 3. Check locally saved bills
      const localBills = getLocalBills();
      if (localBills.length > 0 && localBills[0].billNumber) {
        return localBills[0].billNumber;
      }
    } catch (err) {
      console.debug('Error getting current bill number:', err);
    }
    return '01';
  };

  useEffect(() => {
    const updateBill = () => {
      setCurrentBillNo(fetchCurrentBillNo());
    };
    updateBill();

    window.addEventListener('pos_bills_updated', updateBill);
    window.addEventListener('pos-bill-printing', updateBill);
    window.addEventListener('storage', updateBill);
    const interval = setInterval(updateBill, 3000);

    return () => {
      window.removeEventListener('pos_bills_updated', updateBill);
      window.removeEventListener('pos-bill-printing', updateBill);
      window.removeEventListener('storage', updateBill);
      clearInterval(interval);
    };
  }, [settings?.businessDayStartHour]);

  const dateString = time.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short'
  });

  const timeString = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkNavScroll = () => {
    if (navScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = navScrollRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }
  };

  useEffect(() => {
    checkNavScroll();
    const handleResize = () => checkNavScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Smoothly center the active tab in view whenever activeTab changes
  useEffect(() => {
    if (navScrollRef.current && activeTab) {
      const activeEl = navScrollRef.current.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
      setTimeout(checkNavScroll, 300);
    }
  }, [activeTab]);

  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      navScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkNavScroll, 250);
    }
  };

  // All 11 navigation modules in top of all the screens
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true
    },
    {
      id: 'pos' as NavTab,
      label: 'Billing (POS)',
      badge: 'Full',
      icon: ShoppingBag,
      show: true
    },
    {
      id: 'direct-billing' as NavTab,
      label: 'Direct Billing',
      badge: 'Fast',
      icon: Zap,
      show: true
    },
    {
      id: 'kot' as NavTab,
      label: 'KOT',
      icon: ChefHat,
      show: true
    },
    {
      id: 'running-kot' as NavTab,
      label: 'Running KOT',
      badge: 'Live',
      icon: Flame,
      show: true
    },
    {
      id: 'reprint' as NavTab,
      label: 'Orders & Reprint',
      icon: Receipt,
      show: true
    },
    {
      id: 'menu' as NavTab,
      label: 'Menu',
      icon: Utensils,
      show: true
    },
    {
      id: 'inventory' as NavTab,
      label: 'Inventory',
      icon: Boxes,
      show: true
    },
    {
      id: 'reports' as NavTab,
      label: 'Reports',
      icon: BarChart3,
      show: true
    },
    {
      id: 'users' as NavTab,
      label: 'Users',
      icon: Users,
      show: true
    },
    {
      id: 'settings' as NavTab,
      label: 'Settings',
      icon: Settings,
      show: true
    }
  ];

  return (
    <header className="sticky top-0 z-40 w-full max-w-full flex flex-col shrink-0 select-none shadow-xs bg-white border-b border-slate-200">
      
      {/* Row 1: Brand & Top Utilities */}
      <div className="h-9 sm:h-9.5 px-2 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2.5 w-full bg-white border-b border-slate-100">
        
        {/* Left Section: [☰] Drawer Toggle + Compact Brand + Name */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink-0">
          {onToggleSidebar && (
            <button 
              type="button"
              onClick={onToggleSidebar}
              className="flex items-center gap-1 p-1 sm:px-2 sm:py-0.5 rounded-lg bg-slate-100 hover:bg-amber-100/80 text-slate-700 hover:text-amber-900 border border-slate-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
              title="Open Navigation Menu Drawer [☰]"
            >
              <MenuIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-700 stroke-[2.5]" />
              <span className="text-[11px] font-bold hidden md:inline">Drawer</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {(settings?.logoUrl || DEFAULT_RESTAURANT_LOGO) ? (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border border-amber-400 shadow-2xs flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
                <img 
                  src={settings?.logoUrl || DEFAULT_RESTAURANT_LOGO} 
                  alt={settings?.restaurantName || 'SRI SARAVANA BHAVAN'} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = SRI_SARAVANA_BHAVAN_SVG;
                  }}
                />
              </div>
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 flex items-center justify-center shadow-2xs text-white shrink-0">
                <UtensilsCrossed className="w-3.5 h-3.5 text-white" />
              </div>
            )}

            <div className="min-w-0">
              <h1 
                style={{ fontFamily: 'Georgia, serif' }}
                className="font-black text-xs sm:text-sm leading-none tracking-tight text-slate-900 uppercase truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[220px] md:max-w-none"
              >
                {settings?.restaurantName || 'SRI SARAVANA BHAVAN'}
              </h1>
            </div>
          </div>

          {/* Compact Clock (Desktop & Tablet) */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-200 text-slate-500 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{dateString}, {timeString}</span>
          </div>
        </div>

        {/* Right Section: Bill No, Online/Offline, Printer, Full Screen, User */}
        <div className="flex items-center justify-end gap-1 sm:gap-1.5 shrink-0">
          
          {/* Current Bill No */}
          <div 
            id="header-current-bill-no" 
            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 font-mono shadow-2xs shrink-0"
            title={`Current Business Day Bill No: #${currentBillNo}`}
          >
            <Receipt className="w-3 h-3 text-amber-700 shrink-0" />
            <span className="text-[10px] text-amber-700 uppercase font-bold hidden xs:inline">BILL:</span>
            <span className="font-black tracking-wide font-mono">#{currentBillNo}</span>
          </div>

          {/* Real-time Connectivity Indicator */}
          <div 
            id="header-connectivity-status"
            className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border shrink-0 transition-all shadow-2xs ${
              isCurrentlyOnline 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
            title={isCurrentlyOnline ? 'System Online (Sync Active)' : 'System Offline (Local Mode Active)'}
          >
            <span 
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isCurrentlyOnline 
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse' 
                  : 'bg-red-600 shadow-[0_0_6px_rgba(220,38,38,0.9)] animate-pulse'
              }`} 
            />
            {isCurrentlyOnline ? (
              <Wifi className="w-3 h-3 text-emerald-600 shrink-0" />
            ) : (
              <WifiOff className="w-3 h-3 text-red-600 shrink-0" />
            )}
            <span className="hidden sm:inline font-mono text-[10px]">
              {isCurrentlyOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          {/* Printer Status Button */}
          <button
            type="button"
            id="header-printer-status-btn"
            onClick={() => setShowPrinterModal(true)}
            className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border shrink-0 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 ${
              printerCheck?.status === 'OFFLINE'
                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                : printerCheck?.status === 'MOCK'
                ? 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
            }`}
            title="Thermal Printer Status (Click to test print or configure)"
          >
            <Printer className={`w-3 h-3 ${
              printerCheck?.status === 'OFFLINE' ? 'text-rose-600' : 'text-emerald-600'
            }`} />
            <span className="hidden md:inline font-bold text-[10px]">
              {printerCheck?.label || 'PRINTER'}
            </span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border border-slate-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            aria-label={isFullscreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-slate-800" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-800" />
            )}
          </button>

          {/* User Profile / Auth */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200 shrink-0">
            {firebaseUser ? (
              <div className="flex items-center gap-1">
                <div 
                  className="w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shadow-2xs"
                  title={`Signed in as: ${currentUser?.name || currentUser?.email || 'Staff'}`}
                >
                  {currentUser?.name?.charAt(0) || 'U'}
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-2 py-0.5 text-[10px] sm:text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                title="Sign In"
              >
                <LogIn className="w-3 h-3" />
                <span className="hidden xs:inline">Sign In</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Row 2: Top Navigation Menu Bar Across All Screens */}
      <div className="relative w-full bg-slate-900 border-b border-slate-800 flex items-center select-none shrink-0 shadow-inner">
        {/* Left Scroll Control Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollNav('left')}
            className="absolute left-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-r from-slate-950 via-slate-900/95 to-transparent flex items-center justify-center text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
            title="Scroll navigation left"
            aria-label="Scroll navigation left"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
          </button>
        )}

        <nav 
          ref={navScrollRef}
          onScroll={checkNavScroll}
          aria-label="All Screen Menu Navigation"
          className="w-full flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 overflow-x-auto no-scrollbar scroll-smooth"
        >
          {navItems.map((item) => {
            if (!item.show) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-tab-id={item.id}
                type="button"
                onClick={() => onSelectTab && onSelectTab(item.id)}
                className={`h-7 sm:h-7.5 px-2 sm:px-2.5 rounded-md text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer touch-manipulation select-none active:scale-[0.98] ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs ring-1 ring-amber-400'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-black uppercase ${
                    isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-300 border border-slate-700'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Scroll Control Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollNav('right')}
            className="absolute right-0 top-0 bottom-0 z-10 px-1 bg-gradient-to-l from-slate-950 via-slate-900/95 to-transparent flex items-center justify-center text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
            title="Scroll navigation right"
            aria-label="Scroll navigation right"
          >
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>

      <PrinterTroubleshootModal
        isOpen={showPrinterModal}
        onClose={() => setShowPrinterModal(false)}
        settings={settings}
        onNavigateSettings={onNavigateSettings}
      />
    </header>
  );
};

