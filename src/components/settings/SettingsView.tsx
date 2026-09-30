import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  Store, 
  Clock, 
  Printer, 
  Sparkles, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Database,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Trash2,
  Eye,
  Flame,
  Coffee,
  Crown,
  Type,
  Sliders,
  CheckCircle2,
  Activity,
  FileText,
  ChevronDown,
  ChevronUp,
  Leaf,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Download,
  HardDrive,
  Terminal,
  Zap
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { RestaurantSettings, Bill, BillItem } from '../../types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { DEFAULT_RESTAURANT_LOGO } from '../../data/defaultLogo';
import { OFFICIAL_LOGO_STORAGE_PATH, OFFICIAL_LOGO_STORAGE_URL, OFFICIAL_LOGO_PUBLIC_URL } from '../../services/brandLogoService';
import { PrintDiagnosticsCard } from './PrintDiagnosticsCard';
import { TestPrintLog } from './TestPrintLog';
import { PrinterDiagnosticView } from './PrinterDiagnosticView';
import { PrinterService } from '../../services/printerService';
import { CentralizedLogoProcessor } from './CentralizedLogoProcessor';
import { TestPrintModal } from './TestPrintModal';
import { RawEscPosTestModal } from './RawEscPosTestModal';
import { downloadDatabaseBackup, downloadCoreBillingBackup } from '../../services/backupService';
import { DailyBackupSettingsCard } from './DailyBackupSettingsCard';
import { PrinterTroubleshootModal } from '../common/PrinterTroubleshootModal';
import { RugtekPrinterPairingSection } from './RugtekPrinterPairingSection';
import { PrinterConnectionService } from '../../services/printerConnectionService';
import { ConnectedPrinterInfo } from '../../types';
import { ReceiptDesignerSection } from './ReceiptDesignerSection';
import { LiveReceiptPreview } from './LiveReceiptPreview';

interface SettingsViewProps {
  settings?: RestaurantSettings;
  onRefreshSettings?: () => void;
}

type SettingsTab = 'store' | 'logo' | 'receipt' | 'hardware' | 'diagnostic';

// Preset sample logos for instant switching
const LOGO_PRESETS = [
  {
    id: 'sri_saravana_bhavan',
    name: 'Sri Saravana Bhavan (SSB)',
    icon: Sparkles,
    dataUrl: DEFAULT_RESTAURANT_LOGO
  },
  {
    id: 'royal_crest',
    name: 'Royal Crest',
    icon: Crown,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M40 55 L160 55 L150 25 L125 40 L100 15 L75 40 L50 25 Z" fill="%23000" stroke="%23000" stroke-width="2"/><circle cx="50" cy="22" r="5" fill="%23000"/><circle cx="100" cy="12" r="6" fill="%23000"/><circle cx="150" cy="22" r="5" fill="%23000"/><text x="100" y="73" font-family="monospace" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="3">ROYAL DINING</text></svg>'
  },
  {
    id: 'south_kalash',
    name: 'Traditional Lamp',
    icon: Flame,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M100 10 Q108 24 100 32 Q92 24 100 10 Z" fill="%23000"/><path d="M85 36 Q100 30 115 36 L118 48 Q100 52 82 48 Z" fill="%23000"/><rect x="94" y="48" width="12" height="8" fill="%23000"/><rect x="80" y="56" width="40" height="4" rx="2" fill="%23000"/><text x="100" y="74" font-family="monospace" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="2">AUTHENTIC SOUTH</text></svg>'
  },
  {
    id: 'artisan_cafe',
    name: 'Café & Tiffin',
    icon: Coffee,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M75 32 L125 32 L120 54 Q100 62 80 54 Z" fill="%23000"/><path d="M123 36 Q138 36 138 44 Q138 52 120 52" stroke="%23000" stroke-width="4" fill="none"/><path d="M88 24 Q92 16 88 12 M100 24 Q104 16 100 12 M112 24 Q116 16 112 12" stroke="%23000" stroke-width="2.5" fill="none" stroke-linecap="round"/><line x1="70" y1="62" x2="130" y2="62" stroke="%23000" stroke-width="4" stroke-linecap="round"/><text x="100" y="75" font-family="monospace" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="2">HOT TIFFIN & TEA</text></svg>'
  }
];

