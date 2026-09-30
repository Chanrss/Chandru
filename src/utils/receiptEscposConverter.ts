import React, { ReactElement } from 'react';
import { Bill, BillItem, RestaurantSettings } from '../types';
import { getTamilItemName } from '../services/tamilTranslation';
import { getCaptainNumber } from './receiptFormatters';
import { DEFAULT_RESTAURANT_LOGO } from '../data/defaultLogo';

/**
 * Standard ESC/POS Command Byte Constants
 */
export const ESCPOS_COMMANDS = {
  // Printer Initialization
  INIT: new Uint8Array([0x1b, 0x40]), // ESC @: Initialize printer

  // Code Page Selection
  CODE_PAGE_PC437: new Uint8Array([0x1b, 0x74, 0x00]), // ESC t 0: USA / Standard Europe
  CODE_PAGE_WPC1252: new Uint8Array([0x1b, 0x74, 0x10]), // ESC t 16: Windows-1252

  // Bold Text (Emphasized Mode)
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]), // ESC E 1: Turn bold on
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]), // ESC E 0: Turn bold off

  // Double Strike
  DOUBLE_STRIKE_ON: new Uint8Array([0x1b, 0x47, 0x01]), // ESC G 1: Turn double-strike on
  DOUBLE_STRIKE_OFF: new Uint8Array([0x1b, 0x47, 0x00]), // ESC G 0: Turn double-strike off

  // Font Size / Character Dimensions (GS ! n)
  FONT_NORMAL: new Uint8Array([0x1d, 0x21, 0x00]), // Normal 1x width, 1x height
  FONT_DOUBLE_HEIGHT: new Uint8Array([0x1d, 0x21, 0x01]), // 1x width, 2x height
  FONT_DOUBLE_WIDTH: new Uint8Array([0x1d, 0x21, 0x10]), // 2x width, 1x height
  FONT_DOUBLE_BOTH: new Uint8Array([0x1d, 0x21, 0x11]), // 2x width, 2x height

  // Text Alignment (ESC a n)
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]), // ESC a 0: Left
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]), // ESC a 1: Center
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]), // ESC a 2: Right

  // Line Feed & Line Spacing
  LINE_FEED: new Uint8Array([0x0a]), // LF: Print and feed 1 line
  LINE_SPACING_DEFAULT: new Uint8Array([0x1b, 0x32]), // ESC 2: Select 1/6-inch default spacing (~30 dots)

  // Paper Cutting
  PARTIAL_CUT: new Uint8Array([0x1d, 0x56, 0x42, 0x00]), // GS V 66 0: Feed and partial cut
  FULL_CUT: new Uint8Array([0x1d, 0x56, 0x41, 0x00]), // GS V 65 0: Feed and full cut

  // Cash Drawer Pulse (ESC p m t1 t2)
  DRAWER_KICK_PIN2: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]), // ESC p 0 25 250 (50ms on, 500ms off)
  DRAWER_KICK_PIN5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa])  // ESC p 1 25 250
} as const;

/**
 * Standard Props accepted by React receipt components in the application.
 */
export interface ReactReceiptProps {
  bill: Bill | null;
  items: BillItem[];
  settings?: RestaurantSettings;
  isReprint?: boolean;
  reprintCount?: number;
  printButtonText?: string;
  isPrinting?: boolean;
  onClose?: () => void;
  onPrint?: () => void | Promise<void>;
}

/**
 * Configuration options for ESC/POS conversion.
 */
export interface ReceiptConverterOptions {
  paperWidth?: '80mm' | '58mm';
  characterColumns?: number; // 48 for 80mm, 32 for 58mm (auto-detected if omitted)
  includeLogo?: boolean;
  logoDataUrl?: string; // Optional custom logo data URL or image source
  logoMaxWidth?: number; // Max width in pixels (e.g. 384 for 80mm, 256 for 58mm)
  logoThreshold?: number; // 0 - 255 monochrome luminance threshold (default 128)
  logoDither?: boolean; // Enable Floyd-Steinberg error diffusion dithering for smooth photos
  compactMode?: boolean; // Tight line spacing and reduced padding
  cutType?: 'partial' | 'full' | 'none';
  feedLinesBeforeCut?: number; // Default 4 lines
  kickCashDrawer?: boolean; // Send pulse to RJ11 cash drawer
  includeQrCode?: boolean; // Print UPI payment QR code
  includeBarcode?: boolean; // Print CODE128 bill number barcode
  useTamilScript?: boolean; // When true, uses Tamil item names; when false, uses standard English ASCII item names
  codePage?: 'PC437' | 'WPC1252';
}

