import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Usb, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  ExternalLink, 
  X, 
  FileText, 
  Layers, 
  Sparkles, 
  Cpu,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Scissors,
  DollarSign,
  QrCode,
  Radio,
  Settings
} from 'lucide-react';
import { PrinterConnectionService, ConnectedPrinterInfo } from '../../services/printerConnectionService';
import { EscPosService } from '../../services/escposService';
import { Bill, BillItem, RestaurantSettings } from '../../types';

interface DirectHardwarePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: RestaurantSettings;
}

export const DirectHardwarePrintModal: React.FC<DirectHardwarePrintModalProps> = ({
  isOpen,
  onClose,
  settings
}) => {
  const [printerInfo, setPrinterInfo] = useState<ConnectedPrinterInfo>(
    PrinterConnectionService.getConnectedPrinter()
  );
  const [connecting, setConnecting] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'serial' | 'usb' | 'kiosk' | 'guide'>('serial');
  const [baudRate, setBaudRate] = useState<number>(PrinterConnectionService.getStoredBaudRate());

  const capabilities = PrinterConnectionService.getCapabilities();
  const isSandboxed = capabilities.isSandboxed;

  useEffect(() => {
    if (isOpen) {
      setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
      setBaudRate(PrinterConnectionService.getStoredBaudRate());
      setErrorMsg(null);
      setTestPrintStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isHardwareReady = PrinterConnectionService.isDirectHardwareReady();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-3mi4wixk2slanobdrhert5-832296029688.asia-east1.run.app';

  const handleOpenStandalone = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  const handleBaudRateChange = (newRate: number) => {
    setBaudRate(newRate);
    PrinterConnectionService.setStoredBaudRate(newRate);
    setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
  };

  const handleConnectSerial = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const result = await PrinterConnectionService.connectSerial(baudRate);
      if (result.success) {
        setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
        setTestPrintStatus(`Rugtek RP326 connected via Web Serial API @ ${baudRate} baud! Zero print dialogs.`);
      } else {
        setErrorMsg(result.error || 'Failed to connect Serial port');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectUsb = async () => {
    setConnecting(true);
    setErrorMsg(null);
    try {
      const result = await PrinterConnectionService.connectUsb();
      if (result.success) {
        setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
        setTestPrintStatus('Rugtek RP326 paired via Direct WebUSB! Press [Ctrl] to print.');
      } else {
        setErrorMsg(result.error || 'Failed to connect USB device');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleTestEscPosPrint = async () => {
    setTestPrintStatus('Sending raw ESC/POS test receipt to thermal printer...');
    setErrorMsg(null);

    try {
      const sampleBill: Bill = {
        id: 'test-hardware-bill',
        businessDate: new Date().toISOString().slice(0, 10),
        billNumber: 'TEST-01',
        orderType: 'DINE_IN',
        priceType: 'NON_AC',
        tableNumber: 'T1',
        userId: 'admin',
        userName: 'Cashier',
        subtotal: 100,
        discount: 0,
        grandTotal: 100,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        reprintCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const sampleItems: BillItem[] = [
        {
          id: 't-1',
          billId: 'test-hardware-bill',
          itemId: 'm-1',
          itemCode: '101',
          itemName: 'Ghee Roast Dosa',
          itemNameTamil: 'நெய் ரோஸ்ட் தோசை',
          quantity: 1,
          unitPrice: 100,
          totalPrice: 100,
          priceType: 'NON_AC',
          createdAt: Date.now()
        }
      ];

      const escposBytes = EscPosService.generateBillEscPosBuffer(sampleBill, sampleItems, settings);
      const res = await PrinterConnectionService.sendRawBytes(escposBytes);

      if (res.success) {
        setTestPrintStatus(`Receipt printed & cut successfully via ${res.channel}! Direct hardware connection is 100% operational.`);
        PrinterConnectionService.markTestPrintVerified();
        setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
      } else {
        setErrorMsg(res.error || 'Direct thermal communication failed. Check cable and port.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing test print');
    }
  };

  const handleTestPaperCut = async () => {
    setTestPrintStatus('Testing auto-cutter...');
    setErrorMsg(null);
    try {
      const res = await PrinterConnectionService.testPaperCut();
      if (res.success) {
        setTestPrintStatus('Auto-cutter signal sent! Paper feed & cut complete.');
      } else {
        setErrorMsg(res.error || 'Failed to trigger paper cutter');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Cutter test error');
    }
  };

  const handleTestCashDrawer = async () => {
    setTestPrintStatus('Sending 24V RJ11 cash drawer kick pulse...');
    setErrorMsg(null);
    try {
      const res = await PrinterConnectionService.testCashDrawer();
      if (res.success) {
        setTestPrintStatus('Cash drawer kick pulse sent! Drawer should pop open.');
      } else {
        setErrorMsg(res.error || 'Failed to trigger cash drawer');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Drawer test error');
    }
  };

  const handleTestBarcodesAndQr = async () => {
    setTestPrintStatus('Printing Barcode (CODE128) & UPI 2D QR Code...');
    setErrorMsg(null);
    try {
      const res = await PrinterConnectionService.testBarcodesAndQr('Rugtek RP326');
      if (res.success) {
        setTestPrintStatus('Barcode & QR Code pattern printed successfully!');
      } else {
        setErrorMsg(res.error || 'Failed to print Barcode/QR pattern');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Barcode test error');
    }
  };

  const handleDownloadKioskBat = () => {
    PrinterConnectionService.downloadSilentKioskBatScript(currentUrl);
    setTestPrintStatus('Downloaded Launch_POS_Silent_Printing.bat! Double-click it on Windows to run with 0-click instant printing.');
  };

  const handleDisconnect = () => {
    PrinterConnectionService.disconnect();
    setPrinterInfo(PrinterConnectionService.getConnectedPrinter());
    setTestPrintStatus(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Direct Hardware 0-Click Thermal Printing
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Rugtek RP326 (80mm)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bypass Google Chrome's preview page completely. Press <strong className="text-amber-300 font-mono">[Ctrl]</strong> for immediate printing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sandboxed Iframe Advisory */}
        {isSandboxed && (
          <div className="p-3 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Chrome restricts hardware device pairing in preview iframes. Open in a standalone tab to unlock direct USB/COM access.</span>
            </div>
            <button
              type="button"
              onClick={handleOpenStandalone}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Full Window</span>
            </button>
          </div>
        )}

        {/* Live Hardware Status Banner */}
        <div className="p-3 sm:px-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {isHardwareReady ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <div className="text-xs">
              <span className="text-slate-400">Connection Mode: </span>
              <strong className={isHardwareReady ? 'text-emerald-400' : 'text-amber-400'}>
                {printerInfo.interfaceType === 'WEB_SERIAL'
                  ? `Web Serial API (Direct COM @ ${printerInfo.baudRate || 19200} baud)`
                  : printerInfo.interfaceType === 'WEB_USB'
                  ? 'WebUSB API (Direct Bulk Transfer)'
                  : 'OS Spooler / System Driver'}
              </strong>
              <span className="text-slate-400 ml-2">Device: </span>
              <span className="text-slate-200 font-mono">{printerInfo.deviceName}</span>
            </div>
          </div>
          {isHardwareReady && (
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-[11px] font-bold text-red-400 hover:text-red-300 underline cursor-pointer"
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('serial')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'serial'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Option 1: Web Serial API (Recommended)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('usb')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'usb'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            <span>Option 2: WebUSB API</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kiosk')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'kiosk'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Option 3: Silent Launcher (.bat)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'guide'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Hardware Tests &amp; [Ctrl]</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-200 text-xs">
          {/* Notifications */}
          {testPrintStatus && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{testPrintStatus}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-300 font-bold flex items-center gap-2 animate-in shake">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Web Serial API */}
          {activeTab === 'serial' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Radio className="w-4 h-4" />
                    <span>Web Serial API: Driver-Level COM Communication</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">
                    Windows Recommended
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  On Windows, the Rugtek RP326 connects as a virtual COM port (e.g. COM3 / COM4) or USB-to-UART bridge.
                  The <strong>Web Serial API</strong> communicates directly with the printer hardware, completely bypassing Chrome's print dialog and avoiding Windows <code className="text-amber-300 font-mono">usbprint.sys</code> driver lockouts!
                </p>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex flex-wrap items-center gap-3">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>RP326 Baud Rate:</span>
                  </label>
                  <select
                    value={baudRate}
                    onChange={(e) => handleBaudRateChange(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 text-amber-300 font-mono rounded px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                  >
                    {PrinterConnectionService.SUPPORTED_BAUD_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate} bps {rate === 19200 ? '(Rugtek Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400">
                    Default for Rugtek RP326 is 19200 baud, 8 data bits, no parity (8N1).
                  </span>
                </div>

                <div className="pt-1 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleConnectSerial}
                    disabled={connecting}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Radio className="w-4 h-4" />
                    <span>{connecting ? 'Detecting Ports...' : '🔌 Pair Rugtek RP326 via Serial / COM'}</span>
                  </button>

                  {isHardwareReady && (
                    <button
                      type="button"
                      onClick={handleTestEscPosPrint}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <FileText className="w-4 h-4" />
                      <span>⚡ Test Receipt &amp; Auto-Cut</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-1.5 text-blue-300 text-[11px] leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-blue-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>How to pair in Chrome:</span>
                </div>
                <p>
                  Click "Pair Rugtek RP326 via Serial / COM". Chrome will open a small prompt at the top left showing detected ports (e.g. <em>"USB-Serial"</em> or <em>"Communications Port"</em>). Select it and click <strong>"Connect"</strong>. You only do this once; Chrome remembers the permission!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Direct WebUSB */}
          {activeTab === 'usb' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Usb className="w-4 h-4" />
                  <span>Direct WebUSB API Connection</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  WebUSB connects to the printer's raw USB bulk out endpoint.
                  When paired, raw binary ESC/POS bytes stream through the cable without opening any Google preview page.
                </p>

                <div className="pt-2 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleConnectUsb}
                    disabled={connecting}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Usb className="w-4 h-4" />
                    <span>{connecting ? 'Detecting USB Devices...' : '🔌 Pair Rugtek RP326 USB Device'}</span>
                  </button>

                  {isHardwareReady && (
                    <button
                      type="button"
                      onClick={handleTestEscPosPrint}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <FileText className="w-4 h-4" />
                      <span>⚡ Test Receipt &amp; Auto-Cut</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-slate-400 text-[11px] leading-relaxed">
                <div className="font-bold text-slate-300">Windows Driver Note:</div>
                <p>
                  If Windows shows <em>"Unable to claim interface"</em>, it means the Windows OS thermal driver (usbprint.sys) has locked the USB port. Simply switch to <strong>Option 1 (Web Serial API)</strong> or <strong>Option 3 (Silent Launcher)</strong> which both bypass this limitation entirely.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Silent Windows Kiosk Launcher */}
          {activeTab === 'kiosk' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Download className="w-4 h-4" />
                  <span>Windows 1-Click Silent POS Mode (Kiosk Printing)</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  If your Rugtek RP326 is installed through its standard Windows driver, you can completely silence Chrome's print preview screen using Chrome's native <code className="text-amber-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">--kiosk-printing</code> engine.
                </p>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                  <div className="text-xs font-bold text-amber-300">Quick 2-Step Setup:</div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                    <li>
                      Set <strong>Rugtek RP326</strong> as your <strong>Default Printer</strong> in Windows Settings (Printers &amp; Scanners).
                    </li>
                    <li>
                      Click the button below to download the launcher script, then double-click it to start POS:
                    </li>
                  </ol>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadKioskBat}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Download className="w-4 h-4" />
                      <span>📥 Download "Launch_POS_Silent_Printing.bat"</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5 text-[11px] text-slate-400">
                  <div className="font-bold text-slate-200">Zero Preview Guarantee:</div>
                  <p>
                    The script launches Chrome with <code className="text-emerald-400 font-mono">--kiosk-printing</code>. Whenever you tap the <strong>[Ctrl]</strong> key, Chrome sends the receipt straight to the Rugtek RP326 printer with <strong>0 milliseconds delay</strong> and <strong>0 preview screens</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Hardware Tests & Shortcuts */}
          {activeTab === 'guide' && (
            <div className="space-y-4">
              {/* Direct Hardware Diagnostic Test Pad */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Interactive Hardware Diagnostics Pad</span>
                </div>
                <p className="text-slate-300 text-[11px]">
                  Verify individual printer sub-systems directly without having to create an order:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestEscPosPrint}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer group"
                  >
                    <FileText className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white text-[11px]">Full Bill Slip</span>
                    <span className="text-[10px] text-slate-400">ESC/POS Text</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestPaperCut}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer group"
                  >
                    <Scissors className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white text-[11px]">Test Cutter</span>
                    <span className="text-[10px] text-slate-400">GS V 66 0</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestCashDrawer}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer group"
                  >
                    <DollarSign className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white text-[11px]">Cash Drawer</span>
                    <span className="text-[10px] text-slate-400">24V Solenoid</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTestBarcodesAndQr}
                    className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer group"
                  >
                    <QrCode className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-white text-[11px]">Barcode &amp; QR</span>
                    <span className="text-[10px] text-slate-400">CODE128 + UPI</span>
                  </button>
                </div>
              </div>

              {/* Shortcuts */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  <span>Active POS Keyboard Shortcuts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div className="p-3 bg-slate-900 border border-amber-500/30 rounded-xl space-y-1">
                    <div className="font-bold text-amber-300 font-mono text-xs flex items-center justify-between">
                      <span>[Ctrl] (Tap alone)</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Fastest</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Tapping the <strong>Ctrl</strong> key alone immediately saves the bill and fires the thermal receipt printhead!
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <div className="font-bold text-slate-200 font-mono text-xs">
                      <span>[Ctrl + Enter]</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Save bill as Cash &amp; instant direct print (standard POS combo).
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <div className="font-bold text-slate-200 font-mono text-xs">
                      <span>[F10]</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Quick 1-key cash settlement and direct receipt output.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <div className="font-bold text-slate-200 font-mono text-xs">
                      <span>[F7] or [Alt + R]</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Instantly reprint the previous customer's receipt.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Thermal Roll: <strong className="text-slate-200">80mm (3-Inch) Rugtek RP326</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