export const SettingsView: React.FC<SettingsViewProps> = ({ settings: initialSettings, onRefreshSettings }) => {
  const { bootstrapSystem } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('store');

  const [formData, setFormData] = useState<RestaurantSettings>({
    restaurantName: 'SRI SARAVANA BHAVAN',
    restaurantNameTamil: 'ஸ்ரீ சரவண பவன்',
    address: 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213',
    phone: '7708159933',
    email: 'srisaravanabhavan57.com',
    gstNumber: '',
    fssaiNumber: '',
    logoUrl: DEFAULT_RESTAURANT_LOGO,
    monochromeLogoUrl: '',
    receiptHeader: 'SRI SARAVANA BHAVAN',
    receiptFooter: '*** THANK YOU VISIT AGAIN ***',
    businessDayStartHour: '04:00',
    billNumberDigits: 2,
    paperWidth: '80mm',
    receiptFontSize: 11,
    receiptAlignment: 'center',
    receiptLogoMaxWidth: 85,
    receiptLogoMaxHeight: 85,
    logoDisplay: 'both',
    watermarkOpacity: 0.12,
    compactMode: true,
    receiptFormat: 'standard',
    receiptHeaderFontSize: 'large',
    receiptItemFontSize: 'normal',
    receiptTotalFontSize: 'xlarge',
    receiptLineSpacing: 'tight',
    receiptSectionSpacing: 'compact',
    receiptItemPadding: 'condensed',
    receiptPaperMargin: '1mm',
    receiptShowItemSl: true,
    receiptShowTotalQty: true,
    receiptShowAddress: true,
    receiptShowPhone: true,
    receiptShowGstFssai: true,
    receiptShowTamilName: true,
    receiptShowEnglishName: false,
    receiptFeedLines: 2,
    autoPrintOnSave: true,
    skipPrintPreview: false,
    updatedAt: Date.now()
  });

  const [saving, setSaving] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isTestingPrint, setIsTestingPrint] = useState(false);
  const [isPrintingSample, setIsPrintingSample] = useState(false);
  const [showTestPrintModal, setShowTestPrintModal] = useState(false);
  const [showRawEscPosModal, setShowRawEscPosModal] = useState(false);
  const [showTroubleshootModal, setShowTroubleshootModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [connectedPrinter, setConnectedPrinter] = useState<ConnectedPrinterInfo>(() =>
    PrinterConnectionService.getConnectedPrinter()
  );

  useEffect(() => {
    const unsub = PrinterConnectionService.subscribe((info) => {
      setConnectedPrinter(info);
    });
    return unsub;
  }, []);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [lastBackupInfo, setLastBackupInfo] = useState<{ time: string; count: number; filename: string } | null>(() => {
    try {
      const rawTs = localStorage.getItem('pos_last_backup_timestamp');
      const filename = localStorage.getItem('pos_last_backup_filename') || '';
      const count = Number(localStorage.getItem('pos_last_backup_doc_count') || 0);
      if (rawTs) {
        return {
          time: new Date(Number(rawTs)).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          count,
          filename
        };
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    if (initialSettings) {
      const activeLogo = initialSettings.logoUrl?.trim() ? initialSettings.logoUrl : DEFAULT_RESTAURANT_LOGO;
      const activeMonochromeLogo = initialSettings.monochromeLogoUrl || initialSettings.bwLogoUrl || '';

      setFormData((prev) => ({
        ...prev,
        ...initialSettings,
        restaurantName: initialSettings.restaurantName || prev.restaurantName || 'SRI SARAVANA BHAVAN',
        restaurantNameTamil: initialSettings.restaurantNameTamil !== undefined ? initialSettings.restaurantNameTamil : (prev.restaurantNameTamil || 'ஸ்ரீ சரவண பவன்'),
        address: initialSettings.address || prev.address || 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213',
        phone: initialSettings.phone || prev.phone || '7708159933',
        email: initialSettings.email !== undefined ? initialSettings.email : (prev.email || ''),
        gstNumber: initialSettings.gstNumber !== undefined ? initialSettings.gstNumber : (prev.gstNumber || ''),
        fssaiNumber: initialSettings.fssaiNumber !== undefined ? initialSettings.fssaiNumber : (prev.fssaiNumber || ''),
        logoUrl: activeLogo,
        monochromeLogoUrl: activeMonochromeLogo,
        receiptHeader: initialSettings.receiptHeader || prev.receiptHeader || 'SRI SARAVANA BHAVAN',
        receiptFooter: initialSettings.receiptFooter || prev.receiptFooter || '*** THANK YOU VISIT AGAIN ***',
        businessDayStartHour: initialSettings.businessDayStartHour || prev.businessDayStartHour || '04:00',
        billNumberDigits: initialSettings.billNumberDigits || prev.billNumberDigits || 2,
        paperWidth: initialSettings.paperWidth || prev.paperWidth || '80mm',
        receiptFontSize: initialSettings.receiptFontSize !== undefined ? initialSettings.receiptFontSize : (prev.receiptFontSize || 11),
        receiptAlignment: initialSettings.receiptAlignment || prev.receiptAlignment || 'center',
        receiptLogoMaxWidth: initialSettings.receiptLogoMaxWidth || prev.receiptLogoMaxWidth || 85,
        receiptLogoMaxHeight: initialSettings.receiptLogoMaxHeight || prev.receiptLogoMaxHeight || 85,
        logoDisplay: initialSettings.logoDisplay || prev.logoDisplay || 'both',
        watermarkOpacity: initialSettings.watermarkOpacity !== undefined ? initialSettings.watermarkOpacity : (prev.watermarkOpacity !== undefined ? prev.watermarkOpacity : 0.12),
        compactMode: initialSettings.compactMode !== undefined ? Boolean(initialSettings.compactMode) : true,
        autoPrintOnSave: initialSettings.autoPrintOnSave !== undefined ? initialSettings.autoPrintOnSave : (prev.autoPrintOnSave !== undefined ? prev.autoPrintOnSave : true),
        skipPrintPreview: initialSettings.skipPrintPreview !== undefined ? initialSettings.skipPrintPreview : (prev.skipPrintPreview !== undefined ? prev.skipPrintPreview : false)
      }));
    }
  }, [initialSettings]);

  // Handle image upload and base64 conversion
  const handleLogoFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotification({ type: 'error', message: 'Please select an image file (PNG, JPG, SVG, WebP).' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setFormData((prev) => ({ ...prev, logoUrl: result }));
        setNotification({ type: 'success', message: 'Shop logo loaded! Click Save Settings to persist.' });
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerTestPrint = () => {
    setIsTestingPrint(true);
    try {
      const result = PrinterService.printDiagnosticTestPage(formData, true);
      if (result.success && !result.restrictedInIframe) {
        setNotification({
          type: 'success',
          message: 'Standardized diagnostic string sent to default thermal printer! Connection and paper feed status verified.'
        });
        setTimeout(() => setNotification(null), 4500);
      } else if (result.restrictedInIframe) {
        setShowTestPrintModal(true);
        setNotification({
          type: 'success',
          message: 'Standardized diagnostic string loaded in preview. Direct system print available in preview dialog.'
        });
        setTimeout(() => setNotification(null), 4500);
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to dispatch standardized diagnostic test page to printer.'
        });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Could not execute test print sequence.'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsTestingPrint(false);
    }
  };

  // Dispatch sample bill print to test thermal receipt layout immediately
  const handlePrintSampleReceipt = () => {
    const sampleBill: Bill = {
      id: 'sample-01',
      billNumber: '01',
      businessDate: new Date().toISOString().split('T')[0],
      orderType: 'DINE_IN',
      priceType: 'NON_AC',
      tableNumber: 'T-09',
      subtotal: 150,
      discount: 0,
      grandTotal: 150,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      status: 'COMPLETED',
      reprintCount: 0,
      userId: 'staff_1',
      userName: 'sivan',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const sampleItems: BillItem[] = [
      {
        id: 'bi-1',
        billId: 'sample-01',
        itemId: 'm-1',
        itemCode: '101',
        itemName: 'Masala Dosa',
        itemNameTamil: 'மசால் தோசை',
        quantity: 1,
        unitPrice: 80,
        totalPrice: 80,
        priceType: 'NON_AC',
        createdAt: Date.now()
      },
      {
        id: 'bi-2',
        billId: 'sample-01',
        itemId: 'm-2',
        itemCode: '102',
        itemName: 'Filter Coffee',
        itemNameTamil: 'ஃபில்டர் காபி',
        quantity: 2,
        unitPrice: 35,
        totalPrice: 70,
        priceType: 'NON_AC',
        createdAt: Date.now()
      }
    ];

    setIsPrintingSample(true);
    try {
      PrinterService.printBill(sampleBill, sampleItems, formData, true);
    } finally {
      setTimeout(() => {
        setIsPrintingSample(false);
      }, 2600);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        logoStoragePath: formData.logoStoragePath || OFFICIAL_LOGO_STORAGE_PATH,
        logoStorageUrl: formData.logoStorageUrl || OFFICIAL_LOGO_STORAGE_URL,
        logoUrl: formData.logoUrl?.trim() || OFFICIAL_LOGO_PUBLIC_URL,
        logoProtectedBrandAsset: true,
        receiptAlignment: 'center', // Strict top-center logo placement
        updatedAt: Date.now()
      };
      await setDoc(doc(db, 'settings', 'restaurant'), dataToSave);
      if (onRefreshSettings) onRefreshSettings();
      setNotification({ type: 'success', message: 'Restaurant settings and thermal receipt layout saved successfully!' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunBootstrap = async () => {
    if (!window.confirm('This will seed the database with initial Categories, Menu Items, Roles, and Settings. Continue?')) {
      return;
    }

    setBootstrapping(true);
    try {
      await bootstrapSystem();
      if (onRefreshSettings) onRefreshSettings();
      setNotification({ type: 'success', message: 'Database successfully seeded with South Indian Menu, Categories & Roles!' });
      setTimeout(() => setNotification(null), 4000);
    } catch (e: any) {
      setNotification({ type: 'error', message: 'Bootstrap failed.' });
    } finally {
      setBootstrapping(false);
    }
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const result = await downloadCoreBillingBackup(formData);
      if (result.success) {
        const formattedTime = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        setLastBackupInfo({
          time: formattedTime,
          count: result.totalDocuments,
          filename: result.filename
        });
        setNotification({
          type: 'success',
          message: `Core billing archive downloaded: ${result.billCount} bills (₹${result.totalRevenue.toLocaleString('en-IN')}) exported to "${result.filename}"`
        });
        setTimeout(() => setNotification(null), 6000);
      } else {
        setNotification({
          type: 'error',
          message: result.error || 'Failed to export billing archive.'
        });
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err: any) {
      console.error('Database backup error:', err);
      setNotification({
        type: 'error',
        message: err?.message || 'Error occurred while generating billing backup.'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Helper address line splitting
  const formatAddressLines = (addr: string): string[] => {
    if (!addr) return [];
    if (addr.includes('\n')) return addr.split('\n').map(s => s.trim()).filter(Boolean);
    if (addr.includes('Anna Nagar')) {
      const parts = addr.split('Anna Nagar');
      return [
        parts[0].replace(/,\s*$/, '').trim(),
        ('Anna Nagar' + parts[1]).trim()
      ];
    }
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 2) {
      const mid = Math.ceil(parts.length / 2);
      return [parts.slice(0, mid).join(', '), parts.slice(mid).join(', ')];
    }
    return [addr];
  };

  const addressLines = formatAddressLines(formData.address);
  const activeLogo = formData.logoUrl?.trim() ? formData.logoUrl : DEFAULT_RESTAURANT_LOGO;
  const is58mm = formData.paperWidth === '58mm';
  const isCompact = Boolean(formData.compactMode);
  const configuredFontSize = formData.receiptFontSize ? Number(formData.receiptFontSize) : (is58mm ? 10 : 11);
  const previewBaseFontSize = isCompact ? Math.max(9, Math.round(configuredFontSize * 0.90 * 10) / 10) : configuredFontSize;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-3 sm:p-5 gap-4 overflow-y-auto">
      
      {/* 1. Header Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base sm:text-lg tracking-wide text-white">
                Store Settings & Thermal Receipt
              </h2>
              {isCompact && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Leaf className="w-3 h-3" />
                  Paper Saver Active
                </span>
              )}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                {formData.paperWidth || '80mm'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure hotel identity, watermark logo in light background, paper-saving thermal format & printer calibration
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={isBackingUp}
            id="download-db-backup-header-btn"
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-850 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            title="Export Firestore collections to a JSON file for local record-keeping"
          >
            <Download className={`w-4 h-4 text-emerald-400 ${isBackingUp ? 'animate-bounce' : ''}`} />
            <span>{isBackingUp ? 'Exporting...' : 'Download Database Backup'}</span>
          </button>

          <button
            type="button"
            id="btn-print-test-page"
            onClick={handleTriggerTestPrint}
            disabled={isTestingPrint}
            className="px-3.5 py-2 text-xs sm:text-sm font-bold text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 active:bg-amber-950/70 border border-amber-500/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:border-amber-400 disabled:opacity-50"
            title="Send standardized diagnostic string to default thermal printer to verify connection and paper feed status immediately"
          >
            <Printer className={`w-4 h-4 text-amber-400 ${isTestingPrint ? 'animate-pulse' : ''}`} />
            <span>{isTestingPrint ? 'Printing Test Page...' : 'Print Test Page'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-900/30 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div className={`px-4 py-3 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 transition-all shadow-md ${
          notification.type === 'success'
            ? 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-200'
            : 'bg-red-950/90 border border-red-500/40 text-red-200'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 2. Main Workspace (Config Tabs on Left, Live Compact Receipt on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left Column: Form & Tabbed Configuration (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Tabs Navigation */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1 overflow-x-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('store')}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'store' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Hotel Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logo')}
              className={`flex-1 min-w-[110px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'logo' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Logo Processor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('receipt')}
              className={`flex-1 min-w-[130px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'receipt' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Receipt Designer</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('hardware')}
              className={`flex-1 min-w-[120px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'hardware' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Printer & Data</span>
            </button>

            <button
              type="button"
              id="tab-printer-diagnostic"
              onClick={() => setActiveTab('diagnostic')}
              className={`flex-1 min-w-[135px] py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'diagnostic' 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shadow-xs' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4 text-amber-400" />
              <span>Printer Diagnostic</span>
            </button>
          </div>

          {/* Tab 1: Hotel Profile */}
          {activeTab === 'store' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <Store className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Hotel Name, Address & Contact</h3>
                  <p className="text-xs text-slate-400">Printed directly in the receipt top header</p>
                </div>
              </div>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Hotel Name (English) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.restaurantName}
                      onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-semibold transition-colors"
                      placeholder="e.g. SRI SARAVANA BHAVAN"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Default brand name</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1">
                      Hotel Name in Tamil (ரசீது தலைப்பு) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.restaurantNameTamil || ''}
                      onChange={(e) => setFormData({ ...formData, restaurantNameTamil: e.target.value })}
                      className="w-full bg-slate-950 border border-amber-500/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-semibold transition-colors"
                      placeholder="e.g. ஸ்ரீ சரவண பவன்"
                      required
                    />
                    <p className="text-[11px] text-amber-400/80 mt-1">Printed prominently in Tamil as header on the thermal bill</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Hotel Address <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white leading-relaxed transition-colors"
                    placeholder="No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Formatted cleanly onto concise lines for paper saving</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono transition-colors"
                      placeholder="e.g. 7708159933"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Bill metadata is placed right after this phone number</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white transition-colors"
                      placeholder="e.g. srisaravanabhavan57.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      GSTIN Number (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.gstNumber || ''}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono transition-colors uppercase"
                      placeholder="e.g. 33AABCS1429B1Z"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      FSSAI License No. (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.fssaiNumber || ''}
                      onChange={(e) => setFormData({ ...formData, fssaiNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono transition-colors"
                      placeholder="e.g. 12423002000456"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Centralized Receipt Logo & Watermark Processor */}
          {activeTab === 'logo' && (
            <CentralizedLogoProcessor
              settings={formData}
              onUpdateSettings={setFormData}
              onSave={handleSave}
              isSaving={saving}
            />
          )}

          {/* Tab 3: Receipt Designer, Formats, Spacing & Alignment */}
          {activeTab === 'receipt' && (
            <div className="space-y-5">
              {/* Paper Dimensions & Hardware Model Presets */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Printer className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-bold text-sm text-white">Printer Width &amp; Shift Settings</h3>
                      <p className="text-xs text-slate-400">Roll size (80mm / 58mm) and daily business reset time</p>
                    </div>
                  </div>
                </div>

                {/* Paper Width Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">Thermal Paper Roll Width</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paperWidth: '80mm', printerType: 'THERMAL_80MM' }))}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        formData.paperWidth === '80mm'
                          ? 'bg-amber-500/15 border-amber-500/80 text-white shadow-xs'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">80mm (3-Inch Standard)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">72mm printable width • Best for POS counters</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paperWidth: '58mm', printerType: 'THERMAL_58MM' }))}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        formData.paperWidth === '58mm'
                          ? 'bg-amber-500/15 border-amber-500/80 text-white shadow-xs'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">58mm (2-Inch Portable)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">48mm printable width • Portable Bluetooth printers</div>
                    </button>
                  </div>
                </div>

                {/* Business Day & Digits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Shift / Business Day Start
                    </label>
                    <input
                      type="time"
                      value={formData.businessDayStartHour || '04:00'}
                      onChange={(e) => setFormData(prev => ({ ...prev, businessDayStartHour: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono transition-colors"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Daily bill counter resets automatically at this hour</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Bill Number Digits
                    </label>
                    <select
                      value={formData.billNumberDigits || 2}
                      onChange={(e) => setFormData(prev => ({ ...prev, billNumberDigits: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-3.5 py-2 text-xs text-white transition-colors"
                    >
                      <option value={1}>1 Digit (1, 2, 3...)</option>
                      <option value={2}>2 Digits (01, 02, 03...)</option>
                      <option value={3}>3 Digits (001, 002...)</option>
                      <option value={4}>4 Digits (0001, 0002...)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Comprehensive Receipt Designer: Formats, Font Sizes, Alignment & Spacing */}
              <ReceiptDesignerSection
                formData={formData}
                setFormData={setFormData}
                onSave={() => handleSave()}
                isSaving={saving}
              />
            </div>
          )}

          {/* Tab 4: Hardware, Automation & Database Seeder */}
          {activeTab === 'hardware' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
                <Printer className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">Hardware Calibration & System Tools</h3>
                  <p className="text-xs text-slate-400">Printer test slips, fast cashier printing, and menu seeder</p>
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="space-y-4 bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-200">Auto-Print on Bill Save</div>
                    <div className="text-[11px] text-slate-500">Automatically trigger thermal print when cashier finishes payment</div>
                  </div>
                  <input
                    type="checkbox"
                    id="checkbox-auto-print-save"
                    checked={Boolean(formData.autoPrintOnSave)}
                    onChange={(e) => setFormData({ ...formData, autoPrintOnSave: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-900 pt-3 flex items-center justify-between">
                  <div className="pr-4">
                    <div className="font-bold text-xs text-slate-200 flex items-center gap-2">
                      <span>Skip On-Screen Print Preview (Express Checkout)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ⚡ Fast Mode
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Bypasses the on-screen receipt modal. The POS cart resets instantly for the next customer without interrupting the cashier.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    id="checkbox-skip-print-preview"
                    checked={Boolean(formData.skipPrintPreview)}
                    onChange={(e) => setFormData({ ...formData, skipPrintPreview: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                  />
                </div>

                <div className="p-4 bg-slate-900/90 border border-amber-500/30 rounded-xl text-[11px] text-slate-300 space-y-2.5">
                  <div className="font-bold text-xs text-amber-400 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>Google Chrome Kiosk Printing Setup (Silent 0-Click Thermal Printing)</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    To print bills and KOT slips directly to your thermal printer with <strong>NO print preview dialog</strong> and <strong>NO confirmation popup</strong>, configure Windows and launch Chrome with the <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded font-mono">--kiosk-printing</code> flag.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="font-semibold text-slate-200">Step 1: Set Thermal Printer as Windows Default Printer</div>
                    <div className="text-slate-400 pl-3 border-l-2 border-slate-700">
                      Open <em>Windows Settings → Bluetooth & Devices → Printers & Scanners</em>. Select your thermal printer (e.g., Rugtek RP326 / POS-80 / TVS) and click <strong>"Set as default"</strong>. Ensure Paper Size is set to 80mm (or 58mm) and Margins are set to None.
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="font-semibold text-slate-200">Step 2: Create Windows Chrome Kiosk Shortcut</div>
                    <div className="text-slate-400 pl-3 border-l-2 border-slate-700 space-y-1">
                      <div>Right-click your desktop → <em>New → Shortcut</em>, and paste the following target:</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-slate-950 border border-slate-800 text-emerald-400 px-2.5 py-1.5 rounded font-mono text-[11px] flex-1 select-all break-all">
                          "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing "{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}"
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            const cmd = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --kiosk-printing "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}"`;
                            navigator.clipboard.writeText(cmd);
                            setNotification({ type: 'success', message: 'Kiosk shortcut command copied to clipboard!' });
                            setTimeout(() => setNotification(null), 3000);
                          }}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold rounded-lg cursor-pointer shrink-0 transition-colors text-[10px]"
                          title="Copy shortcut target command"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        * Note: If Chrome is installed in 32-bit directory, use: <code className="text-slate-300 font-mono">"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"</code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rugtek RP326 Web Serial & WebUSB Hardware Pairing Section */}
              <RugtekPrinterPairingSection 
                settings={formData} 
                onUpdateSettings={(updated) => setFormData(prev => ({ ...prev, ...updated }))} 
              />

              {/* Hardware Test Buttons */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">Printer Hardware Calibration</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primary Diagnostic Raw ESC/POS Print Test */}
                  <button
                    type="button"
                    id="btn-diagnostic-raw-escpos-test"
                    onClick={() => setShowRawEscPosModal(true)}
                    className="p-3 bg-gradient-to-r from-amber-500/15 via-slate-950 to-slate-900 hover:from-amber-500/25 hover:to-slate-850 border border-amber-500/40 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 sm:col-span-2 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                        <span>Diagnostic Raw ESC/POS Print Test</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                          BYPASS DIALOG
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                          HARDWARE HANDSHAKE
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                        Generates a small binary ESC/POS command stream to verify hardware handshake, character set support, bold/inverse styles &amp; partial auto-cut independently of the browser print dialog.
                      </div>
                    </div>
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  </button>

                  <button
                    type="button"
                    id="btn-print-test-page-hardware"
                    onClick={handleTriggerTestPrint}
                    disabled={isTestingPrint}
                    className="p-3.5 bg-slate-950 hover:bg-slate-850 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-left transition-all cursor-pointer flex items-start gap-3 sm:col-span-2 group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform mt-0.5">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-amber-200">Print Test Page</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                          VERIFY CONNECTION & PAPER FEED
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-normal">
                        Sends a standardized diagnostic string to the default thermal printer to verify connection, character set support, and 20mm paper feed status immediately.
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 self-center shrink-0 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/30 group-hover:bg-amber-500/20 transition-colors">
                      {isTestingPrint ? 'Sending...' : 'Print Now'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTestPrintModal(true)}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 sm:col-span-2"
                  >
                    <Eye className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-200">Preview Standardized Test Page</div>
                      <div className="text-[10px] text-slate-500">Inspect the diagnostic string, character grid, and paper feed marks before dispatching to physical printer</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowTroubleshootModal(true)}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 sm:col-span-2"
                  >
                    <Sliders className="w-5 h-5 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-200">Printer Connection Wizard &amp; Hardware Setup Guide</div>
                      <div className="text-[10px] text-slate-500">Connect USB, Serial, Bluetooth, network or OS printers + Kiosk instant-print command</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    id="btn-goto-printer-diagnostic"
                    onClick={() => setActiveTab('diagnostic')}
                    className="p-3 bg-slate-950 hover:bg-slate-800 border border-amber-500/30 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 sm:col-span-2 bg-amber-500/5"
                  >
                    <Activity className="w-5 h-5 text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                        <span>Open Full Printer Diagnostic View</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono font-bold">LIVE CHECK</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Checks browser window.print(), WebUSB / Serial APIs, sandboxed status, and displays comprehensive thermal POS setup guides
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Menu & Catalog Seeder */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-200">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Menu & System Catalog Seeder</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Populates categories and popular items (Dosa, Idli, Pongal, Meals, Coffee, Tea) into Firestore.
                </p>
                <button
                  type="button"
                  onClick={handleRunBootstrap}
                  disabled={bootstrapping}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm text-xs"
                >
                  <Sparkles className={`w-4 h-4 ${bootstrapping ? 'animate-spin' : ''}`} />
                  <span>{bootstrapping ? 'Seeding Database...' : 'Seed Sample Menu & Categories'}</span>
                </button>
              </div>

              {/* Automated Daily Database Backup & Billing Archives Component */}
              <DailyBackupSettingsCard settings={formData} onRefreshSettings={onRefreshSettings} />

              {/* Diagnostics Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-medium cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  <span>{showDiagnostics ? 'Hide Print Diagnostic Logs' : 'Show Print Diagnostic Logs & Status'}</span>
                  {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Diagnostics Card */}
          {showDiagnostics && (
            <div className="mt-1 space-y-5">
              <TestPrintLog settings={formData} onRunTestPrint={handleTriggerTestPrint} />
              <PrintDiagnosticsCard settings={formData} />
            </div>
          )}

          {/* Tab 5: Printer Diagnostic & POS Hardware Setup View */}
          {activeTab === 'diagnostic' && (
            <div className="animate-fadeIn">
              <PrinterDiagnosticView 
                settings={formData} 
                onOpenTestModal={() => setShowTestPrintModal(true)} 
                onUpdateSettings={(updated) => setFormData(prev => ({ ...prev, ...updated }))}
              />
            </div>
          )}

        </div>

        {/* Right Column: Live Sticky Real-Time Interactive Receipt Preview (5 cols) */}
        <div className="lg:col-span-5 sticky top-4 flex flex-col gap-3">
          <LiveReceiptPreview
            settings={formData}
            onTestPrint={handlePrintSampleReceipt}
            isPrintingSample={isPrintingSample}
          />
        </div>

      </div>

      {/* Test Print Hardware & Alignment Preview Modal */}
      <TestPrintModal
        isOpen={showTestPrintModal}
        onClose={() => setShowTestPrintModal(false)}
        settings={formData}
        onPrintSuccess={() => {
          setNotification({ type: 'success', message: 'Diagnostic test slip dispatched to thermal printer!' });
          setTimeout(() => setNotification(null), 3000);
        }}
      />

      {/* Raw ESC/POS Binary Diagnostic & Handshake Modal */}
      <RawEscPosTestModal
        isOpen={showRawEscPosModal}
        onClose={() => setShowRawEscPosModal(false)}
        settings={formData}
      />

      {/* Printer Troubleshooting & Setup Guide Modal */}
      <PrinterTroubleshootModal
        isOpen={showTroubleshootModal}
        onClose={() => setShowTroubleshootModal(false)}
        settings={formData}
      />

    </div>
  );
};