/**
 * Helper to generate ESC/POS command for bold text mode.
 * @param enabled true for Bold ON, false for Bold OFF
 */
export function createBoldCommand(enabled: boolean): Uint8Array {
  return enabled ? ESCPOS_COMMANDS.BOLD_ON : ESCPOS_COMMANDS.BOLD_OFF;
}

/**
 * Helper to generate ESC/POS command for line feeding.
 * @param lines Number of lines to feed (1-255). Defaults to 1 (0x0A).
 */
export function createLineFeedCommand(lines = 1): Uint8Array {
  if (lines <= 0) return new Uint8Array(0);
  if (lines === 1) return ESCPOS_COMMANDS.LINE_FEED;
  // ESC d n (0x1B 0x64 n): Print and feed n lines
  const clamped = Math.min(Math.max(1, Math.floor(lines)), 255);
  return new Uint8Array([0x1b, 0x64, clamped]);
}

/**
 * Helper to generate ESC/POS command for custom line spacing.
 * @param dots Vertical spacing in dots (e.g. 16-64 dots). If undefined, resets to default 1/6 inch.
 */
export function createLineSpacingCommand(dots?: number): Uint8Array {
  if (dots === undefined || dots === null) {
    return ESCPOS_COMMANDS.LINE_SPACING_DEFAULT; // ESC 2
  }
  // ESC 3 n (0x1B 0x33 n): Set line spacing to n/180 or n/203 dots
  const clamped = Math.min(Math.max(0, Math.floor(dots)), 255);
  return new Uint8Array([0x1b, 0x33, clamped]);
}

/**
 * Helper to generate ESC/POS command for text alignment.
 * @param align 'left' | 'center' | 'right'
 */
export function createAlignmentCommand(align: 'left' | 'center' | 'right'): Uint8Array {
  switch (align) {
    case 'center':
      return ESCPOS_COMMANDS.ALIGN_CENTER;
    case 'right':
      return ESCPOS_COMMANDS.ALIGN_RIGHT;
    case 'left':
    default:
      return ESCPOS_COMMANDS.ALIGN_LEFT;
  }
}

/**
 * Helper to generate ESC/POS command for character sizing.
 * @param size 'normal' | 'double-height' | 'double-width' | 'double-both'
 */
export function createFontSizeCommand(
  size: 'normal' | 'double-height' | 'double-width' | 'double-both'
): Uint8Array {
  switch (size) {
    case 'double-height':
      return ESCPOS_COMMANDS.FONT_DOUBLE_HEIGHT;
    case 'double-width':
      return ESCPOS_COMMANDS.FONT_DOUBLE_WIDTH;
    case 'double-both':
      return ESCPOS_COMMANDS.FONT_DOUBLE_BOTH;
    case 'normal':
    default:
      return ESCPOS_COMMANDS.FONT_NORMAL;
  }
}

/**
 * Helper to generate paper cut command.
 * @param mode 'partial' | 'full' | 'none'
 * @param feedDots Feed lines/dots before cut
 */
export function createPaperCutCommand(
  mode: 'partial' | 'full' | 'none' = 'partial',
  feedDots = 0
): Uint8Array {
  if (mode === 'none') return new Uint8Array(0);
  const cutCode = mode === 'full' ? 0x41 : 0x42; // GS V 65 / 66
  return new Uint8Array([0x1d, 0x56, cutCode, feedDots & 0xff]);
}

/**
 * Helper to generate cash drawer kickout pulse command.
 */
export function createCashDrawerCommand(pin: 0 | 1 = 0, onTimeMs = 50, offTimeMs = 500): Uint8Array {
  const t1 = Math.min(255, Math.max(1, Math.round(onTimeMs / 2)));
  const t2 = Math.min(255, Math.max(1, Math.round(offTimeMs / 2)));
  return new Uint8Array([0x1b, 0x70, pin === 1 ? 0x01 : 0x00, t1, t2]);
}

