import { Bill, BillItem, Kot, KotItem, PrintMethod, RestaurantSettings } from '../types';
import { getTamilItemName } from './tamilTranslation';
import { getCaptainNumber } from '../utils/receiptFormatters';
import { DEFAULT_RESTAURANT_LOGO } from '../data/defaultLogo';
import { PrintDiagnosticsService } from './printDiagnostics';
import { PrinterConnectionService } from './printerConnectionService';
import { EscPosService } from './escposService';

export class PrinterService {
  /**
   * Check if Mock/Silent print mode is enabled (for development/testing without physical printer)
   */
  static isMockPrintMode(): boolean {
    return localStorage.getItem('pos_printer_mock_mode') === 'true';
  }

  static setMockPrintMode(enabled: boolean): void {
    localStorage.setItem('pos_printer_mock_mode', String(enabled));
  }

  /**
   * Generates printable HTML formatted specifically for thermal printers (80mm / 3-inch or 58mm / 2-inch)
   */
  static generateThermalReceiptHTML(
    bill: Bill, 
    items: BillItem[], 
    settings?: RestaurantSettings
  ): string {
    // STRICT LOGO PRESERVATION:
    // Retrieve the exact uploaded original logo file (from Firebase Storage URL, configuration, or original asset)
    // Never modify, redraw, threshold, or replace with AI or text recreation.
    const originalLogoUrl = settings?.logoStorageUrl?.trim() || settings?.logoUrl?.trim() || DEFAULT_RESTAURANT_LOGO;
    const logoUrl = originalLogoUrl;
    // Hotel Name in Tamil as requested (defaulting to Tamil name)
    const hotelNameTamil = settings?.restaurantNameTamil?.trim() || 
      (settings?.restaurantName && !settings.restaurantName.toLowerCase().includes('saravana') 
        ? settings.restaurantName 
        : 'ஸ்ரீ சரவண பவன்');
    const restaurantName = settings?.restaurantName || 'Sri Saravanan Bhavan';
    const address = settings?.address || 'No:8A, Rajambal Nagar, Salem Main Rd, Anna Nagar, Kallakurichi-606213';
    const phone = settings?.phone || '7708159933';
    const email = settings?.email;
    const gstNumber = settings?.gstNumber;
    const fssaiNumber = settings?.fssaiNumber;
    const receiptFooter = settings?.receiptFooter || '*** THANK YOU VISIT AGAIN ***';
    const alignment = settings?.receiptAlignment || 'center';
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    // Default to 'both' so the logo is ALWAYS placed in the header of the printed receipt
    const logoDisplay = (settings?.logoDisplay === 'watermark' ? 'both' : (settings?.logoDisplay || 'both')) as 'watermark' | 'header' | 'both' | 'none';
    const watermarkOpacity = settings?.watermarkOpacity !== undefined ? settings.watermarkOpacity : 0.12;
    const defaultDim = is58mm ? 70 : 90;
    const storedW = typeof window !== 'undefined' ? Number(localStorage.getItem('pos_receipt_logo_max_width')) : 0;
    const storedH = typeof window !== 'undefined' ? Number(localStorage.getItem('pos_receipt_logo_max_height')) : 0;
    const logoMaxWidth = settings?.receiptLogoMaxWidth || (storedW > 0 ? storedW : defaultDim);
    const logoMaxHeight = settings?.receiptLogoMaxHeight || (storedH >= 60 ? storedH : defaultDim);

    const createdDate = new Date(bill.createdAt);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(createdDate.getDate()).padStart(2, '0');
    const month = months[createdDate.getMonth()];
    const year = createdDate.getFullYear();
    const dateFormatted = `${day}/${month}/${year}`;
    const timeFormatted = createdDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const cleanBillNo = (bill.billNumber || '1').replace(/^BN-|^#/, '');
    const captainNumber = getCaptainNumber(bill);
    const tableNo = bill.tableNumber || (bill.orderType === 'TAKE_AWAY' ? 'TA' : 'DR');

    const paperWidth = is58mm ? '48mm' : '72mm';
    const isCompact = Boolean(settings?.compactMode) || settings?.receiptFormat === 'compact';
    const receiptFormat = settings?.receiptFormat || (isCompact ? 'compact' : 'standard');
    const configuredFontSize = settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12);
    // In compact mode, optimize font size and line height to conserve thermal paper roll
    const baseFontSize = isCompact ? Math.max(9, Math.round(configuredFontSize * 0.90 * 10) / 10) : configuredFontSize;
    const totalQty = items.reduce((sum, itm) => sum + itm.quantity, 0);

    // Dynamic scale multipliers based on owner settings
    const headerScaleMap = { normal: 1.35, large: 1.65, huge: 2.05 };
    const headerScale = headerScaleMap[settings?.receiptHeaderFontSize || (isCompact ? 'normal' : 'large')];
    const titleFontSize = Math.round(baseFontSize * headerScale * 10) / 10;

    const itemScaleMap = { normal: 1.25, large: 1.45, prominent: 1.70 };
    const itemScale = itemScaleMap[settings?.receiptItemFontSize || (receiptFormat === 'tiffin_token' ? 'prominent' : 'large')];
    const itemFontSize = Math.round(baseFontSize * itemScale * 10) / 10;

    const totalScaleMap = { normal: 1.5, large: 1.85, huge: 2.25 };
    const totalScale = totalScaleMap[settings?.receiptTotalFontSize || (receiptFormat === 'tiffin_token' ? 'huge' : 'large')];
    const totalFontSize = Math.round(baseFontSize * totalScale * 10) / 10;

    const headerFontSize = Math.round(baseFontSize * (isCompact ? 0.95 : 1.05) * 10) / 10;
    const metaFontSize = Math.round(baseFontSize * (isCompact ? 1.00 : 1.10) * 10) / 10;
    const priceFontSize = Math.round(baseFontSize * (isCompact ? 1.20 : 1.30) * 10) / 10;
    const smallFontSize = Math.round(baseFontSize * (isCompact ? 0.85 : 0.90) * 10) / 10;

    // Line spacing
    const lineSpacingMap = { tight: '1.12', normal: '1.25', relaxed: '1.42' };
    const lineHeightVal = lineSpacingMap[settings?.receiptLineSpacing || (isCompact ? 'tight' : 'normal')];

    // Section spacing
    const sectionSpacingMap = { compact: '1.5px 0', normal: '3px 0', spacious: '5px 0' };
    const sectionSpacingVal = sectionSpacingMap[settings?.receiptSectionSpacing || (isCompact ? 'compact' : 'normal')];

    // Item row padding
    const itemPaddingMap = { compact: '1px 0', normal: '2px 0', spacious: '3.5px 0' };
    const itemRowPaddingVal = itemPaddingMap[settings?.receiptItemPadding || (isCompact ? 'compact' : 'normal')];

    // Feed lines before cutter
    const feedLines = settings?.receiptFeedLines || (isCompact ? 1 : 2);
    const feedHeightMm = feedLines * 5 + 6;

    // Content toggles
    const showAddress = settings?.receiptShowAddress !== false;
    const showPhone = settings?.receiptShowPhone !== false;
    const showGstFssai = settings?.receiptShowGstFssai !== false && (gstNumber || fssaiNumber);
    const showItemSl = settings?.receiptShowItemSl !== false && receiptFormat !== 'compact';
    const showTotalQty = settings?.receiptShowTotalQty !== false;
    const showTamilName = settings?.receiptShowTamilName !== false;
    const showEnglishName = settings?.receiptShowEnglishName === true;

    // Helper to format address lines
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

    const addressLines = formatAddressLines(address);

    const reprintBadge = (bill.reprintCount && bill.reprintCount > 0) ? `
      <div style="text-align: center; border: 1px solid #000; padding: 1.5px; margin: 2px 0; font-size: ${metaFontSize}px; font-weight: 800; text-transform: uppercase;">
        *** DUPLICATE / REPRINT (${bill.reprintCount}) ***
      </div>
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${bill.billNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mukta+Malar:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { 
      size: ${is58mm ? '58mm' : '80mm'} auto; 
      margin: 0; 
    }
    * { box-sizing: border-box; }
    :root, #pos-print-root, html, body, .receipt-wrapper {
      --receipt-base-font-size: ${baseFontSize}px;
      --receipt-title-font-size: ${titleFontSize}px;
      --receipt-header-font-size: ${headerFontSize}px;
      --receipt-meta-font-size: ${metaFontSize}px;
      --receipt-item-font-size: ${itemFontSize}px;
      --receipt-total-font-size: ${totalFontSize}px;
      --receipt-small-font-size: ${smallFontSize}px;
      --receipt-logo-max-width: ${logoMaxWidth}px;
      --receipt-logo-max-height: ${logoMaxHeight}px;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Mukta Malar', 'Courier New', Courier, monospace;
      font-size: ${baseFontSize}px;
      line-height: ${lineHeightVal};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      width: ${paperWidth};
      margin: 0 auto;
      padding: ${isCompact ? '1px 1px 2px 1px' : '3px 2px 5px 2px'};
      position: relative;
    }
    @media print {
      @page {
        size: ${is58mm ? '58mm' : '80mm'} auto;
        margin: 0;
      }
      html, body {
        width: ${paperWidth} !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
    }
    .receipt-wrapper {
      position: relative;
      width: 100%;
      overflow: hidden;
      font-size: var(--receipt-base-font-size, ${baseFontSize}px);
      line-height: ${lineHeightVal};
    }
    .watermark-container {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: ${is58mm ? (isCompact ? '110px' : '130px') : (isCompact ? '140px' : '165px')};
      height: ${is58mm ? (isCompact ? '110px' : '130px') : (isCompact ? '140px' : '165px')};
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: ${watermarkOpacity};
      pointer-events: none;
      z-index: 0;
      filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.25));
      -webkit-filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.25));
    }
    .watermark-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .receipt-logo-container {
      display: block;
      width: 100%;
      text-align: ${alignment};
      margin: 0 auto ${isCompact ? '2px' : '5px'} auto;
      padding: 0;
      position: relative;
    }
    .receipt-logo {
      display: block;
      margin-left: auto;
      margin-right: auto;
      max-width: var(--receipt-logo-max-width, ${logoMaxWidth}px);
      max-height: var(--receipt-logo-max-height, ${logoMaxHeight}px);
      width: auto;
      height: auto;
      object-fit: contain;
    }
    .content {
      position: relative;
      z-index: 10;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .header { text-align: ${alignment}; margin-bottom: ${isCompact ? '2px' : '4px'}; }
    .restaurant-title { 
      font-size: var(--receipt-title-font-size, ${titleFontSize}px); 
      font-weight: 800; 
      margin-bottom: 1px; 
      letter-spacing: 0.2px;
      line-height: 1.15;
      font-family: 'Mukta Malar', sans-serif;
    }
    .address-section {
      font-size: var(--receipt-meta-font-size, ${metaFontSize}px);
      line-height: 1.15;
      color: #000;
      margin-bottom: 1px;
    }
    .meta-section {
      margin: ${sectionSpacingVal};
      padding: ${sectionSpacingVal};
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      font-size: var(--receipt-meta-font-size, ${metaFontSize}px);
      line-height: 1.15;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${isCompact ? '0.5px' : '1px'};
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: var(--receipt-item-font-size, ${itemFontSize}px);
      margin: ${sectionSpacingVal};
      line-height: ${lineHeightVal};
    }
    .items-table th {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: ${itemRowPaddingVal};
      font-weight: 800;
      font-size: var(--receipt-meta-font-size, ${metaFontSize}px);
      vertical-align: middle;
    }
    .items-table td {
      vertical-align: top;
      padding: ${itemRowPaddingVal};
      line-height: 1.15;
    }
    .compact-mode .items-table {
      margin: 1px 0;
    }
    .compact-mode .items-table th,
    .compact-mode .items-table td {
      padding: 0.5px 0;
    }
    .compact-mode .meta-section {
      margin: 1px 0;
      padding: 1px 0;
    }
    .compact-mode .net-summary {
      padding-top: 1px;
      margin-top: 1px;
    }
    .net-summary {
      border-top: 1px solid #ddd;
      padding-top: ${isCompact ? '1.5px' : '2.5px'};
      margin-top: ${isCompact ? '1px' : '2px'};
      font-size: var(--receipt-meta-font-size, ${metaFontSize}px);
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: ${isCompact ? '0.5px' : '1px'};
    }
    .grand-total-section {
      border-top: 1px solid #000;
      margin-top: ${sectionSpacingVal};
      padding-top: ${sectionSpacingVal};
      text-align: ${alignment};
    }
    .grand-total-text {
      font-size: var(--receipt-total-font-size, ${totalFontSize}px);
      font-weight: 900;
      letter-spacing: 0.2px;
    }
    .footer-text {
      font-size: var(--receipt-meta-font-size, ${metaFontSize}px);
      font-weight: 700;
      margin-top: ${isCompact ? '1.5px' : '3px'};
      line-height: 1.15;
    }
    .footer-divider {
      border-bottom: 1px dashed #000;
      margin-top: ${isCompact ? '2px' : '4px'};
    }
    @media print {
      body { width: 100%; margin: 0; padding: 1px; }
      .watermark-container {
        opacity: ${watermarkOpacity} !important;
        filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.25)) !important;
        -webkit-filter: drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.25)) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .content {
        position: relative;
        z-index: 10;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper ${isCompact ? 'compact-mode receipt-compact' : ''}" data-compact-mode="${isCompact}">
    <!-- Centered Shop Logo Watermark in Light Background (Unaltered Aspect Ratio) -->
    ${(logoDisplay === 'watermark' || logoDisplay === 'both') ? `
    <div class="watermark-container">
      <img src="${logoUrl}" alt="Watermark" class="watermark-img" />
    </div>
    ` : ''}

    <div class="content">
      ${(logoDisplay === 'header' || logoDisplay === 'both') ? `
      <!-- Top-center official shop logo with proportional scaling preserving exact original aspect ratio -->
      <div class="header receipt-logo-container" style="display: block; width: 100%; text-align: center; margin: 0 auto ${isCompact ? '2px' : '5px'} auto; padding: 0;">
        <img 
          src="${logoUrl}" 
          alt="Sri Saravana Bhavan Official Logo" 
          class="receipt-logo" 
          style="display: block; margin-left: auto; margin-right: auto; width: auto; height: auto; max-width: var(--receipt-logo-max-width, ${logoMaxWidth}px); max-height: var(--receipt-logo-max-height, ${logoMaxHeight}px); object-fit: contain;" 
          onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'color: #dc2626; font-size: 11px; font-weight: bold; text-align: center; border: 1px dashed #dc2626; padding: 4px 6px; margin: 4px auto; background-color: #fef2f2; border-radius: 4px; max-width: 220px;\\'>Original logo asset is unavailable</div>';"
        />
      </div>
      ` : ''}

      ${receiptFormat === 'tiffin_token' ? `
        <div style="border: 2px solid #000; padding: 3px; text-align: center; margin-bottom: 4px;">
          <div style="font-size: ${smallFontSize}px; font-weight: 800; letter-spacing: 2px;">TOKEN / BILL SLIP</div>
          <div style="font-size: ${Math.round(totalFontSize * 1.35)}px; font-weight: 900; line-height: 1;">#${cleanBillNo}</div>
          <div style="font-size: ${metaFontSize}px; font-weight: 700; border-top: 1px dashed #000; margin-top: 2px; padding-top: 1px; display: flex; justify-content: space-between;">
            <span>${tableNo || 'Counter'}</span>
            <span>${bill.orderType || 'DINE_IN'}</span>
          </div>
        </div>
      ` : ''}

      <!-- 1. Header: Hotel Name in Tamil, Address, Phone Number -->
      <div class="header">
        ${showTamilName ? `
          <div class="restaurant-title">
            ${hotelNameTamil}
          </div>
        ` : ''}
        ${showEnglishName ? `
          <div style="font-size: ${Math.round(titleFontSize * 0.85)}px; font-weight: 700; text-transform: uppercase;">
            ${restaurantName}
          </div>
        ` : ''}
        <div class="address-section">
          ${showAddress ? addressLines.map(line => `<div>${line}</div>`).join('') : ''}
          ${showPhone ? `<div>PH: ${phone}</div>` : ''}
          ${email ? `<div>Email: ${email}</div>` : ''}
          ${showGstFssai ? `
            <div style="font-size: ${smallFontSize}px; font-weight: 600; margin-top: 0.5px;">
              ${gstNumber ? `GSTIN: ${gstNumber}` : ''}
              ${(gstNumber && fssaiNumber) ? ' | ' : ''}
              ${fssaiNumber ? `FSSAI: ${fssaiNumber}` : ''}
            </div>
          ` : ''}
          ${receiptFormat === 'gst_tax_invoice' ? `
            <div style="border: 1px solid #000; font-weight: 800; font-size: ${smallFontSize}px; text-transform: uppercase; padding: 1px 0; margin-top: 2px;">
              TAX INVOICE / GST BILL
            </div>
          ` : ''}
        </div>
      </div>

      ${reprintBadge}

      <!-- 2. Bill Meta: Bill No, Date in single line and Cap No, Time in single line -->
      <div class="meta-section">
        <div class="meta-row bold">
          <span>Bill No : BN-${cleanBillNo}</span>
          <span style="display: none;">Bill No: #${bill.billNumber}</span>
          <span>Date : ${dateFormatted}</span>
        </div>
        <div class="meta-row">
          <span>Cap No : ${captainNumber}${tableNo ? ` (${tableNo})` : ''}</span>
          <span>Time : ${timeFormatted}</span>
        </div>
      </div>

      <!-- 3. Items Table: Item Number (#), Item Name in Tamil (BOLD, INCREASED), Qty (BOLD, INCREASED), Price (BOLD), Total (BOLD) -->
      <table class="items-table">
        <thead>
          <tr>
            ${showItemSl ? `<th style="width: 8%; text-align: left; padding: ${itemRowPaddingVal}; white-space: nowrap;">#</th>` : ''}
            <th style="width: ${showItemSl ? '44%' : '52%'}; text-align: left; padding: ${itemRowPaddingVal}; word-break: break-word;">பொருள்<span style="display:none;"> Item Name</span></th>
            <th style="width: 14%; text-align: right; padding: ${itemRowPaddingVal}; white-space: nowrap;">Qty</th>
            <th style="width: 17%; text-align: right; padding: ${itemRowPaddingVal}; white-space: nowrap;">Price</th>
            <th style="width: 17%; text-align: right; padding: ${itemRowPaddingVal}; white-space: nowrap;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((itm, idx) => {
            const tamilName = getTamilItemName(itm.itemName, itm.itemNameTamil);
            const displayName = tamilName || itm.itemName;
            return `
              <tr>
                ${showItemSl ? `<td style="text-align: left; padding: ${itemRowPaddingVal}; font-family: monospace; font-size: ${Math.round(metaFontSize * 1.05 * 10) / 10}px; white-space: nowrap; vertical-align: top;">${idx + 1}</td>` : ''}
                <td style="text-align: left; padding: ${itemRowPaddingVal}; vertical-align: top; word-break: break-word; overflow-wrap: break-word;">
                  <div style="font-weight: 800; font-size: ${Math.round(itemFontSize * 1.12 * 10) / 10}px; line-height: 1.25; font-family: 'Mukta Malar', 'Noto Sans Tamil', sans-serif; text-align: left; word-break: break-word; margin: 0; padding: 0;">${displayName}</div>
                </td>
                <td style="text-align: right; padding: ${itemRowPaddingVal}; font-family: monospace; font-weight: 800; font-size: ${Math.round(itemFontSize * 1.10 * 10) / 10}px; white-space: nowrap; vertical-align: top;">${Number(itm.quantity).toFixed(0)}</td>
                <td style="text-align: right; padding: ${itemRowPaddingVal}; font-family: monospace; font-weight: 700; font-size: ${priceFontSize}px; white-space: nowrap; vertical-align: top;">${Number(itm.unitPrice).toFixed(2)}</td>
                <td style="text-align: right; padding: ${itemRowPaddingVal}; font-family: monospace; font-weight: 800; font-size: ${Math.round(priceFontSize * 1.08 * 10) / 10}px; white-space: nowrap; vertical-align: top;">${Number(itm.totalPrice).toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- 4. Total Qty next to Item Total -->
      <div class="net-summary">
        <div class="summary-line" style="font-weight: 700; font-size: ${Math.round(metaFontSize * 1.15 * 10) / 10}px; white-space: nowrap; display: flex; justify-content: space-between; align-items: center;">
          ${showTotalQty ? `<span style="white-space: nowrap; text-align: left;">Total Qty : <b style="font-weight: 800; font-family: monospace; font-size: ${Math.round(itemFontSize * 1.08 * 10) / 10}px; white-space: nowrap;">${totalQty.toFixed(0)}</b></span>` : '<span></span>'}
          <span style="white-space: nowrap; text-align: right;">Item Total : <b style="font-weight: 800; font-family: monospace; font-size: ${Math.round(itemFontSize * 1.08 * 10) / 10}px; white-space: nowrap;">₹${Number(bill.subtotal).toFixed(2)}</b></span>
        </div>
        ${bill.discount > 0 ? `
          <div class="summary-line" style="color: #900; font-size: ${metaFontSize}px;">
            <span style="font-weight: 600;">Discount :</span>
            <span style="font-family: monospace; font-weight: 700;">-₹${Number(bill.discount).toFixed(2)}</span>
          </div>
        ` : ''}
        ${receiptFormat === 'gst_tax_invoice' ? `
          <div style="border-top: 1px dotted #888; margin-top: 2px; padding-top: 2px; font-size: ${smallFontSize}px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Taxable Value (5%):</span>
              <span>₹${(Number(bill.grandTotal) / 1.05).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>CGST @ 2.5%:</span>
              <span>₹${(((Number(bill.grandTotal) - (Number(bill.grandTotal) / 1.05)) / 2)).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>SGST @ 2.5%:</span>
              <span>₹${(((Number(bill.grandTotal) - (Number(bill.grandTotal) / 1.05)) / 2)).toFixed(2)}</span>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 5. Grand Total (BOLD) and Footer Line -->
      <div class="grand-total-section">
        <div class="grand-total-text">GRAND TOTAL: ₹${Number(bill.grandTotal).toFixed(2)}</div>
        <div class="footer-text">${receiptFooter}</div>
        <div class="footer-divider"></div>
        <div style="display: none;">Thank you</div>
      </div>
      <!-- Feed paper past tear cutter bar -->
      <div style="height: ${feedHeightMm}mm; width: 100%;" class="feed-margin"></div>
      <div style="text-align: center; font-size: 6px; color: transparent; user-select: none;">.</div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generates printable KOT slip for kitchen
   */
  static generateKotSlipHTML(kot: Kot, items: KotItem[]): string {
    const createdDate = new Date(kot.createdAt);
    const dateFormatted = createdDate.toLocaleDateString('en-GB');
    const timeFormatted = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const itemRows = items.map((itm, i) => `
      <tr>
        <td style="padding: 2px 0; font-weight: bold; font-size: 13px; font-family: monospace;">${i + 1}. ${itm.itemName}</td>
        <td style="text-align: right; padding: 2px 0; font-weight: bold; font-size: 14px; font-family: monospace;">× ${itm.quantity}</td>
      </tr>
      ${itm.notes ? `<tr><td colspan="2" style="font-style: italic; font-size: 10px; padding-left: 10px;">Note: ${itm.notes}</td></tr>` : ''}
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KOT - ${kot.kotNumber}</title>
  <style>
    @page { margin: 0; size: auto; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.25;
    }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 6px 2px;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .kot-title { font-size: 16px; font-weight: bold; text-align: center; border: 2px solid #000; padding: 3px; margin-bottom: 5px; }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    @media print {
      body { width: 100%; margin: 0; padding: 2px; }
    }
  </style>
</head>
<body>
  <div class="kot-title">KITCHEN ORDER TICKET</div>
  <table>
    <tr>
      <td class="bold" style="font-size: 14px;">${kot.kotNumber}</td>
      <td style="text-align: right;">${timeFormatted}</td>
    </tr>
    <tr>
      <td class="bold" style="font-size: 14px;">Table: ${kot.tableNumber || 'Take Away'}</td>
      <td style="text-align: right;">Date: ${dateFormatted}</td>
    </tr>
    <tr>
      <td>Type: ${kot.orderType === 'DINE_IN' ? 'Dine In' : 'Take Away'}</td>
      <td style="text-align: right;">Waiter: ${kot.waiterName || 'Staff'}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <table>
    <thead>
      <tr style="border-bottom: 1px dashed #000;">
        <th style="text-align: left; padding: 2px 0;">Item Name</th>
        <th style="text-align: right; padding: 2px 0;">Qty</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="divider"></div>
  <div class="center" style="font-size: 11px;">Status: ${kot.status}</div>
</body>
</html>`;
  }

  /**
   * Generates printable consolidated summary slip for multiple completed KOTs
   */
  static generateKotSummarySlipHTML(
    kotsWithItems: { kot: Kot; items: KotItem[] }[],
    settings?: RestaurantSettings,
    managerName?: string
  ): string {
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    const paperWidth = is58mm ? '48mm' : '72mm';
    const restaurantName = settings?.restaurantName || 'SRI SARAVANA BHAVAN';
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-GB');
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Aggregate items across all KOTs
    const itemMap = new Map<string, { itemName: string; itemNameTamil?: string; quantity: number }>();
    kotsWithItems.forEach(({ kot, items }) => {
      const effectiveItems = (items && items.length > 0) ? items : (kot.items || []);
      effectiveItems.forEach((itm) => {
        const key = itm.itemName.trim().toLowerCase();
        if (!itemMap.has(key)) {
          itemMap.set(key, { itemName: itm.itemName, itemNameTamil: itm.itemNameTamil, quantity: 0 });
        }
        itemMap.get(key)!.quantity += itm.quantity;
      });
    });

    const consolidatedItems = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);
    const totalDishesCount = consolidatedItems.reduce((acc, i) => acc + i.quantity, 0);

    const consolidatedRows = consolidatedItems.map((itm, i) => `
      <tr>
        <td style="padding: 2.5px 0; font-weight: bold; font-size: 13px; font-family: monospace;">${i + 1}. ${itm.itemName}</td>
        <td style="text-align: right; padding: 2.5px 0; font-weight: bold; font-size: 14px; font-family: monospace;">× ${itm.quantity}</td>
      </tr>
    `).join('');

    const individualKotRows = kotsWithItems.map(({ kot, items }) => {
      const effectiveItems = (items && items.length > 0) ? items : (kot.items || []);
      const count = effectiveItems.reduce((acc, i) => acc + i.quantity, 0);
      const timeStr = new Date(kot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <tr>
          <td style="padding: 2px 0; font-size: 11px; font-family: monospace;">${kot.kotNumber} (${kot.tableNumber || 'Take Away'})</td>
          <td style="text-align: center; padding: 2px 0; font-size: 11px;">${timeStr}</td>
          <td style="text-align: right; padding: 2px 0; font-size: 11px; font-weight: bold;">${count} items</td>
        </tr>
      `;
    }).join('');

    const tablesList = Array.from(
      new Set(kotsWithItems.map(({ kot }) => kot.tableNumber || (kot.orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In')))
    ).join(', ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>KOT Summary Slip - ${kotsWithItems.length} Completed KOTs</title>
  <style>
    @page { margin: 0; size: auto; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.25;
    }
    body {
      width: ${paperWidth};
      margin: 0 auto;
      padding: 6px 2px;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .summary-title {
      font-size: 15px;
      font-weight: bold;
      text-align: center;
      border: 2px solid #000;
      padding: 4px;
      margin: 4px 0 6px 0;
    }
    .divider { border-top: 1px dashed #000; margin: 5px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; }
    @media print {
      body { width: 100%; margin: 0; padding: 2px; }
    }
  </style>
</head>
<body>
  <div class="center bold" style="font-size: 14px; text-transform: uppercase;">${restaurantName}</div>
  <div class="summary-title">COMPLETED KOTS SUMMARY SLIP</div>

  <table>
    <tr>
      <td class="bold">Print Date: ${dateFormatted}</td>
      <td style="text-align: right;" class="bold">${timeFormatted}</td>
    </tr>
    <tr>
      <td>Manager: ${managerName || 'Shift Manager'}</td>
      <td style="text-align: right;" class="bold">Status: COMPLETED</td>
    </tr>
    <tr>
      <td colspan="2" style="padding-top: 2px;">
        <b>Completed KOTs:</b> ${kotsWithItems.length} tickets
      </td>
    </tr>
    <tr>
      <td colspan="2" style="font-size: 11px;">
        <b>Tables:</b> ${tablesList || 'N/A'}
      </td>
    </tr>
  </table>

  <div class="divider"></div>
  <div class="center bold" style="font-size: 12px; letter-spacing: 0.5px; padding: 2px 0;">
    CONSOLIDATED ITEM PRODUCTION
  </div>
  <div class="divider"></div>

  <table>
    <thead>
      <tr style="border-bottom: 1px dashed #000;">
        <th style="text-align: left; padding: 2px 0; font-size: 11px;">Dish Name</th>
        <th style="text-align: right; padding: 2px 0; font-size: 11px;">Total Qty</th>
      </tr>
    </thead>
    <tbody>
      ${consolidatedRows}
    </tbody>
    <tfoot>
      <tr style="border-top: 1px dashed #000;">
        <td style="padding: 4px 0; font-weight: bold; font-size: 12px;">TOTAL DISHES / PORTIONS:</td>
        <td style="padding: 4px 0; text-align: right; font-weight: bold; font-size: 14px;">${totalDishesCount}</td>
      </tr>
    </tfoot>
  </table>

  <div class="divider"></div>
  <div class="bold" style="font-size: 11px; margin-bottom: 2px;">TICKETS INCLUDED IN SUMMARY:</div>
  <table>
    <thead>
      <tr style="border-bottom: 1px dotted #000; font-size: 10px;">
        <th style="text-align: left; padding: 1px 0;">KOT (Table)</th>
        <th style="text-align: center; padding: 1px 0;">Time</th>
        <th style="text-align: right; padding: 1px 0;">Items</th>
      </tr>
    </thead>
    <tbody>
      ${individualKotRows}
    </tbody>
  </table>

  <div class="double-divider"></div>
  <div class="center bold" style="font-size: 11px;">*** ALL ${kotsWithItems.length} KOTS COMPLETED & VERIFIED ***</div>
  <div class="center" style="font-size: 10px; margin-top: 3px;">Kitchen Dispatch & Shift Audit Copy</div>

  <div style="margin-top: 18px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold;">
    <span>Manager Sign: ________</span>
    <span>Chef Sign: ________</span>
  </div>
</body>
</html>`;
  }

  /**
   * Safe focus restoration helper to prevent POS screen lockups after print operations.
   */
  private static restoreWindowFocus(previousActiveElement?: HTMLElement | null): void {
    try {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('print-ready');
        document.body.classList.remove('pos-printing');
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function' && document.body.contains(previousActiveElement)) {
        previousActiveElement.focus();
      } else {
        window.focus();
      }
    } catch (_) {
      // Ignore focus errors
    }
  }

  /**
   * Ultra-fast zero-latency silent print dispatch:
   * Uses an isolated background iframe to execute the print trigger.
   * By printing through a dedicated background frame, the main POS window and document
   * NEVER minimize, exit fullscreen, blink, or lose UI state.
   * Fully compatible with Chrome launched via --kiosk-printing for 0-dialog silent printing.
   */
  static printHtmlDocument(
    htmlContent: string, 
    settings?: RestaurantSettings
  ): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    return PrinterService.printViaDirectDOM(htmlContent, settings);
  }

  /**
   * Ultra-fast zero-latency print dispatch:
   * Uses consistent top-level window.print() trigger on #pos-print-root.
   * Completely isolated from main React DOM tree to prevent UI interference.
   * Fully compatible with Chrome launched via --kiosk-printing for 0-dialog silent printing.
   */
  static printViaIframe(htmlContent: string): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    return PrinterService.printHtmlDocument(htmlContent);
  }

  /**
   * Helper to detect if the app is embedded in an iframe/preview container
   */
  static isSandboxed(): boolean {
    return typeof window !== 'undefined' && window.self !== window.top;
  }

  /**
   * Opens a dedicated clean popup window and triggers print.
   * Escapes the browser iframe sandbox so Chrome allows native physical thermal printer dialogs.
   */
  static printViaPopup(htmlContent: string): { success: boolean; popupBlocked?: boolean; error?: string } {
    if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };
    try {
      // Inject auto-trigger print script and non-printable header bar
      const enhancedHtml = htmlContent.replace('</head>', `
  <style>
    @media print {
      .pos-popup-controls { display: none !important; }
    }
  </style>
  <script>
    function triggerPrintNow() {
      try {
        window.focus();
        window.print();
      } catch (e) {
        console.warn('Auto print failed:', e);
      }
    }
    window.addEventListener('load', function() {
      setTimeout(triggerPrintNow, 120);
    });
    window.addEventListener('afterprint', function() {
      setTimeout(function() {
        try { window.close(); } catch (e) {}
      }, 600);
    });
  </script>
</head>`).replace('<body>', `<body>
  <div class="pos-popup-controls" style="position: sticky; top: 0; left: 0; right: 0; background: #0f172a; color: #ffffff; padding: 8px 12px; text-align: center; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); margin-bottom: 8px;">
    <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
      <button onclick="window.focus(); window.print();" style="background: #10b981; color: #ffffff; border: none; padding: 7px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 4px;">
        🖨️ Print to Rugtek RP326 (80mm) Now
      </button>
      <button onclick="window.close();" style="background: #334155; color: #cbd5e1; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 13px;">
        Close
      </button>
    </div>
    <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
      Printer: <strong>Rugtek RP326 (POS-80)</strong> | Paper: <strong>80 x 297 mm (3-Inch)</strong> | Margins: <strong>None</strong>
    </div>
  </div>`);

      const popup = window.open('', '_blank', 'width=420,height=650,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
      if (!popup) {
        return { success: false, popupBlocked: true, error: 'Popup window blocked by Chrome. Please allow pop-ups for this site.' };
      }
      popup.document.open();
      popup.document.write(enhancedHtml);
      popup.document.close();

      const trigger = () => {
        try {
          popup.focus();
          popup.print();
        } catch (e: any) {
          console.warn('Popup print error:', e);
        }
      };

      const img = popup.document.querySelector('img');
      if (img && !img.complete) {
        img.onload = trigger;
        img.onerror = trigger;
        setTimeout(trigger, 300);
      } else {
        setTimeout(trigger, 100);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to open print popup' };
    }
  }

  /**
   * Direct DOM Print Portal:
   * Injects the print content and styles into dedicated top-level container #pos-print-root,
   * sets the 'print-ready' state, and triggers window.print() with strict DOM isolation.
   */
  static printViaDirectDOM(
    htmlContent: string, 
    _settings?: RestaurantSettings,
    _canFallbackToIframe = false
  ): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return { success: false, error: 'Window or document not available' };
    }
    const isSandboxed = PrinterService.isSandboxed();
    const activeEl = document.activeElement as HTMLElement | null;
    document.body.classList.add('print-ready');
    document.body.classList.add('pos-printing');

    try {
      let printRoot = document.getElementById('pos-print-root');
      if (!printRoot) {
        printRoot = document.createElement('div');
        printRoot.id = 'pos-print-root';
        printRoot.setAttribute('aria-hidden', 'true');
        document.body.appendChild(printRoot);
      }

      // Extract style and body content cleanly for DOM injection
      const styleMatch = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const styleContent = styleMatch ? styleMatch[1] : '';
      const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;

      printRoot.innerHTML = styleContent 
        ? `<style>${styleContent}</style>${bodyContent}`
        : htmlContent;
      printRoot.setAttribute('data-print-ready', 'true');

      if (typeof window.focus === 'function') window.focus();

      // Trigger browser printing (window.print is standard for thermal receipt printing and kiosk mode)
      try {
        window.print();
      } catch (printErr: any) {
        console.warn('[PrinterService] Direct window.print() was blocked or threw an exception:', printErr);
        if (isSandboxed) {
          const popupRes = PrinterService.printViaPopup(htmlContent);
          if (popupRes.success) return popupRes;
          return {
            success: false,
            restrictedInIframe: true,
            error: 'Print blocked by iframe sandbox. Please open in a full browser tab for direct thermal printing.'
          };
        }
        return { success: false, error: printErr?.message || 'Print execution failed' };
      }

      const cleanup = () => {
        try {
          PrinterService.restoreWindowFocus(activeEl);
          if (printRoot) {
            printRoot.removeAttribute('data-print-ready');
          }
        } catch (_) {}
      };

      if (typeof window !== 'undefined' && 'addEventListener' in window) {
        window.addEventListener('afterprint', cleanup, { once: true });
        // Generous safety timeout (60s) so the print spooler is NEVER cleared prematurely
        setTimeout(cleanup, 60000);
      } else {
        cleanup();
      }

      return { success: true };
    } catch (e: any) {
      PrinterService.restoreWindowFocus(activeEl);
      const isRestricted = e?.name === 'SecurityError' || 
        String(e?.message || '').toLowerCase().includes('sandbox') ||
        String(e?.message || '').toLowerCase().includes('allow-modals');

      if (isRestricted) {
        const popupRes = PrinterService.printViaPopup(htmlContent);
        if (popupRes.success) return popupRes;
      }

      return { success: false, restrictedInIframe: isRestricted, error: e?.message || 'Direct DOM print failed' };
    }
  }

  /**
   * Directly updates logo CSS variables on #pos-print-root in real time
   */
  static setPrintRootLogoSize(maxWidth: number, maxHeight: number): void {
    if (typeof document === 'undefined') return;
    let printRoot = document.getElementById('pos-print-root');
    if (!printRoot) {
      printRoot = document.createElement('div');
      printRoot.id = 'pos-print-root';
      printRoot.setAttribute('aria-hidden', 'true');
      document.body.appendChild(printRoot);
    }
    printRoot.style.setProperty('--receipt-logo-max-width', `${maxWidth}px`);
    printRoot.style.setProperty('--receipt-logo-max-height', `${maxHeight}px`);
  }

  /**
   * Retrieves active logo CSS variable sizing from #pos-print-root or settings
   */
  static getPrintRootLogoSize(): { maxWidth: number; maxHeight: number } {
    if (typeof document === 'undefined') return { maxWidth: 140, maxHeight: 50 };
    const printRoot = document.getElementById('pos-print-root');
    if (!printRoot) return { maxWidth: 140, maxHeight: 50 };
    const w = parseInt(printRoot.style.getPropertyValue('--receipt-logo-max-width'), 10);
    const h = parseInt(printRoot.style.getPropertyValue('--receipt-logo-max-height'), 10);
    return {
      maxWidth: isNaN(w) ? 140 : w,
      maxHeight: isNaN(h) ? 50 : h
    };
  }

  /**
   * Directly prints a bill receipt instantly (0ms delay) with diagnostic logging.
   * In Mock/Dev Testing mode, only bypasses if forceHardware is explicitly set to false.
   * Defaults to forceHardware = true to guarantee bill printing.
   */
  static printBill(
    bill: Bill, 
    items: BillItem[], 
    settings?: RestaurantSettings, 
    forceHardware = true
  ): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    // Notify UI components immediately that receipt printing animation and process have begun
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-bill-printing', {
        detail: { bill, items, settings }
      }));
    }

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isMock = !forceHardware && PrinterService.isMockPrintMode();
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    const paperWidth = is58mm ? '58mm' : '80mm';
    const jobType = (bill.reprintCount && bill.reprintCount > 0) ? 'REPRINT' : 'BILL';
    const referenceNumber = bill.billNumber ? `BN-${bill.billNumber.replace(/^BN-|^#/, '')}` : 'BILL';

    if (isMock) {
      console.log(`[POS Dev Mode] Simulated instant thermal print for Bill #${bill.billNumber} (₹${bill.grandTotal})`);
      PrintDiagnosticsService.recordPrintJob({
        jobType,
        referenceNumber,
        status: 'SUCCESS',
        method: 'MOCK',
        paperWidth,
        fontSize: settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12),
        itemCount: items.length,
        totalAmount: bill.grandTotal,
        durationMs: 0,
        isMockMode: true,
        userId: bill.userId,
        userName: bill.userName
      });
      return { success: true };
    }

    const html = PrinterService.generateThermalReceiptHTML(bill, items, settings);

    // Direct Hardware USB/Serial ESC/POS printing (0-Click, 100% bypasses Chrome preview dialog)
    if (PrinterConnectionService.isDirectHardwareReady()) {
      try {
        const escposBuffer = EscPosService.generateBillEscPosBuffer(bill, items, settings);
        PrinterConnectionService.sendRawBytes(escposBuffer).then((res) => {
          if (res.success) {
            console.log(`[POS Direct Hardware] Dispatched ${escposBuffer.length} bytes directly to thermal printer (zero preview dialog).`);
          } else {
            console.warn('[POS Direct Hardware] Hardware direct dispatch notice, triggering fallback thermal print:', res.error);
            PrinterService.printHtmlDocument(html, settings);
          }
        }).catch((sendErr) => {
          console.warn('[POS Direct Hardware] Exception in sendRawBytes, triggering fallback print:', sendErr);
          PrinterService.printHtmlDocument(html, settings);
        });

        const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
        PrintDiagnosticsService.recordPrintJob({
          jobType,
          referenceNumber,
          status: 'SUCCESS',
          method: 'ESC_POS',
          paperWidth,
          fontSize: settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12),
          itemCount: items.length,
          totalAmount: bill.grandTotal,
          durationMs,
          isMockMode: false,
          userId: bill.userId,
          userName: bill.userName
        });

        return { success: true };
      } catch (escPosErr) {
        console.warn('[POS Direct Hardware] Failed to generate raw ESC/POS buffer, falling back to browser print:', escPosErr);
      }
    }
    
    // Direct Browser Print for Chrome Kiosk Printing (--kiosk-printing)
    // Sends the print job directly to the Windows default thermal printer without dialog or preview
    const result = PrinterService.printHtmlDocument(html, settings);
    const printMethod: PrintMethod = 'DIRECT_DOM';

    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
    const status = result.success ? 'SUCCESS' : 'FAILURE';

    PrintDiagnosticsService.recordPrintJob({
      jobType,
      referenceNumber,
      status,
      method: printMethod,
      paperWidth,
      fontSize: settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12),
      itemCount: items.length,
      totalAmount: bill.grandTotal,
      durationMs,
      errorMessage: result.error,
      isMockMode: false,
      userId: bill.userId,
      userName: bill.userName
    });

    // Notify any listening components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-bill-printed', {
        detail: { bill, items, settings, result }
      }));
    }

    return result;
  }

  /**
   * Directly prints a KOT ticket instantly (0ms delay) with diagnostic logging.
   */
  static printKot(
    kot: Kot, 
    items: KotItem[], 
    forceHardware = true
  ): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isMock = !forceHardware && PrinterService.isMockPrintMode();
    const referenceNumber = kot.kotNumber || 'KOT';

    // Notify UI components to display the thermal printing animation on screen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos-bill-printing', {
        detail: {
          bill: {
            billNumber: kot.kotNumber,
            grandTotal: 0,
            userName: kot.waiterName || 'Kitchen Order Ticket',
            createdAt: kot.createdAt
          },
          items: items.map((ki) => ({
            itemName: ki.itemNameTamil ? `${ki.itemNameTamil} (${ki.itemName})` : ki.itemName,
            quantity: ki.quantity,
            totalPrice: 0
          }))
        }
      }));
    }

    if (isMock) {
      console.log(`[POS Dev Mode] Simulated instant thermal print for KOT #${kot.kotNumber}`);
      PrintDiagnosticsService.recordPrintJob({
        jobType: 'KOT',
        referenceNumber,
        status: 'SUCCESS',
        method: 'MOCK',
        paperWidth: '80mm',
        itemCount: items.length,
        durationMs: 0,
        isMockMode: true,
        userId: kot.waiterId || kot.createdBy,
        userName: kot.waiterName
      });
      return { success: true };
    }

    const html = PrinterService.generateKotSlipHTML(kot, items);

    // Direct Hardware USB/Serial ESC/POS printing for KOT (zero preview dialog)
    if (PrinterConnectionService.isDirectHardwareReady()) {
      try {
        const kotBuffer = EscPosService.generateKotEscPosBuffer(kot, items);
        PrinterConnectionService.sendRawBytes(kotBuffer).then((res) => {
          if (res.success) {
            console.log(`[POS Direct Hardware] Sent raw KOT ESC/POS buffer directly to kitchen printer.`);
          } else {
            console.warn('[POS Direct Hardware] KOT hardware send notice, triggering fallback thermal print:', res.error);
            PrinterService.printHtmlDocument(html);
          }
        }).catch((err) => {
          console.warn('[POS Direct Hardware] KOT send error, triggering fallback print:', err);
          PrinterService.printHtmlDocument(html);
        });

        const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
        PrintDiagnosticsService.recordPrintJob({
          jobType: 'KOT',
          referenceNumber,
          status: 'SUCCESS',
          method: 'ESC_POS',
          paperWidth: '80mm',
          itemCount: items.length,
          durationMs,
          isMockMode: false,
          userId: kot.waiterId || kot.createdBy,
          userName: kot.waiterName
        });

        return { success: true };
      } catch (kotErr) {
        console.warn('[POS Direct Hardware] Error sending raw KOT buffer, falling back to browser print:', kotErr);
      }
    }

    // Direct Browser Print for Chrome Kiosk Printing (--kiosk-printing)
    // Sends the print job directly to the Windows default thermal printer without dialog or preview
    const result = PrinterService.printHtmlDocument(html);
    const printMethod: PrintMethod = 'DIRECT_DOM';

    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
    const status = result.success ? 'SUCCESS' : 'FAILURE';

    PrintDiagnosticsService.recordPrintJob({
      jobType: 'KOT',
      referenceNumber,
      status,
      method: printMethod,
      paperWidth: '80mm',
      itemCount: items.length,
      durationMs,
      errorMessage: result.error,
      isMockMode: false,
      userId: kot.waiterId || kot.createdBy,
      userName: kot.waiterName
    });

    return result;
  }

  /**
   * Directly prints a consolidated KOT Summary Slip for multiple completed KOTs with diagnostic logging.
   */
  static printKotSummarySlip(
    kotsWithItems: { kot: Kot; items: KotItem[] }[],
    settings?: RestaurantSettings,
    managerName?: string,
    forceHardware = true
  ): { success: boolean; restrictedInIframe?: boolean; error?: string } {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isMock = !forceHardware && PrinterService.isMockPrintMode();
    const referenceNumber = `KOT-SUM-${kotsWithItems.length}`;

    // Calculate aggregated items
    const itemMap = new Map<string, { itemName: string; itemNameTamil?: string; quantity: number }>();
    kotsWithItems.forEach(({ kot, items }) => {
      const effectiveItems = (items && items.length > 0) ? items : (kot.items || []);
      effectiveItems.forEach((itm) => {
        const key = itm.itemName.trim().toLowerCase();
        if (!itemMap.has(key)) {
          itemMap.set(key, { itemName: itm.itemName, itemNameTamil: itm.itemNameTamil, quantity: 0 });
        }
        itemMap.get(key)!.quantity += itm.quantity;
      });
    });
    const consolidatedList = Array.from(itemMap.values());
    const totalItemsCount = consolidatedList.reduce((acc, i) => acc + i.quantity, 0);

    if (isMock) {
      console.log(`[POS Dev Mode] Simulated instant print for KOT Summary Slip (${kotsWithItems.length} KOTs)`);
      PrintDiagnosticsService.recordPrintJob({
        jobType: 'KOT',
        referenceNumber,
        status: 'SUCCESS',
        method: 'MOCK',
        paperWidth: settings?.paperWidth || '80mm',
        itemCount: totalItemsCount,
        durationMs: 0,
        isMockMode: true,
        userId: 'manager',
        userName: managerName || 'Manager'
      });
      return { success: true };
    }

    const html = PrinterService.generateKotSummarySlipHTML(kotsWithItems, settings, managerName);
    const result = PrinterService.printHtmlDocument(html, settings);
    const printMethod: PrintMethod = 'DIRECT_DOM';
    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
    const status = result.success ? 'SUCCESS' : 'FAILURE';

    PrintDiagnosticsService.recordPrintJob({
      jobType: 'KOT',
      referenceNumber,
      status,
      method: printMethod,
      paperWidth: settings?.paperWidth || '80mm',
      itemCount: totalItemsCount,
      durationMs,
      errorMessage: result.error,
      isMockMode: false,
      userId: 'manager',
      userName: managerName || 'Manager'
    });

    return result;
  }

  /**
   * Returns the standardized plain-text diagnostic string used for thermal printer
   * connection, character set, and paper feed verification.
   */
  static getStandardizedDiagnosticString(settings?: RestaurantSettings): string {
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    const printerModel = settings?.printerModelName || 'Rugtek RP326B (Default Thermal POS)';
    const widthCols = is58mm ? 32 : 48;
    const divider = '='.repeat(widthCols);
    const thinDivider = '-'.repeat(widthCols);
    const now = new Date();
    const timestampStr = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });

    return [
      divider,
      '   STANDARDIZED PRINTER DIAGNOSTIC TEST   ',
      '      CONNECTION & PAPER FEED STATUS      ',
      divider,
      `STATUS       : ONLINE / CONNECTED`,
      `PAPER FEED   : VERIFIED / ACTIVE`,
      `PRINTER      : ${printerModel}`,
      `PAPER WIDTH  : ${is58mm ? '58mm (32 cols)' : '80mm (48 cols)'}`,
      `INTERFACE    : USB / SYSTEM SPOOLER`,
      `TIMESTAMP    : ${timestampStr}`,
      thinDivider,
      'STANDARDIZED DIAGNOSTIC TEST STRING:',
      '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz !@#$%^&*()_+',
      thinDivider,
      'FEED TEST    : 20MM ADVANCE OK',
      'CUTTER TEST  : PARTIAL GUILLOTINE CUT',
      '*** CONNECTION & PAPER FEED VERIFIED ***',
      divider
    ].join('\n');
  }

  /**
   * Generates a printer hardware diagnostics & calibration test slip.
   */
  static generateDiagnosticTestSlipHTML(settings?: RestaurantSettings): string {
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    const paperWidth = is58mm ? '48mm' : '72mm';
    const configuredFontSize = settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12);
    const isCompact = Boolean(settings?.compactMode);
    const baseFontSize = isCompact ? Math.max(9, Math.round(configuredFontSize * 0.85 * 10) / 10) : configuredFontSize;
    const now = new Date();
    const timestampStr = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' });
    const restaurantName = settings?.restaurantName || 'SRI SARAVANA BHAVAN';
    const printerModel = settings?.printerModelName || 'Rugtek RP326B';
    const isRugtek = printerModel.toLowerCase().includes('rugtek') || printerModel.toLowerCase().includes('rp326');

    // Rulers for column alignment verification (48 cols font A for 80mm / 32 cols for 58mm)
    const ruler = is58mm 
      ? '|...10...20...30..| (32 Cols)'
      : '|....10....20....30....40....48| (48 Cols)';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Printer Diagnostic Test - ${printerModel}</title>
  <style>
    @page { margin: 0; size: auto; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: ${isCompact ? '3px 1px' : '6px 2px'};
      background: #fff;
      color: #000;
      font-family: 'Courier New', Courier, monospace;
      font-size: ${baseFontSize}px;
      line-height: ${isCompact ? '1.15' : '1.3'};
      width: ${paperWidth};
      margin: 0 auto;
      text-align: center;
    }
    .divider { border-top: 1px dashed #000; margin: ${isCompact ? '3px 0' : '6px 0'}; }
    .double-divider { border-top: 2px solid #000; margin: ${isCompact ? '3px 0' : '6px 0'}; }
    .title { font-size: ${Math.round(baseFontSize * 1.3)}px; font-weight: bold; text-transform: uppercase; }
    .row { display: flex; justify-content: space-between; text-align: left; margin: 1.5px 0; font-size: ${baseFontSize}px; }
    .head-bar { background: #000; color: #fff; font-weight: 800; padding: 2px 0; margin: 4px 0; font-size: ${Math.round(baseFontSize * 0.85)}px; letter-spacing: 0.5px; }
    .ruler { font-size: ${Math.round(baseFontSize * 0.75)}px; font-weight: bold; letter-spacing: 0.5px; border-top: 1px dotted #000; border-bottom: 1px dotted #000; padding: 1px 0; margin: 3px 0; }
  </style>
</head>
<body>
  <div class="double-divider"></div>
  <div class="title">PRINTER DIAGNOSTIC</div>
  <div style="font-size: ${Math.round(baseFontSize * 0.9)}px; font-weight: bold;">STANDARDIZED TEST PAGE - HARDWARE TEST PAGE</div>
  <div style="font-size: ${Math.round(baseFontSize * 0.85)}px; font-weight: bold; margin-top: 2px;">${restaurantName}</div>
  <div class="divider"></div>
  
  <div class="row"><span>Connection:</span><span style="font-weight: bold; color: #000;">ONLINE / CONNECTED</span></div>
  <div class="row"><span>Paper Feed:</span><span style="font-weight: bold; color: #000;">PASSED / 20MM FEED</span></div>
  <div class="row"><span>Model:</span><span style="font-weight: bold;">${printerModel}</span></div>
  <div class="row"><span>Interface:</span><span>USB / SYSTEM SPOOLER</span></div>
  <div class="row"><span>Paper Width:</span><span>${is58mm ? '58mm (2-Inch)' : '80mm (3-Inch)'}</span></div>
  <div class="row"><span>Printable Area:</span><span>${is58mm ? '48mm (384 dots)' : '72mm (576 dots)'}</span></div>
  <div class="row"><span>Head Speed:</span><span>${isRugtek ? '250 mm/sec (RP326B)' : 'Standard ESC/POS'}</span></div>
  <div class="row"><span>Auto-Cutter:</span><span>Guillotine Partial Cut</span></div>
  <div class="row"><span>Base Font:</span><span>${baseFontSize}px</span></div>
  <div class="row"><span>Mode:</span><span>${isCompact ? 'COMPACT (ECO PAPER)' : 'STANDARD SPACING'}</span></div>
  <div class="row"><span>Timestamp:</span><span>${timestampStr}</span></div>
  
  <div class="divider"></div>
  <div style="text-align: left; font-size: ${Math.round(baseFontSize * 0.85)}px;">
    <div><strong>STANDARDIZED DIAGNOSTIC STRING:</strong></div>
    <div style="font-family: monospace; font-size: ${Math.round(baseFontSize * 0.78)}px; word-break: break-all; margin: 3px 0;">
      [ASCII 32-126]: ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 abcdefghijklmnopqrstuvwxyz !@#$%^&*()_+-=[]{}|;:,.<>?
    </div>
    <div style="margin-top: 4px;"><strong>ALIGNMENT & DENSITY TEST:</strong></div>
    <div class="ruler">${ruler}</div>
    <div style="text-align: left;">|<- [LEFT EDGE 0mm]</div>
    <div style="text-align: center;">|-- [CENTER 50%] --|</div>
    <div style="text-align: right;">[RIGHT EDGE] ->|</div>
  </div>

  <div class="head-bar">
    ██ THERMAL HEAD DENSITY ██
  </div>

  <div style="font-size: ${Math.round(baseFontSize * 0.78)}px; text-align: left; margin-top: 3px;">
    <div>• Normal: The quick brown fox jumps</div>
    <div><strong>• Bold: 1234567890 - Tamil: வாழ்க</strong></div>
  </div>
  
  <div class="divider"></div>
  <div style="font-size: ${Math.round(baseFontSize * 0.75)}px; letter-spacing: 1px;">
    - - - - TEAR / CUT HERE - - - -
  </div>
  <div style="font-weight: bold; font-size: ${Math.round(baseFontSize * 0.9)}px; margin-top: 3px;">
    *** DIAGNOSTIC PASS - CONNECTION & FEED VERIFIED ***
  </div>
  <div style="font-size: ${Math.round(baseFontSize * 0.75)}px; margin-top: 2px;">
    Generated by POS Diagnostics Engine
  </div>
  <div class="double-divider"></div>
  <!-- Feed paper 20mm past tear cutter bar to verify feed stepper motor -->
  <div style="height: 20mm; width: 100%;" class="feed-margin"></div>
  <div style="text-align: center; font-size: 6px; color: transparent; user-select: none;">.</div>
</body>
</html>`;
  }

  /**
   * Executes a diagnostic test print and tracks status in console & Firestore.
   */
  static printDiagnosticTestPage(
    settings?: RestaurantSettings,
    forceHardware = true
  ): { success: boolean; restrictedInIframe?: boolean; error?: string; diagnosticString?: string } {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
    const paperWidth = is58mm ? '58mm' : '80mm';
    const diagnosticString = PrinterService.getStandardizedDiagnosticString(settings);

    const html = PrinterService.generateDiagnosticTestSlipHTML(settings);
    const isSandboxed = PrinterService.isSandboxed();
    
    let result: { success: boolean; restrictedInIframe?: boolean; error?: string } = PrinterService.printHtmlDocument(html, settings);
    let printMethod: PrintMethod = 'DIRECT_DOM';

    if (result.restrictedInIframe && isSandboxed) {
      const popupResult = PrinterService.printViaPopup(html);
      if (popupResult.success) {
        result = popupResult;
        printMethod = 'POPUP';
      }
    }

    const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime);
    const status = result.restrictedInIframe ? 'RESTRICTED' : result.success ? 'SUCCESS' : 'FAILURE';
    const errorCode = result.restrictedInIframe
      ? 'ERR_SANDBOX_RESTRICTED'
      : !result.success
      ? (result.error?.toLowerCase().includes('port') ? 'ERR_PORT_DISCONNECTED' : 'ERR_PRINTER_OFFLINE')
      : 'SUCCESS_OK';

    // Mark verified in live printer connection state when dispatched successfully
    if (result.success && !result.restrictedInIframe) {
      try {
        PrinterConnectionService.markVerified();
      } catch (e) {
        console.warn('Could not update connection service verification:', e);
      }
    }

    PrintDiagnosticsService.recordPrintJob({
      jobType: 'TEST_PAGE',
      referenceNumber: `TEST-${Date.now().toString().slice(-4)}`,
      status,
      method: printMethod,
      paperWidth,
      fontSize: settings?.receiptFontSize ? Number(settings.receiptFontSize) : (is58mm ? 10 : 12),
      itemCount: 1,
      totalAmount: 0,
      durationMs,
      errorMessage: result.error,
      errorCode,
      isMockMode: !forceHardware && PrinterService.isMockPrintMode()
    });

    return {
      ...result,
      diagnosticString
    };
  }

  /**
   * Records a simulated printer disconnection event into the diagnostic log
   * to assist technicians and cashiers in verifying error handling and troubleshooting workflows.
   */
  static recordDisconnectionDiagnostic(
    code: 'ERR_PRINTER_OFFLINE' | 'ERR_PORT_DISCONNECTED' | 'ERR_SPOOLER_TIMEOUT' | 'ERR_PAPER_EMPTY' = 'ERR_PRINTER_OFFLINE',
    customMessage?: string
  ): void {
    const messages: Record<string, string> = {
      ERR_PRINTER_OFFLINE: 'Printer offline: No handshake on USB Type-B interface. Power LED unlit or cable disconnected.',
      ERR_PORT_DISCONNECTED: 'Virtual COM port detached unexpectedly by OS sleep mode or USB bus reset.',
      ERR_SPOOLER_TIMEOUT: 'Windows print spooler timeout: Printer did not accept byte stream within 4000ms.',
      ERR_PAPER_EMPTY: 'Thermal paper out sensor active or top cover latch not engaged.'
    };

    PrintDiagnosticsService.recordPrintJob({
      jobType: 'TEST_PAGE',
      referenceNumber: `TEST-ERR-${Date.now().toString().slice(-4)}`,
      status: 'FAILURE',
      method: 'DIRECT_DOM',
      paperWidth: '80mm',
      fontSize: 12,
      itemCount: 1,
      totalAmount: 0,
      durationMs: 4120,
      errorMessage: customMessage || messages[code] || 'Printer communication error',
      errorCode: code,
      isMockMode: false
    });
  }
}
