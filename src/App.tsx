import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { Sidebar, NavTab } from './components/common/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { DirectBilling } from './components/billing/DirectBilling';
import { PosScreen } from './components/pos/PosScreen';
import { KotManagement } from './components/kot/KotManagement';
import { BillHistoryReprint } from './components/billing/BillHistoryReprint';
import { MenuManagement } from './components/menu/MenuManagement';
import { InventoryManagement } from './components/inventory/InventoryManagement';
import { ReportsView } from './components/reports/ReportsView';
import { UserManagement } from './components/users/UserManagement';
import { SettingsView } from './components/settings/SettingsView';
import { AuthModal } from './components/auth/AuthModal';
import { PrintingReceiptAnimation } from './components/common/PrintingReceiptAnimation';
import { DailyBackupNotificationToast } from './components/common/DailyBackupNotificationToast';
import { DailyLowStockAlertModal, useDailyLowStockAlert } from './components/inventory/DailyLowStockAlertModal';
import { useAutomatedDailyBackup } from './hooks/useAutomatedDailyBackup';
import { RestaurantSettings } from './types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';
import { DEFAULT_RESTAURANT_LOGO } from './data/defaultLogo';
import { OFFICIAL_LOGO_STORAGE_PATH, OFFICIAL_LOGO_STORAGE_URL } from './services/brandLogoService';
import { Zap, ShoppingBag, ChefHat, Receipt, MoreHorizontal, LayoutDashboard } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, isOwner, isManager, isWaiter } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('direct-billing');
  const [settings, setSettings] = useState<RestaurantSettings | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Automated Daily Backup background manager and notifications
  const { backupToast, dismissToast } = useAutomatedDailyBackup(settings);

  // Daily 8:00 AM Low Stock Alert
  const {
    modalOpen: lowStockModalOpen,
    lowStockItems,
    handleDismiss: handleDismissLowStock,
    handleViewInventory: handleViewInventoryLowStock
  } = useDailyLowStockAlert(() => {
    setActiveTab('inventory');
    setMobileSidebarOpen(false);
  });

  // Subscribe to Restaurant Settings in Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'restaurant'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RestaurantSettings;
        // STRICT LOGO PRESERVATION: Use exact original uploaded logo file directly
        // Disregard unreachable remote storage URLs that 404 and fallback to exact original asset
        const rawStorageUrl = data.logoStorageUrl?.trim();
        const rawLogoUrl = data.logoUrl?.trim();
        // Zero-network guarantee: If a custom uploaded data URL is present, use it.
        // Otherwise, fall back to DEFAULT_RESTAURANT_LOGO (the self-contained inline data URL)
        // so that neither subpaths, sandboxes, nor iframe origins cause HTTP 404 broken images.
        const isDataUrl = (rawStorageUrl?.startsWith('data:image/') || rawLogoUrl?.startsWith('data:image/'));
        const updatedLogo = isDataUrl 
          ? (rawStorageUrl?.startsWith('data:image/') ? rawStorageUrl : rawLogoUrl) 
          : DEFAULT_RESTAURANT_LOGO;

        setSettings({
          ...data,
          restaurantName: data.restaurantName || 'SRI SARAVANA BHAVAN',
          restaurantNameTamil: data.restaurantNameTamil || 'ஸ்ரீ சரவண பவன்',
          address: data.address || 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213',
          phone: data.phone || '7708159933',
          email: data.email || 'srisaravanabhavan57.com',
          gstNumber: data.gstNumber || '',
          logoUrl: updatedLogo,
          logoStoragePath: data.logoStoragePath || OFFICIAL_LOGO_STORAGE_PATH,
          logoStorageUrl: updatedLogo,
          logoProtectedBrandAsset: true,
          monochromeLogoUrl: data.monochromeLogoUrl || data.bwLogoUrl || '',
          receiptHeader: data.receiptHeader || 'SRI SARAVANA BHAVAN',
          receiptFooter: data.receiptFooter || '*** THANK YOU VISIT AGAIN ***',
          businessDayStartHour: data.businessDayStartHour || '04:00',
          billNumberDigits: data.billNumberDigits || 2,
          paperWidth: data.paperWidth || '80mm',
          receiptFontSize: data.receiptFontSize || 11,
          receiptAlignment: 'center', // Top-center alignment
          receiptLogoMaxWidth: (data.receiptLogoMaxWidth && data.receiptLogoMaxWidth >= 60) ? data.receiptLogoMaxWidth : 90,
          receiptLogoMaxHeight: (data.receiptLogoMaxHeight && data.receiptLogoMaxHeight >= 60) ? data.receiptLogoMaxHeight : 90,
          logoDisplay: (data.logoDisplay && data.logoDisplay !== 'watermark') ? data.logoDisplay : 'both',
          watermarkOpacity: data.watermarkOpacity !== undefined ? data.watermarkOpacity : 0.12,
          compactMode: data.compactMode !== undefined ? Boolean(data.compactMode) : true,
          autoPrintOnSave: data.autoPrintOnSave !== undefined ? data.autoPrintOnSave : true,
          skipPrintPreview: data.skipPrintPreview !== undefined ? Boolean(data.skipPrintPreview) : false,
        });
      } else {
        setSettings({
          restaurantName: 'SRI SARAVANA BHAVAN',
          restaurantNameTamil: 'ஸ்ரீ சரவண பவன்',
          address: 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213',
          phone: '7708159933',
          email: 'srisaravanabhavan57.com',
          gstNumber: '',
          logoUrl: DEFAULT_RESTAURANT_LOGO,
          logoStoragePath: OFFICIAL_LOGO_STORAGE_PATH,
          logoStorageUrl: OFFICIAL_LOGO_STORAGE_URL,
          logoProtectedBrandAsset: true,
          monochromeLogoUrl: '',
          receiptHeader: 'SRI SARAVANA BHAVAN',
          receiptFooter: '*** THANK YOU VISIT AGAIN ***',
          businessDayStartHour: '04:00',
          billNumberDigits: 2,
          paperWidth: '80mm',
          receiptFontSize: 11,
          receiptAlignment: 'center',
          receiptLogoMaxWidth: 90,
          receiptLogoMaxHeight: 90,
          logoDisplay: 'both',
          watermarkOpacity: 0.12,
          compactMode: true,
          autoPrintOnSave: true,
          skipPrintPreview: false
        });
      }
    }, (error) => {
      console.warn('Restaurant settings firestore notice (using defaults):', error?.message || error);
      setSettings({
        restaurantName: 'SRI SARAVANA BHAVAN',
        restaurantNameTamil: 'ஸ்ரீ சரவண பவன்',
        address: 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213',
        phone: '7708159933',
        email: 'srisaravanabhavan57.com',
        gstNumber: '',
        logoUrl: DEFAULT_RESTAURANT_LOGO,
        logoStoragePath: OFFICIAL_LOGO_STORAGE_PATH,
        logoStorageUrl: OFFICIAL_LOGO_STORAGE_URL,
        logoProtectedBrandAsset: true,
        receiptHeader: 'SRI SARAVANA BHAVAN',
        receiptFooter: '*** THANK YOU VISIT AGAIN ***',
        businessDayStartHour: '04:00',
        billNumberDigits: 2,
        paperWidth: '80mm',
        receiptFontSize: 11,
        receiptAlignment: 'center',
        receiptLogoMaxWidth: 90,
        receiptLogoMaxHeight: 90,
        logoDisplay: 'both',
        watermarkOpacity: 0.12,
        compactMode: true,
        autoPrintOnSave: true,
        skipPrintPreview: false
      });
    });

    return () => unsub();
  }, []);

  // Set default starting tab based on role
  useEffect(() => {
    if (isWaiter) {
      setActiveTab('kot');
    } else {
      setActiveTab('direct-billing');
    }
  }, [currentUser?.roleId]);

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] w-full bg-slate-100 text-slate-900 overflow-hidden font-sans">
      
      {/* Top Main Navigation App Bar */}
      <Header 
        settings={settings} 
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }}
        onOpenAuth={() => setAuthModalOpen(true)}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        onNavigateSettings={() => setActiveTab('settings')}
      />

      {/* Main Workspace (Full viewport width, zero reserved columns) */}
      <div className="flex-1 flex overflow-hidden relative min-h-0 w-full">
        
        {/* Overlay Navigation Drawer (Slides over interface on demand) */}
        <Sidebar 
          activeTab={activeTab} 
          settings={settings}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileSidebarOpen(false);
          }}
          isOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        />

        {/* Dynamic Screen View Area (Occupies 100% width and full vertical height) */}
        <main className="flex-1 flex flex-col min-w-0 w-full bg-slate-50 overflow-hidden relative">
          {activeTab === 'dashboard' && (
            <Dashboard 
              settings={settings} 
              onNavigate={(tab) => setActiveTab(tab)} 
            />
          )}

          {activeTab === 'pos' && (
            <PosScreen settings={settings} />
          )}

          {activeTab === 'direct-billing' && (
            <DirectBilling settings={settings} />
          )}

          {activeTab === 'kot' && (
            <KotManagement 
              settings={settings} 
              initialSubTab="create"
              onTabChange={(subTab) => {
                if (subTab === 'running') setActiveTab('running-kot');
                else if (subTab === 'create') setActiveTab('kot');
              }}
            />
          )}

          {activeTab === 'running-kot' && (
            <KotManagement 
              settings={settings} 
              initialSubTab="running"
              onTabChange={(subTab) => {
                if (subTab === 'running') setActiveTab('running-kot');
                else if (subTab === 'create') setActiveTab('kot');
              }}
            />
          )}

          {activeTab === 'reprint' && (
            <BillHistoryReprint settings={settings} />
          )}

          {activeTab === 'menu' && (
            <MenuManagement />
          )}

          {activeTab === 'inventory' && (
            <InventoryManagement />
          )}

          {activeTab === 'reports' && (
            <ReportsView settings={settings} />
          )}

          {activeTab === 'users' && (
            <UserManagement />
          )}

          {activeTab === 'settings' && (
            <SettingsView settings={settings} />
          )}
        </main>

      </div>

      {/* Global Thermal Receipt Printing Animation */}
      <PrintingReceiptAnimation mode="toast-widget" settings={settings} />


      {/* Daily 8:00 AM Low Stock Alert Modal */}
      <DailyLowStockAlertModal 
        isOpen={lowStockModalOpen}
        lowStockItems={lowStockItems}
        onClose={handleDismissLowStock}
        onViewInventory={handleViewInventoryLowStock}
      />

      {/* Automated Daily Backup Complete Notification Toast */}
      <DailyBackupNotificationToast 
        toast={backupToast}
        onDismiss={dismissToast}
        onNavigateSettings={() => setActiveTab('settings')}
      />

      {/* Firebase Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