/**
 * Converts RGBA pixel buffer into 1-bit monochrome ESC/POS raster bit image format (GS v 0).
 * Supports optional Floyd-Steinberg error diffusion dithering for photographs / rich logos.
 *
 * @param rgba Raw RGBA uint8 array (width * height * 4)
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param options threshold (0-255) and dithering flag
 */
export function convertRgbaToEscPosRaster(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: { threshold?: number; dither?: boolean; mode?: 0 | 1 | 2 | 3 } = {}
): Uint8Array {
  const threshold = options.threshold ?? 128;
  const dither = Boolean(options.dither);
  const mode = options.mode ?? 0; // 0 = Normal density

  // ESC/POS raster bit image requires width in bytes: ceil(width / 8)
  const xBytes = Math.ceil(width / 8);
  const totalImageBytes = xBytes * height;

  // Header: GS v 0 m xL xH yL yH
  // 0x1D 0x76 0x30 [mode] [xL] [xH] [yL] [yH]
  const header = [
    0x1d,
    0x76,
    0x30,
    mode,
    xBytes & 0xff,
    (xBytes >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff
  ];

  const bitmap = new Uint8Array(totalImageBytes);

  if (dither) {
    // 2D Luminance buffer for error diffusion
    const lum = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const a = rgba[idx + 3] / 255;
      // Convert transparent pixels to white background
      if (a < 0.1) {
        lum[i] = 255;
      } else {
        const gray = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
        lum[i] = gray * a + 255 * (1 - a);
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = lum[idx];
        const newVal = oldVal < threshold ? 0 : 255;
        const err = oldVal - newVal;

        if (newVal === 0) {
          // Black dot: set bit in byte
          const byteIdx = y * xBytes + (x >> 3);
          const bitPos = 7 - (x % 8);
          bitmap[byteIdx] |= 1 << bitPos;
        }

        // Distribute error to neighboring pixels (Floyd-Steinberg)
        if (x + 1 < width) lum[idx + 1] += (err * 7) / 16;
        if (x - 1 >= 0 && y + 1 < height) lum[(y + 1) * width + (x - 1)] += (err * 3) / 16;
        if (y + 1 < height) lum[(y + 1) * width + x] += (err * 5) / 16;
        if (x + 1 < width && y + 1 < height) lum[(y + 1) * width + (x + 1)] += (err * 1) / 16;
      }
    }
  } else {
    // Direct thresholding
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = (y * width + x) * 4;
        const a = rgba[pixelIdx + 3];

        // If pixel is transparent, treat as white
        if (a < 32) continue;

        const gray = 0.299 * rgba[pixelIdx] + 0.587 * rgba[pixelIdx + 1] + 0.114 * rgba[pixelIdx + 2];
        if (gray < threshold) {
          // Black dot
          const byteIdx = y * xBytes + (x >> 3);
          const bitPos = 7 - (x % 8);
          bitmap[byteIdx] |= 1 << bitPos;
        }
      }
    }
  }

  // Combine header + bitmap
  const result = new Uint8Array(header.length + bitmap.length);
  result.set(header, 0);
  result.set(bitmap, header.length);
  return result;
}

/**
 * Loads an image from a URL or data URI and converts it into ESC/POS raster graphic bytes.
 * Handles DOM/Browser environments with HTMLCanvasElement, or falls back safely in test environments.
 */
