import React, { useState } from 'react';
import { Printer, ZoomIn, ZoomOut, Check, Sparkles, RefreshCw, Scissors } from 'lucide-react';
import { RestaurantSettings, BillItem } from '../../types';
import { DEFAULT_RESTAURANT_LOGO } from '../../data/defaultLogo';

interface LiveReceiptPreviewProps {
  settings: RestaurantSettings;
  onPaperWidthChange?: (width: '80mm' | '58mm') => void;
  onPrintTest?: () => void;
  isPrinting?: boolean;
  activeLogo?: string;
}

// Sample order presets for realistic previewing
export type SampleOrderType = 'tiffin' | 'family' | 'takeaway';

const SAMPLE_ORDERS: Record<SampleOrderType, { label: string; items: BillItem[]; table: string; billNo: string; orderType: string; discount: number }> = {
  tiffin: {
    label: 'Quick Tiffin (2 items)',
    billNo: '01',
    table: 'T-09',
    orderType: 'DINE_IN',
    discount: 0,
    items: [
      {
        id: '1',
        billId: 'preview-1',
        itemId: 'i1',
        itemCode: '101',
        itemName: 'Masala Dosa',
        itemNameTamil: 'மசால் தோசை',
        quantity: 1,
        unitPrice: 80,
        totalPrice: 80,
        priceType: 'NON_AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '2',
        billId: 'preview-1',
        itemId: 'i2',
        itemCode: '102',
        itemName: 'Filter Coffee',
        itemNameTamil: 'ஃபில்டர் காபி',
        quantity: 2,
        unitPrice: 35,
        totalPrice: 70,
        priceType: 'NON_AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      }
    ]
  },
  family: {
    label: 'Family Feast (5 items)',
    billNo: '42',
    table: 'T-04',
    orderType: 'DINE_IN',
    discount: 25,
    items: [
      {
        id: '1',
        billId: 'preview-2',
        itemId: 'i1',
        itemCode: '101',
        itemName: 'Ghee Roast',
        itemNameTamil: 'நெய் ரோஸ்ட்',
        quantity: 2,
        unitPrice: 110,
        totalPrice: 220,
        priceType: 'AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '2',
        billId: 'preview-2',
        itemId: 'i2',
        itemCode: '102',
        itemName: 'Idli Vada Combo',
        itemNameTamil: 'இட்லி வடை காம்போ',
        quantity: 2,
        unitPrice: 65,
        totalPrice: 130,
        priceType: 'AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '3',
        billId: 'preview-2',
        itemId: 'i3',
        itemCode: '103',
        itemName: 'Poori Masala',
        itemNameTamil: 'பூரி மசால்',
        quantity: 1,
        unitPrice: 75,
        totalPrice: 75,
        priceType: 'AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '4',
        billId: 'preview-2',
        itemId: 'i4',
        itemCode: '104',
        itemName: 'Meals (South Indian)',
        itemNameTamil: 'தென்னிந்திய சாப்பாடு',
        quantity: 1,
        unitPrice: 140,
        totalPrice: 140,
        priceType: 'AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '5',
        billId: 'preview-2',
        itemId: 'i5',
        itemCode: '105',
        itemName: 'Special Falooda',
        itemNameTamil: 'ஸ்பெஷல் பலூடா',
        quantity: 2,
        unitPrice: 90,
        totalPrice: 180,
        priceType: 'AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      }
    ]
  },
  takeaway: {
    label: 'Takeaway Parcel',
    billNo: '18',
    table: 'TA-02',
    orderType: 'TAKE_AWAY',
    discount: 0,
    items: [
      {
        id: '1',
        billId: 'preview-3',
        itemId: 'i1',
        itemCode: '201',
        itemName: 'Mushroom Biryani',
        itemNameTamil: 'காளான் பிரியாணி',
        quantity: 2,
        unitPrice: 160,
        totalPrice: 320,
        priceType: 'NON_AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '2',
        billId: 'preview-3',
        itemId: 'i2',
        itemCode: '202',
        itemName: 'Paneer Butter Masala',
        itemNameTamil: 'பனீர் பட்டர் மசாலா',
        quantity: 1,
        unitPrice: 180,
        totalPrice: 180,
        priceType: 'NON_AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      },
      {
        id: '3',
        billId: 'preview-3',
        itemId: 'i3',
        itemCode: '203',
        itemName: 'Chapathi (2 Pcs)',
        itemNameTamil: 'சப்பாத்தி (2 எண்ணிக்கை)',
        quantity: 2,
        unitPrice: 50,
        totalPrice: 100,
        priceType: 'NON_AC',
        businessDate: '2026-09-19',
        createdAt: Date.now()
      }
    ]
  }
};

export const LiveReceiptPreview: React.FC<LiveReceiptPreviewProps> = ({
  settings,
  onPaperWidthChange,
  onPrintTest,
  isPrinting = false,
  activeLogo
}) => {
  const [sampleType, setSampleType] = useState<SampleOrderType>('tiffin');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [logoError, setLogoError] = useState(false);

  const sampleOrder = SAMPLE_ORDERS[sampleType];
  const items = sampleOrder.items;
  const is58mm = settings.paperWidth === '58mm' || settings.printerType === 'THERMAL_58MM';
  const isCompact = Boolean(settings.compactMode) || settings.receiptFormat === 'compact';
  const format = settings.receiptFormat || (isCompact ? 'compact' : 'standard');

  // Base font size calculation
  const configuredBase = settings.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 11);
  const baseFontSize = isCompact 
    ? Math.max(8.5, Math.round(configuredBase * 0.90 * 10) / 10) 
    : configuredBase;

  // Header Title Scale
  const headerScaleMap = {
    normal: 1.35,
    large: 1.65,
    huge: 2.05
  };
  const headerScale = headerScaleMap[settings.receiptHeaderFontSize || (isCompact ? 'normal' : 'large')];
  const titleFontSize = Math.round(baseFontSize * headerScale * 10) / 10;

  // Item Names Scale
  const itemScaleMap = {
    normal: 1.25,
    large: 1.45,
    prominent: 1.70
  };
  const itemScale = itemScaleMap[settings.receiptItemFontSize || (format === 'tiffin_token' ? 'prominent' : 'large')];
  const itemFontSize = Math.round(baseFontSize * itemScale * 10) / 10;

  // Total Scale
  const totalScaleMap = {
    normal: 1.5,
    large: 1.85,
    huge: 2.25
  };
  const totalScale = totalScaleMap[settings.receiptTotalFontSize || (format === 'tiffin_token' ? 'huge' : 'large')];
  const totalFontSize = Math.round(baseFontSize * totalScale * 10) / 10;

  // Spacing values
  const lineSpacingMap = {
    tight: '1.12',
    normal: '1.25',
    relaxed: '1.42'
  };
  const lineHeight = lineSpacingMap[settings.receiptLineSpacing || (isCompact ? 'tight' : 'normal')];

  const sectionSpacingMap = {
    compact: 'py-1 my-1',
    normal: 'py-1.5 my-1.5',
    spacious: 'py-2.5 my-2.5'
  };
  const sectionSpacingClass = sectionSpacingMap[settings.receiptSectionSpacing || (isCompact ? 'compact' : 'normal')];

  const itemPaddingMap = {
    compact: 'py-0.5',
    normal: 'py-1',
    spacious: 'py-1.5'
  };
  const itemRowPadding = itemPaddingMap[settings.receiptItemPadding || (isCompact ? 'compact' : 'normal')];

  const paperMarginMap = {
    minimal: is58mm ? 'p-1.5' : 'p-2',
    normal: is58mm ? 'p-2' : 'p-3',
    spacious: is58mm ? 'p-3' : 'p-4'
  };
  const paperPaddingClass = paperMarginMap[settings.receiptPaperMargin || (isCompact ? 'minimal' : 'normal')];

  // Alignment
  const alignment = settings.receiptAlignment || 'center';
  const alignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';

  // Content visibility
  const showAddress = settings.receiptShowAddress !== false;
  const showPhone = settings.receiptShowPhone !== false;
  const showGstFssai = settings.receiptShowGstFssai !== false && (settings.gstNumber || settings.fssaiNumber);
  const showItemSl = settings.receiptShowItemSl !== false && format !== 'compact';
  const showTotalQty = settings.receiptShowTotalQty !== false;
  const showTamilName = settings.receiptShowTamilName !== false;
  const showEnglishName = settings.receiptShowEnglishName === true;

  // Computed totals
  const subtotal = items.reduce((acc, itm) => acc + itm.totalPrice, 0);
  const discount = sampleOrder.discount;
  const grandTotal = Math.max(0, subtotal - discount);
  const totalQty = items.reduce((acc, itm) => acc + itm.quantity, 0);

  // Address lines
  const rawAddress = settings.address || 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213';
  const formatAddressLines = (addr: string): string[] => {
    if (!addr) return [];
    if (addr.includes('\n')) return addr.split('\n').map(s => s.trim()).filter(Boolean);
    const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 2) {
      const mid = Math.ceil(parts.length / 2);
      return [parts.slice(0, mid).join(', '), parts.slice(mid).join(', ')];
    }
    return [addr];
  };
  const addressLines = formatAddressLines(rawAddress);

  const displayLogo = activeLogo || settings.logoUrl || DEFAULT_RESTAURANT_LOGO;
  const logoDisplay = (settings.logoDisplay && settings.logoDisplay !== 'watermark') ? settings.logoDisplay : 'both';
  const watermarkOpacity = settings.watermarkOpacity !== undefined ? settings.watermarkOpacity : 0.12;

  // Estimated paper length (approx based on item count, format, and spacing)
  const estimatedLengthCm = Math.round((7 + (items.length * (isCompact ? 0.9 : 1.3)) + (isCompact ? 0 : 2)) * 10) / 10;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Live Thermal Receipt Preview
            </h4>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time optical rendering • Updates immediately as you type or adjust
          </p>
        </div>

        {/* Paper Width & Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onPaperWidthChange && onPaperWidthChange(is58mm ? '80mm' : '58mm')}
            className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
              is58mm 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
            title="Click to toggle paper roll width"
          >
            {is58mm ? '58mm Roll' : '80mm Roll'}
          </button>

          <div className="h-4 w-px bg-slate-800 mx-0.5" />

          <button
            type="button"
            onClick={() => setZoomScale(z => Math.max(0.85, Math.round((z - 0.1) * 100) / 100))}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 w-8 text-center select-none">
            {Math.round(zoomScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoomScale(z => Math.min(1.25, Math.round((z + 0.1) * 100) / 100))}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sample Order Switcher Chips */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/60 text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-500 px-1">Sample:</span>
        <div className="flex gap-1 flex-1 overflow-x-auto">
          {(['tiffin', 'family', 'takeaway'] as SampleOrderType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSampleType(type)}
              className={`flex-1 min-w-[100px] py-1 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap text-center ${
                sampleType === type
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {SAMPLE_ORDERS[type].label.split('(')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Simulated Thermal Paper Stage */}
      <div className="flex justify-center p-3 bg-slate-950 rounded-xl border border-slate-800/80 overflow-x-auto min-h-[460px] relative">
        
        {/* Paper Container with Tear-Off Edges and Shadow */}
        <div
          id="live-receipt-paper"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            fontSize: `${baseFontSize}px`,
            lineHeight: lineHeight
          }}
          className={`relative bg-white text-black ${
            is58mm ? 'w-[235px]' : 'w-[295px]'
          } ${paperPaddingClass} shadow-2xl border-x border-slate-300 font-mono select-text transition-all duration-200`}
        >
          {/* Top Jagged Tear Edge */}
          <div 
            className="absolute -top-1.5 left-0 right-0 h-1.5 bg-white pointer-events-none"
            style={{
              clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)'
            }}
          />

          {/* Background Watermark Logo (if enabled) */}
          {(logoDisplay === 'watermark' || logoDisplay === 'both') && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
              <div 
                className="relative w-44 h-44 flex items-center justify-center transition-opacity duration-300"
                style={{ opacity: watermarkOpacity }}
              >
                <img 
                  src={displayLogo} 
                  alt="Watermark Logo" 
                  className="w-40 h-40 object-contain drop-shadow-[0_0_6px_rgba(0,0,0,0.2)]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Receipt Foreground Content Layer */}
          <div className="relative z-10">

            {/* Top Header Logo if enabled */}
            {(logoDisplay === 'header' || logoDisplay === 'both') && (
              <div 
                className="receipt-logo-container mb-2"
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                  margin: `0 auto ${isCompact ? '2px' : '5px'} auto`,
                  padding: 0
                }}
              >
                {logoError ? (
                  <div className="receipt-logo-error text-red-600 font-bold text-center text-xs py-1.5 px-2 border border-red-300 bg-red-50 rounded my-1 max-w-[220px] mx-auto">
                    Original logo asset is unavailable
                  </div>
                ) : (
                  <img 
                    src={displayLogo} 
                    alt="Sri Saravana Bhavan Official Logo" 
                    onError={() => setLogoError(true)}
                    style={{
                      maxWidth: `${settings.receiptLogoMaxWidth || 85}px`,
                      maxHeight: `${settings.receiptLogoMaxHeight || 85}px`,
                      width: 'auto',
                      height: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                      marginLeft: 'auto',
                      marginRight: 'auto'
                    }}
                    className="receipt-logo drop-shadow-xs"
                    referrerPolicy="no-referrer"
                  />
                )}
              </div>
            )}

            {/* SPECIAL FORMAT: TIFFIN TOKEN BANNER (If tiffin_token format) */}
            {format === 'tiffin_token' && (
              <div className="mb-2 p-1.5 border-2 border-black text-center bg-slate-50">
                <div className="text-[10px] font-bold uppercase tracking-widest text-black">TOKEN / BILL SLIP</div>
                <div className="text-[26px] font-black leading-none py-0.5 text-black">
                  #{sampleOrder.billNo}
                </div>
                <div className="text-[11px] font-bold text-black flex justify-between px-2 pt-0.5 border-t border-dashed border-black">
                  <span>{sampleOrder.table}</span>
                  <span>{sampleOrder.orderType}</span>
                </div>
              </div>
            )}

            {/* 1. Header: Restaurant Names & Contact */}
            <div className={`mb-1 ${alignClass}`}>
              {showTamilName && (
                <div 
                  style={{ fontSize: `${titleFontSize}px` }}
                  className="font-extrabold tracking-wide text-black leading-tight font-sans"
                >
                  {settings.restaurantNameTamil || 'ஸ்ரீ சரவண பவன்'}
                </div>
              )}

              {showEnglishName && (
                <div 
                  style={{ fontSize: `${Math.round(titleFontSize * 0.85)}px` }}
                  className="font-bold tracking-normal text-black leading-tight uppercase font-sans mt-0.5"
                >
                  {settings.restaurantName || 'Sri Saravanan Bhavan'}
                </div>
              )}

              {showAddress && (
                <div className="text-[9.5px] sm:text-[10px] text-black mt-0.5 leading-tight space-y-0.5">
                  {addressLines.map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              )}

              {showPhone && (
                <div className="text-[10px] text-black font-semibold mt-0.5">
                  PH: {settings.phone || '7708159933'}
                </div>
              )}

              {showGstFssai && (
                <div className="font-semibold text-slate-800 text-[8.5px] sm:text-[9px] mt-0.5">
                  {settings.gstNumber ? `GSTIN: ${settings.gstNumber}` : ''}
                  {(settings.gstNumber && settings.fssaiNumber) ? ' | ' : ''}
                  {settings.fssaiNumber ? `FSSAI: ${settings.fssaiNumber}` : ''}
                </div>
              )}

              {/* SPECIAL FORMAT: GST TAX INVOICE HEADER BANNER */}
              {format === 'gst_tax_invoice' && (
                <div className="my-1 py-0.5 border border-black text-[9.5px] font-black uppercase text-center bg-slate-50">
                  TAX INVOICE / GST BILL
                </div>
              )}
            </div>

            {/* 2. Bill Meta Information (Single line or split lines) */}
            <div className={`${sectionSpacingClass} border-t border-b border-dashed border-black text-[11px] sm:text-[12px] space-y-0.5`}>
              <div className="flex justify-between items-center font-bold text-black">
                <span>Bill No : BN-{sampleOrder.billNo}</span>
                <span>Date : {new Date().toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between items-center text-black">
                <span>Cap No : 1 ({sampleOrder.table})</span>
                <span>Time : {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* 3. Items Table */}
            <table className="w-full text-[11px] sm:text-[12px] my-1 border-collapse table-fixed" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="text-left text-black border-y border-black font-bold">
                  {showItemSl && <th className="py-0.5 font-bold w-[8%] text-left whitespace-nowrap">#</th>}
                  <th className={`py-0.5 pr-1 font-bold ${showItemSl ? 'w-[44%]' : 'w-[52%]'} text-left break-words`}>
                    பொருள்
                  </th>
                  <th className="py-0.5 text-right font-bold w-[14%] whitespace-nowrap">Qty</th>
                  <th className="py-0.5 text-right font-bold w-[17%] whitespace-nowrap">Price</th>
                  <th className="py-0.5 text-right font-bold w-[17%] whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-300">
                {items.map((item, idx) => (
                  <tr key={item.id} className="align-top">
                    {showItemSl && (
                      <td className={`${itemRowPadding} font-mono text-black text-left whitespace-nowrap align-top`}>{idx + 1}</td>
                    )}
                    <td className={`${itemRowPadding} pr-1 text-black leading-snug break-words align-top`}>
                      <div 
                        style={{ fontSize: `${itemFontSize}px` }} 
                        className="font-extrabold text-black font-sans leading-tight text-left break-words"
                      >
                        {item.itemNameTamil || item.itemName}
                      </div>
                      {format !== 'compact' && item.itemNameTamil && (
                        <div className="text-[9px] text-slate-700 font-mono text-left break-words">
                          {item.itemName}
                        </div>
                      )}
                    </td>
                    <td className={`${itemRowPadding} text-right font-mono font-extrabold text-black whitespace-nowrap align-top`}>
                      <span style={{ fontSize: `${Math.round(itemFontSize * 0.95)}px` }}>
                        {item.quantity}
                      </span>
                    </td>
                    <td className={`${itemRowPadding} text-right font-mono text-black whitespace-nowrap align-top`}>
                      {Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className={`${itemRowPadding} text-right font-mono font-bold text-black whitespace-nowrap align-top`}>
                      {Number(item.totalPrice).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 4. Subtotal and Quantity Summary */}
            <div className={`${sectionSpacingClass} border-t border-slate-300 space-y-0.5 text-[11px] sm:text-[12px]`}>
              <div className="flex justify-between items-center text-black font-bold whitespace-nowrap">
                {showTotalQty ? (
                  <span className="whitespace-nowrap">Total Qty : <span className="font-mono font-extrabold whitespace-nowrap">{totalQty}</span></span>
                ) : <span />}
                <span className="whitespace-nowrap">Item Total : <span className="font-mono font-extrabold whitespace-nowrap">₹{subtotal.toFixed(2)}</span></span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-red-700 font-bold text-[10.5px]">
                  <span>Discount :</span>
                  <span className="font-mono font-bold">-₹{discount.toFixed(2)}</span>
                </div>
              )}

              {/* SPECIAL FORMAT: GST TAX BREAKDOWN */}
              {format === 'gst_tax_invoice' && (
                <div className="pt-1 mt-1 border-t border-dotted border-slate-400 text-[9.5px] text-slate-800 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Taxable Value (5% Slab) :</span>
                    <span className="font-mono">₹{(grandTotal / 1.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CGST @ 2.5% :</span>
                    <span className="font-mono">₹{(grandTotal - (grandTotal / 1.05)) / 2 ? ((grandTotal - (grandTotal / 1.05)) / 2).toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST @ 2.5% :</span>
                    <span className="font-mono">₹{(grandTotal - (grandTotal / 1.05)) / 2 ? ((grandTotal - (grandTotal / 1.05)) / 2).toFixed(2) : '0.00'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Grand Total and Footer */}
            <div className={`${sectionSpacingClass} border-t-2 border-black ${alignClass}`}>
              <div 
                style={{ fontSize: `${totalFontSize}px` }} 
                className="font-black text-black tracking-wide leading-tight py-0.5"
              >
                GRAND TOTAL: ₹{grandTotal.toFixed(2)}
              </div>

              <div className="text-[9.5px] sm:text-[10px] font-bold text-black mt-1 tracking-wider">
                {settings.receiptFooter || '*** THANK YOU VISIT AGAIN ***'}
              </div>

              <div className="border-b border-dashed border-black mt-1.5" />
            </div>

            {/* Tear Paper Cutter Feed Space */}
            <div 
              style={{ height: `${(settings.receiptFeedLines || 2) * 5}mm` }} 
              className="w-full flex items-center justify-center select-none pointer-events-none"
            >
              <div className="text-[8px] text-slate-400 flex items-center gap-1 font-mono">
                <Scissors className="w-2.5 h-2.5" />
                <span>Paper Tear Cutter Bar</span>
              </div>
            </div>

          </div>

          {/* Bottom Jagged Tear Edge */}
          <div 
            className="absolute -bottom-1.5 left-0 right-0 h-1.5 bg-white pointer-events-none"
            style={{
              clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)'
            }}
          />
        </div>
      </div>

      {/* Footer Info & Direct Print Button */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Format: <b className="text-white capitalize">{format.replace('_', ' ')}</b></span>
          <span>Est. Slip: <b className="text-emerald-400">{estimatedLengthCm} cm</b></span>
          <span>Alignment: <b className="text-white capitalize">{alignment}</b></span>
        </div>

        {onPrintTest && (
          <button
            type="button"
            onClick={onPrintTest}
            disabled={isPrinting}
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Printer className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
            <span>{isPrinting ? 'Printing Test Slip to Thermal Roll...' : 'Print This Formatted Slip to Thermal Printer'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
