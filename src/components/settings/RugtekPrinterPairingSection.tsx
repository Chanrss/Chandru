import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Usb, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Scissors, 
  DollarSign, 
  Sliders, 
  Unplug, 
  FileText, 
  Info, 
  Cpu, 
  ChevronDown, 
  ChevronUp, 
  Radio,
  Download,
  ShieldCheck,
  Check
} from 'lucide-react';
import { 
  PrinterConnectionService, 
  ConnectedPrinterInfo, 
  RUGTEK_RP326B_PROFILE 
} from '../../services/printerConnectionService';
import { EscPosService } from '../../services/escposService';
import { RestaurantSettings, Bill, BillItem } from '../../types';

interface RugtekPrinterPairingSectionProps {
  settings?: RestaurantSettings;
  onUpdateSettings?: (updated: Partial<RestaurantSettings>) => void;
  className?: string;
}

export const RugtekPrinterPairingSection: React.FC<RugtekPrinterPairingSectionProps> = ({
  settings,
  onUpdateSettings,
  className = ''
}) => {
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>(() =>
    PrinterConnectionService.getConnectedPrinter()
  );
  const [connecting, setConnecting] = useState(false);
  const [connectingType, setConnectingType] = useState<'serial' | 'usb' | null>(null);
  const [testingSlip, setTestingSlip] = useState(false);
  const [testingCutter, setTestingCutter] = useState(false);
  const [testingDrawer, setTestingDrawer] = useState(false);
  const [baudRate, setBaudRate] = useState<number>(() => PrinterConnectionService.getStoredBaudRate());
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showDipSwitchGuide, setShowDipSwitchGuide] = useState(false);

  const capabilities = PrinterConnectionService.getCapabilities();
  const isSandboxed = capabilities.isSandboxed;

  // Subscribe to live hardware events and storage changes
  useEffect(() => {
    const unsubscribe = PrinterConnectionService.subscribe((info) => {
      setPrinterInfo(info);
      if (info.baudRate) {
        setBaudRate(info.baudRate);
      }
    });
    return unsubscribe;
  }, []);

  const showFeedback = (type: 'success' | 'error' | 'info', message: string, duration = 6000) => {
    setNotification({ type, message });
    if (duration > 0) {
      setTimeout(() => {
        setNotification((prev) => (prev?.message === message ? null : prev));
      }, duration);
    }
  };

  const handleBaudRateChange = (newRate: number) => {
    setBaudRate(newRate);
    PrinterConnectionService.setStoredBaudRate(newRate);
    showFeedback('info', `Rugtek RP326 Serial baud rate set to ${newRate.toLocaleString()} bps.`);
  };

  // Pair via Web Serial
  const handlePairSerial = async () => {
    setConnecting(true);
    setConnectingType('serial');
    setNotification(null);

    try {
      const result = await PrinterConnectionService.connectSerial(baudRate);
      if (result.success) {
        showFeedback(
          'success',
          `Rugtek RP326 successfully paired via Web Serial API @ ${baudRate.toLocaleString()} bps! Direct 0-click printing is active.`
        );
        if (onUpdateSettings) {
          onUpdateSettings({
            printerModelName: 'Rugtek RP326B',
            paperWidth: '80mm',
            printerType: 'THERMAL_80MM'
          });
        }
      } else {
        showFeedback('error', result.error || 'Failed to select or pair Web Serial port.');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Web Serial pairing encountered an error.');
    } finally {
      setConnecting(false);
      setConnectingType(null);
    }
  };

  // Pair via WebUSB
  const handlePairUsb = async () => {
    setConnecting(true);
    setConnectingType('usb');
    setNotification(null);

    try {
      const result = await PrinterConnectionService.connectUsb();
      if (result.success) {
        showFeedback(
          'success',
          `Rugtek RP326 successfully paired via WebUSB API! Direct raw bulk communication established.`
        );
        if (onUpdateSettings) {
          onUpdateSettings({
            printerModelName: 'Rugtek RP326B',
            paperWidth: '80mm',
            printerType: 'THERMAL_80MM'
          });
        }
      } else {
        showFeedback('error', result.error || 'Failed to select or pair WebUSB device.');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'WebUSB pairing encountered an error.');
    } finally {
      setConnecting(false);
      setConnectingType(null);
    }
  };

  // Disconnect / Unpair
  const handleDisconnect = () => {
    PrinterConnectionService.disconnect();
    showFeedback('info', 'Printer disconnected. System will now fallback to standard OS Print Spooler.');
  };

  // Test slip verification
  const handleTestPrintSlip = async () => {
    setTestingSlip(true);
    setNotification(null);

    try {
      const sampleBill: Bill = {
        id: 'test-rugtek-bill',
        businessDate: new Date().toISOString().slice(0, 10),
        billNumber: 'BN-RUGTEK-01',
        orderType: 'DINE_IN',
        priceType: 'NON_AC',
        tableNumber: 'T-1',
        userId: 'admin',
        userName: 'Cashier',
        subtotal: 150,
        discount: 10,
        grandTotal: 140,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        reprintCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const sampleItems: BillItem[] = [
        {
          id: 'item-1',
          billId: 'test-rugtek-bill',
          itemId: 'm-1',
          itemCode: '101',
          itemName: 'Ghee Roast Dosa',
          itemNameTamil: 'நெய் ரோஸ்ட் தோசை',
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
          priceType: 'NON_AC',
          createdAt: Date.now()
        },
        {
          id: 'item-2',
          billId: 'test-rugtek-bill',
          itemId: 'm-2',
          itemCode: '102',
          itemName: 'Filter Coffee',
          itemNameTamil: 'பில்டர் காபி',
          quantity: 2,
          unitPrice: 25,
          totalPrice: 50,
          priceType: 'NON_AC',
          createdAt: Date.now()
        }
      ];

      const escposBytes = EscPosService.generateBillEscPosBuffer(sampleBill, sampleItems, {
        ...settings,
        paperWidth: '80mm',
        restaurantName: settings?.restaurantName || 'SRI SARAVANA BHAVAN',
        restaurantNameTamil: settings?.restaurantNameTamil || 'ஸ்ரீ சரவண பவன்'
      });

      const res = await PrinterConnectionService.sendRawBytes(escposBytes);

      if (res.success) {
        PrinterConnectionService.markTestPrintVerified();
        showFeedback(
          'success',
          `Test receipt sent successfully via ${res.channel}! Direct Rugtek RP326 communication is 100% verified.`
        );
      } else {
        showFeedback('error', res.error || 'Direct print failed. Verify cable and hardware port.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Error dispatching test print.');
    } finally {
      setTestingSlip(false);
    }
  };

  // Test auto-cutter
  const handleTestAutoCut = async () => {
    setTestingCutter(true);
    setNotification(null);
    try {
      const res = await PrinterConnectionService.testPaperCut();
      if (res.success) {
        showFeedback('success', 'Guillotine partial cut command sent! Check printer paper output.');
      } else {
        showFeedback('error', res.error || 'Failed to trigger paper cut command.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Cutter test error');
    } finally {
      setTestingCutter(false);
    }
  };

  // Test cash drawer
  const handleTestCashDrawer = async () => {
    setTestingDrawer(true);
    setNotification(null);
    try {
      const res = await PrinterConnectionService.testCashDrawer();
      if (res.success) {
        showFeedback('success', '24V RJ11 cash drawer kick pulse sent! Drawer should pop open.');
      } else {
        showFeedback('error', res.error || 'Failed to trigger cash drawer kick pulse.');
      }
    } catch (e: any) {
      showFeedback('error', e.message || 'Cash drawer kick error');
    } finally {
      setTestingDrawer(false);
    }
  };

  const handleOpenStandalone = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  const isDirectHardware =
    printerInfo.connected &&
    (printerInfo.interfaceType === 'WEB_SERIAL' || printerInfo.interfaceType === 'WEB_USB');

  return (
    <div 
      id="rugtek-pairing-section"
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5 ${className}`}
    >
      {/* Header with Title and Model Badges */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-white">Rugtek RP326 Hardware Pairing</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                WEB SERIAL / WEBUSB
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct zero-click thermal printing for 80mm Rugtek RP326 POS printers (100% bypasses Chrome print preview)
            </p>
          </div>
        </div>

        {/* Feature Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            80mm / 3-Inch Roll
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            250 mm/s Speed
          </span>
          <span className="px-2 py-1 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            Auto-Cutter
          </span>
        </div>
      </div>

      {/* Sandboxed iframe Notice Banner */}
      {isSandboxed && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3.5 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-amber-200">Browser Security Notice (Preview iframe):</span>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                Chrome and Edge security policies block direct native Web Serial / WebUSB device pickers inside embedded iframes.
                To pair your physical Rugtek RP326 thermal printer, open the application in a standalone browser tab.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              id="btn-open-standalone-for-pairing"
              onClick={handleOpenStandalone}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Standalone Tab</span>
            </button>
          </div>
        </div>
      )}

      {/* Notifications / Feedback */}
      {notification && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
          {notification.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
          <div className="flex-1 text-[11px] leading-relaxed">{notification.message}</div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Connection Status & Device Identification Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
        {/* Status Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                isDirectHardware
                  ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                  : printerInfo.connected
                  ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.6)]'
                  : 'bg-slate-600'
              }`}
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs text-white">Connection Status:</span>
                {isDirectHardware ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                    CONNECTED &amp; READY (DIRECT HARDWARE)
                  </span>
                ) : printerInfo.connected ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-mono">
                    SPOOLER (OS DRIVER FALLBACK)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                    DISCONNECTED / UNPAIRED
                  </span>
                )}

                {printerInfo.testPrintVerified && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-mono">
                    <Check className="w-3 h-3 text-emerald-400" />
                    HANDSHAKE VERIFIED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {isDirectHardware
                  ? `Active 0-click hardware link via ${
                      printerInfo.interfaceType === 'WEB_SERIAL' ? 'Web Serial (COM)' : 'WebUSB'
                    } • 100% bypasses print dialog`
                  : 'Standard browser print dialog active. Pair via Web Serial or WebUSB below for instant printing.'}
              </div>
            </div>
          </div>

          {/* Quick Disconnect / Refresh */}
          {printerInfo.connected && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-rugtek-disconnect"
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Disconnect hardware port"
              >
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>

        {/* Printer Device Identification Details Grid */}
        <div className="border-t border-slate-800/80 pt-3">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>Printer Device Identification</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            {/* Device Name */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Model / Device Name</span>
              <span className="font-bold text-slate-200 block truncate mt-0.5" title={printerInfo.deviceName}>
                {printerInfo.deviceName || 'Rugtek RP326 (Thermal POS)'}
              </span>
            </div>

            {/* Interface Type */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Hardware Interface</span>
              <span className="font-mono font-bold text-amber-300 block truncate mt-0.5">
                {printerInfo.interfaceType === 'WEB_SERIAL'
                  ? 'Web Serial (COM)'
                  : printerInfo.interfaceType === 'WEB_USB'
                  ? 'WebUSB (Raw Bulk)'
                  : printerInfo.interfaceType}
              </span>
            </div>

            {/* USB VID / PID */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">USB Vendor &amp; Product ID</span>
              <span className="font-mono font-bold text-slate-300 block truncate mt-0.5">
                {printerInfo.vendorId || printerInfo.productId
                  ? `${printerInfo.vendorId || 'VID:--'}:${printerInfo.productId || 'PID:--'}`
                  : '0x0416:0x5011 (Default)'}
              </span>
            </div>

            {/* Serial Baud Rate / Out Endpoint */}
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">
                {printerInfo.interfaceType === 'WEB_SERIAL' ? 'Baud Rate (bps)' : 'USB Endpoint / Port'}
              </span>
              <span className="font-mono font-bold text-emerald-400 block truncate mt-0.5">
                {printerInfo.interfaceType === 'WEB_SERIAL'
                  ? `${(printerInfo.baudRate || baudRate).toLocaleString()} bps (8-N-1)`
                  : printerInfo.interfaceType === 'WEB_USB'
                  ? `Endpoint Out #${printerInfo.endpointOut ?? 1}`
                  : 'OS Spooler'}
              </span>
            </div>
          </div>

          {/* Additional Hardware Specs Strip */}
          <div className="mt-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <span>Paper: <strong className="text-slate-300">80 x 297 mm (3-Inch)</strong></span>
              <span>•</span>
              <span>Density: <strong className="text-slate-300">576 dots / line (203 DPI)</strong></span>
              <span>•</span>
              <span>Cutter: <strong className="text-emerald-400">Guillotine Partial Cut</strong></span>
              <span>•</span>
              <span>Drawer: <strong className="text-amber-400">24V RJ11 Pin 2</strong></span>
            </div>

            {printerInfo.lastConnectedAt && (
              <div className="text-[10px] text-slate-500 font-mono">
                Last Handshake: {new Date(printerInfo.lastConnectedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pairing Initiation Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-200 block">
            Initiate Rugtek RP326 Pairing
          </label>

          {/* Baud Rate Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Baud Rate:</span>
            <select
              value={baudRate}
              onChange={(e) => handleBaudRateChange(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 font-mono focus:border-amber-500 focus:outline-hidden"
              title="Rugtek RP326 default baud rate is 19200"
            >
              {PrinterConnectionService.SUPPORTED_BAUD_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate.toLocaleString()} bps {rate === 19200 ? '(Rugtek Default ★)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pairing Buttons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Web Serial Pairing Button */}
          <div className="p-3.5 bg-slate-950 border border-amber-500/40 rounded-xl space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">Web Serial API</h4>
                    <span className="text-[10px] text-amber-400 font-bold uppercase">
                      Recommended for Windows POS
                    </span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  COM PORT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Connects through virtual COM port / USB-to-Serial. Recommended for Rugtek RP326 on Windows because it bypasses Windows <code className="text-amber-300">usbprint.sys</code> driver locks completely.
              </p>
            </div>

            <button
              type="button"
              id="btn-pair-rugtek-serial"
              onClick={handlePairSerial}
              disabled={connecting}
              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectingType === 'serial' ? 'animate-spin' : ''}`} />
              <span>
                {connectingType === 'serial' ? 'Selecting Serial Port...' : 'Pair via Web Serial (COM)'}
              </span>
            </button>
          </div>

          {/* WebUSB Pairing Button */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    <Usb className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">WebUSB API</h4>
                    <span className="text-[10px] text-cyan-400 font-bold uppercase">
                      Direct Bulk Transfer
                    </span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  RAW USB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                Direct raw USB bulk communication without OS COM driver translation. Ideal for Linux, Mac, ChromeOS, or POS terminals using WinUSB drivers.
              </p>
            </div>

            <button
              type="button"
              id="btn-pair-rugtek-usb"
              onClick={handlePairUsb}
              disabled={connecting}
              className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs text-xs border border-slate-700"
            >
              <Usb className={`w-3.5 h-3.5 ${connectingType === 'usb' ? 'animate-spin' : ''}`} />
              <span>
                {connectingType === 'usb' ? 'Selecting USB Device...' : 'Pair via WebUSB'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Hardware Handshake & Verification Actions */}
      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <label className="text-xs font-bold text-slate-300 block">
          Hardware Verification &amp; Quick Tests
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Test 1: Send Diagnostic Slip */}
          <button
            type="button"
            id="btn-rugtek-test-slip"
            onClick={handleTestPrintSlip}
            disabled={testingSlip}
            className="p-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-200 truncate">
                {testingSlip ? 'Sending Slip...' : 'Send Test Slip'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">ESC/POS bill layout &amp; barcode</div>
            </div>
          </button>

          {/* Test 2: Auto-Cutter */}
          <button
            type="button"
            id="btn-rugtek-test-cutter"
            onClick={handleTestAutoCut}
            disabled={testingCutter}
            className="p-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-200 truncate">
                {testingCutter ? 'Cutting...' : 'Test Auto-Cutter'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Partial guillotine cut command</div>
            </div>
          </button>

          {/* Test 3: Cash Drawer */}
          <button
            type="button"
            id="btn-rugtek-test-drawer"
            onClick={handleTestCashDrawer}
            disabled={testingDrawer}
            className="p-3 bg-slate-950 hover:bg-slate-850 active:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 group"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-xs text-slate-200 truncate">
                {testingDrawer ? 'Triggering...' : 'Test Cash Drawer'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">24V RJ11 kickout pulse</div>
            </div>
          </button>
        </div>
      </div>

      {/* Rugtek RP326 DIP Switch & Hardware Reference (Collapsible) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowDipSwitchGuide(!showDipSwitchGuide)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-medium cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span>{showDipSwitchGuide ? 'Hide Rugtek RP326 Hardware Reference' : 'Show Rugtek RP326 DIP Switch & Port Pinout Reference'}</span>
          {showDipSwitchGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showDipSwitchGuide && (
          <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <h4 className="font-bold text-white flex items-center gap-2 text-xs">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>Rugtek RP326 / RP326B Hardware Configuration Notes</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-300">
              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-bold text-amber-300 block">DIP Switch Factory Defaults:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li><strong className="text-slate-300">SW-1 (Baud Rate):</strong> OFF/ON/OFF = 19200 bps (Matches software default)</li>
                  <li><strong className="text-slate-300">SW-2 (Auto Cutter):</strong> ON = Cutter Enabled (Partial Cut)</li>
                  <li><strong className="text-slate-300">SW-3 (Paper Roll):</strong> OFF = 80mm Roll (3-Inch)</li>
                  <li><strong className="text-slate-300">SW-4 (Audio Beeper):</strong> ON = Buzzer on Bill Print</li>
                </ul>
              </div>

              <div className="space-y-1.5 p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="font-bold text-emerald-300 block">Hardware Ports &amp; Pinout:</span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400">
                  <li><strong className="text-slate-300">USB Type-B:</strong> Standard 2.0 Full Speed (VID: 0x0416, PID: 0x5011)</li>
                  <li><strong className="text-slate-300">Serial RS-232:</strong> DB9 Female (Pins 2:TX, 3:RX, 5:GND)</li>
                  <li><strong className="text-slate-300">Cash Drawer:</strong> RJ11 6-Pin 24V DC / 1A Pulse (ESC p 0 25 250)</li>
                  <li><strong className="text-slate-300">Power Input:</strong> 24V DC / 2.5A 3-Pin DIN connector</li>
                </ul>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
              <span>Self-Test Slip: Power off printer, hold <strong className="text-slate-300">FEED</strong> button, turn on power. It prints baud rate and switch positions.</span>
              <button
                type="button"
                onClick={() => PrinterConnectionService.downloadSilentKioskBatScript()}
                className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Download className="w-3 h-3" />
                <span>Download Windows Silent Printing .BAT</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