export async function convertImageSourceToEscPosGraphic(
  source: string,
  maxWidth = 384,
  threshold = 128,
  dither = false
): Promise<Uint8Array | null> {
  if (!source || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        try {
          // Compute proportional dimensions capped at maxWidth
          let targetWidth = img.naturalWidth || img.width;
          let targetHeight = img.naturalHeight || img.height;

          if (targetWidth > maxWidth) {
            const ratio = maxWidth / targetWidth;
            targetWidth = maxWidth;
            targetHeight = Math.round(targetHeight * ratio);
          }

          // Force width to be multiple of 8 for optimal thermal printhead alignment
          targetWidth = Math.floor(targetWidth / 8) * 8;
          if (targetWidth <= 0 || targetHeight <= 0) {
            resolve(null);
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(null);
            return;
          }

          // Fill white background for transparent PNG/SVG logos
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
          const raster = convertRgbaToEscPosRaster(imageData.data, targetWidth, targetHeight, {
            threshold,
            dither
          });
          resolve(raster);
        } catch (e) {
          console.warn('Canvas rasterization error:', e);
          resolve(null);
        }
      };

      img.onerror = () => {
        resolve(null);
      };

      img.src = source;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Extracts ReactReceiptProps from either a raw props object or a standard React element.
 */
export function extractReceiptProps(
  componentOrProps: ReactElement<any> | ReactReceiptProps | { props: ReactReceiptProps }
): ReactReceiptProps {
  if (!componentOrProps) {
    return { bill: null, items: [] };
  }

  // If passed a ReactElement with .props
  if (React.isValidElement(componentOrProps)) {
    return (componentOrProps.props as ReactReceiptProps) || { bill: null, items: [] };
  }

  // If passed an object that has a nested .props field
  if ('props' in componentOrProps && typeof (componentOrProps as any).props === 'object') {
    return (componentOrProps as any).props;
  }

  // Direct props object
  return componentOrProps as ReactReceiptProps;
}

/**
 * Synchronous core parser that converts React receipt data into an ESC/POS binary byte buffer.
 * Maps bill data, item line items, headers, totals, bold text, line feeds, and layout rules.
 */
export function convertReceiptDataToEscPos(
  props: ReactReceiptProps,
  options: ReceiptConverterOptions = {}
): Uint8Array {
  const { bill, items, settings } = props;
  if (!bill) {
    return new Uint8Array(0);
  }

  const is58mm = options.paperWidth === '58mm' || settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';
  const width = options.characterColumns || (is58mm ? 32 : 48);
  const isCompact = options.compactMode ?? Boolean(settings?.compactMode);

  const buffer: number[] = [];

  // Helper: Append raw byte sequence
  const pushBytes = (bytes: Uint8Array | number[]) => {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) buffer.push(bytes[i]);
    } else {
      for (let i = 0; i < bytes.length; i++) buffer.push(bytes[i] & 0xff);
    }
  };

  // Helper: Append ASCII string
  const pushAscii = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      buffer.push(text.charCodeAt(i) & 0xff);
    }
  };

  // Helper: Align Left and Right text within paper width
  const alignLR = (left: string, right: string): string => {
    const available = width - left.length - right.length;
    if (available <= 0) {
      return left.slice(0, width - right.length - 1) + ' ' + right + '\n';
    }
    return left + ' '.repeat(available) + right + '\n';
  };

  const separator = '-'.repeat(width) + '\n';
  const dblSeparator = '='.repeat(width) + '\n';

  // 1. INITIALIZATION COMMANDS
  pushBytes(ESCPOS_COMMANDS.INIT); // ESC @
  if (options.codePage === 'WPC1252') {
    pushBytes(ESCPOS_COMMANDS.CODE_PAGE_WPC1252);
  } else {
    pushBytes(ESCPOS_COMMANDS.CODE_PAGE_PC437);
  }

  // Optional: Custom line spacing for compact mode
  if (isCompact) {
    pushBytes(createLineSpacingCommand(options.paperWidth === '58mm' ? 22 : 24));
  } else {
    pushBytes(ESCPOS_COMMANDS.LINE_SPACING_DEFAULT);
  }

  // 2. CASH DRAWER KICKOUT PULSE
  if (options.kickCashDrawer) {
    pushBytes(createCashDrawerCommand(0));
  }

  // 3. HEADER: RESTAURANT IDENTITY
  const alignment = settings?.receiptAlignment || 'center';
  pushBytes(createAlignmentCommand(alignment));

  // Hotel Name in Double-Height / Double-Width Bold (Tamil only)
  pushBytes(createBoldCommand(true)); // Bold ON
  pushBytes(createFontSizeCommand('double-both')); // Double width + height

  const hotelNameTamil = settings?.restaurantNameTamil?.trim() || 'ஸ்ரீ சரவண பவன்';
  pushAscii(hotelNameTamil + '\n');

  // Reset font size and bold
  pushBytes(createFontSizeCommand('normal'));
  pushBytes(createBoldCommand(false)); // Bold OFF
  if (settings?.tagline) {
    pushAscii(settings.tagline + '\n');
  }

  // Address lines
  if (settings?.address) {
    const addr = settings.address.replace(/\r\n/g, '\n');
    const lines = addr.split('\n').map((s) => s.trim()).filter(Boolean);
    lines.forEach((line) => {
      // Wrap long address lines cleanly to fit thermal column width
      if (line.length <= width) {
        pushAscii(line + '\n');
      } else {
        let remaining = line;
        while (remaining.length > 0) {
          pushAscii(remaining.slice(0, width) + '\n');
          remaining = remaining.slice(width);
        }
      }
    });
  }

  // Phone, GSTIN, FSSAI
  if (settings?.phone) {
    pushAscii(`PH: ${settings.phone}\n`);
  }
  if (settings?.gstNumber) {
    pushAscii(`GSTIN: ${settings.gstNumber}\n`);
  }
  if (settings?.fssaiNumber) {
    pushAscii(`FSSAI: ${settings.fssaiNumber}\n`);
  }

  // 4. DUPLICATE / REPRINT BANNER
  const isReprint = props.isReprint || (bill.reprintCount && bill.reprintCount > 0);
  if (isReprint) {
    const repNum = props.reprintCount || (bill.reprintCount ? bill.reprintCount + 1 : 1);
    pushBytes(createAlignmentCommand('center'));
    pushBytes(createBoldCommand(true));
    pushAscii(`*** DUPLICATE / REPRINT #${repNum} ***\n`);
    pushBytes(createBoldCommand(false));
  }

  // 5. BILL METADATA
  pushBytes(createAlignmentCommand('left'));
  pushAscii(separator);

  const cleanBillNo = (bill.billNumber || '1').replace(/^BN-|^#/, '');
  const createdDate = new Date(bill.createdAt || Date.now());
  const dateStr = bill.businessDate || createdDate.toLocaleDateString('en-IN');
  const timeStr = createdDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const captainNumber = getCaptainNumber(bill);
  const table = bill.tableNumber || (bill.orderType === 'TAKE_AWAY' ? 'TA' : 'DR');

  pushAscii(alignLR(`Bill No: BN-${cleanBillNo}`, `Date: ${dateStr}`));
  pushAscii(alignLR(`Cap No: ${captainNumber}${table ? ` (${table})` : ''}`, `Time: ${timeStr}`));
  pushAscii(alignLR(`Order: ${bill.orderType || 'DINE_IN'}`, `Type: ${bill.priceType || 'NON_AC'}`));

  pushAscii(separator);

  // 6. ITEM TABLE
  // Header Row (Bold)
  pushBytes(createBoldCommand(true));
  if (is58mm) {
    // 32 columns: "Item             Qty  Rate   Amt"
    pushAscii('Item             Qty  Rate   Amt\n');
  } else {
    // 48 columns: "Item Name                 Qty     Rate    Amount"
    pushAscii('Item Name                 Qty     Rate    Amount\n');
  }
  pushBytes(createBoldCommand(false));
  pushAscii(separator);

  // Item Rows
  items.forEach((item, idx) => {
    const tamilName = getTamilItemName(item.itemName, item.itemNameTamil);
    // Remove English name - Tamil is enough
    const itemName = (tamilName || item.itemName || `Item ${idx + 1}`).trim();
    const qty = Number(item.quantity).toFixed(0);
    const rate = Number(item.unitPrice || 0).toFixed(2);
    const amt = Number(item.totalPrice || 0).toFixed(2);

    if (is58mm) {
      // 32 column layout: name(16), qty(3), rate(6), amt(7)
      const nameCol = itemName.slice(0, 16).padEnd(16, ' ');
      const qtyCol = qty.padStart(3, ' ');
      const rateCol = rate.padStart(6, ' ');
      const amtCol = amt.padStart(7, ' ');
      pushAscii(`${nameCol} ${qtyCol} ${rateCol} ${amtCol}\n`);

      if (itemName.length > 16) {
        pushAscii(`  ${itemName.slice(16, 32)}\n`);
      }
    } else {
      // 48 column layout: name(25), qty(4), rate(8), amt(9)
      const nameCol = itemName.slice(0, 24).padEnd(24, ' ');
      const qtyCol = qty.padStart(4, ' ');
      const rateCol = rate.padStart(8, ' ');
      const amtCol = amt.padStart(10, ' ');
      pushAscii(`${nameCol} ${qtyCol} ${rateCol} ${amtCol}\n`);

      if (itemName.length > 24) {
        pushAscii(`  ${itemName.slice(24, 46)}\n`);
      }
    }
  });

  pushAscii(separator);

  // 7. TOTAL QUANTITY & TOTALS BREAKDOWN
  const totalQty = items.reduce((s, itm) => s + (Number(itm.quantity) || 0), 0);
  pushAscii(alignLR(`Total Qty: ${totalQty}`, `Item Total: Rs.${Number(bill.subtotal || 0).toFixed(2)}`));

  if (bill.discount && bill.discount > 0) {
    pushAscii(alignLR('Discount:', `-Rs.${Number(bill.discount).toFixed(2)}`));
  }

  pushAscii(dblSeparator);

  // 8. GRAND TOTAL (Bold + Double Height)
  pushBytes(createBoldCommand(true));
  pushBytes(createFontSizeCommand('double-height'));
  const grandTotalFormatted = `Rs.${Number(bill.grandTotal || 0).toFixed(2)}`;
  pushAscii(alignLR('GRAND TOTAL:', grandTotalFormatted));

  // Reset to normal text
  pushBytes(createFontSizeCommand('normal'));
  pushBytes(createBoldCommand(false));
  pushAscii(dblSeparator);

  // Payment Status / Mode
  const paymentMode = (bill.paymentMethod || bill.paymentStatus || 'CASH').toUpperCase();
  pushAscii(alignLR('Payment Mode:', paymentMode));
  pushAscii(alignLR('Status:', (bill.status || 'PAID').toUpperCase()));

  // 9. UPI PAYMENT QR CODE (Optional)
  if (options.includeQrCode !== false && settings?.upiId && bill.grandTotal > 0) {
    pushBytes(createAlignmentCommand('center'));
    pushBytes(createLineFeedCommand(1));
    pushAscii('Scan & Pay via UPI:\n');

    const upiUrl = `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(
      settings.restaurantName || 'Restaurant'
    )}&am=${bill.grandTotal.toFixed(2)}&cu=INR`;

    appendEscPosQrCode(buffer, upiUrl);
    pushAscii(`UPI ID: ${settings.upiId}\n`);
    pushBytes(createLineFeedCommand(1));
  }

  // 10. BILL BARCODE (Optional)
  if (options.includeBarcode !== false && bill.billNumber) {
    pushBytes(createAlignmentCommand('center'));
    appendEscPosBarcode(buffer, cleanBillNo);
    pushBytes(createLineFeedCommand(1));
  }

  // 11. FOOTER MESSAGE
  pushBytes(createAlignmentCommand('center'));
  const footerText = settings?.receiptFooter || '*** THANK YOU VISIT AGAIN ***';
  pushAscii(footerText + '\n');

  // 12. FEED & PAPER CUT
  const feedLines = options.feedLinesBeforeCut ?? (isCompact ? 3 : 4);
  pushBytes(createLineFeedCommand(feedLines));

  const cutCommand = createPaperCutCommand(options.cutType || 'partial');
  pushBytes(cutCommand);

  return new Uint8Array(buffer);
}

/**
 * Primary helper function that converts standard React receipt components into ESC/POS byte-sequences.
 *
 * Accepts either:
 * - A React Element: `<ThermalReceiptModal bill={bill} items={items} settings={settings} />`
 * - Direct component Props: `{ bill, items, settings, ... }`
 *
 * Asynchronously rasterizes the graphical logo if enabled, and maps all bold text, line feeds,
 * alignment, metadata, and items into compliant ESC/POS binary bytes.
 */
export async function convertReceiptComponentToEscPos(
  componentOrProps: ReactElement<any> | ReactReceiptProps | { props: ReactReceiptProps },
  options: ReceiptConverterOptions = {}
): Promise<Uint8Array> {
  const props = extractReceiptProps(componentOrProps);
  const { settings } = props;

  // 1. Generate text and layout ESC/POS byte sequence
  const baseBytes = convertReceiptDataToEscPos(props, options);

  // 2. Check if graphic logo is requested
  const shouldIncludeLogo =
    options.includeLogo !== undefined
      ? options.includeLogo
      : settings?.logoDisplay === 'header' || settings?.logoDisplay === 'both';

  const logoUrl =
    options.logoDataUrl ||
    settings?.monochromeLogoUrl ||
    settings?.bwLogoUrl ||
    settings?.logoUrl ||
    DEFAULT_RESTAURANT_LOGO;

  if (!shouldIncludeLogo || !logoUrl) {
    return baseBytes;
  }

  // 3. Rasterize logo to ESC/POS graphic raster format (GS v 0)
  const is58mm = options.paperWidth === '58mm' || settings?.paperWidth === '58mm';
  const maxWidth = options.logoMaxWidth || (is58mm ? 256 : 384);

  const graphicBytes = await convertImageSourceToEscPosGraphic(
    logoUrl,
    maxWidth,
    options.logoThreshold ?? 128,
    options.logoDither ?? false
  );

  if (!graphicBytes || graphicBytes.length === 0) {
    return baseBytes;
  }

  // 4. Inject logo right after initialization (ESC @ and code page commands)
  // Base bytes start with ESC @ (2 bytes) + ESC t n (3 bytes) = 5 bytes
  const insertIndex = 5;
  const logoHeader: number[] = [
    0x1b, 0x61, 0x01 // Center align logo
  ];
  const logoFooter: number[] = [
    0x0a, // Feed line after logo
    0x1b, 0x61, 0x00 // Return to left align
  ];

  const totalLength =
    baseBytes.length + logoHeader.length + graphicBytes.length + logoFooter.length;
  const merged = new Uint8Array(totalLength);

  // Copy initialization commands
  merged.set(baseBytes.subarray(0, insertIndex), 0);
  let cursor = insertIndex;

  // Copy center align + logo raster + spacing
  merged.set(logoHeader, cursor);
  cursor += logoHeader.length;
  merged.set(graphicBytes, cursor);
  cursor += graphicBytes.length;
  merged.set(logoFooter, cursor);
  cursor += logoFooter.length;

  // Copy remaining receipt commands
  merged.set(baseBytes.subarray(insertIndex), cursor);

  return merged;
}

/**
 * Appends standard ESC/POS QR Code command sequence (Model 2, size 4, error correction level M).
 */
function appendEscPosQrCode(parts: number[], data: string): void {
  // 1. Model selection: Model 2 (1D 28 6B 04 00 31 41 32 00)
  parts.push(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // 2. Module size: 4 dots (1D 28 6B 03 00 31 43 04)
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x04);
  // 3. Error correction level M (1D 28 6B 03 00 31 45 31)
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  // 4. Store data in QR code symbol: length = data.length + 3
  const len = data.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;
  parts.push(0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30);
  for (let i = 0; i < data.length; i++) {
    parts.push(data.charCodeAt(i) & 0xff);
  }
  // 5. Print the QR symbol (1D 28 6B 03 00 31 51 30)
  parts.push(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
}

/**
 * Appends standard ESC/POS CODE128 barcode command sequence.
 */
function appendEscPosBarcode(parts: number[], codeText: string): void {
  const clean = codeText.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20);
  if (!clean) return;
  // Set barcode height: 50 dots (1D 68 32)
  parts.push(0x1d, 0x68, 0x32);
  // Set module width: 2 dots (1D 77 02)
  parts.push(0x1d, 0x77, 0x02);
  // HRI characters below barcode (1D 48 02)
  parts.push(0x1d, 0x48, 0x02);
  // Print CODE128: GS k 73 [len] [bytes]
  parts.push(0x1d, 0x6b, 0x49, clean.length);
  for (let i = 0; i < clean.length; i++) {
    parts.push(clean.charCodeAt(i) & 0xff);
  }
}
