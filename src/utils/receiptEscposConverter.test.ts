import { describe, it, expect } from 'vitest';
import React from 'react';
import {
  createBoldCommand,
  createLineFeedCommand,
  createLineSpacingCommand,
  createPaperCutCommand,
  createCashDrawerCommand,
  createFontSizeCommand,
  convertRgbaToEscPosRaster,
  convertReceiptDataToEscPos,
  convertReceiptComponentToEscPos,
  extractReceiptProps,
  ESCPOS_COMMANDS,
  ReactReceiptProps
} from './receiptEscposConverter';
import { Bill, BillItem, RestaurantSettings } from '../types';

describe('receiptEscposConverter Utility', () => {
  const sampleBill: Bill = {
    id: 'b-101',
    billNumber: 'BN-101',
    businessDate: '2026-09-17',
    orderType: 'DINE_IN',
    priceType: 'NON_AC',
    tableNumber: 'T-4',
    userId: 'u-1',
    userName: 'Sivan',
    subtotal: 150,
    discount: 10,
    grandTotal: 140,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    status: 'COMPLETED',
    reprintCount: 0,
    createdAt: 1726550400000
  };

  const sampleItems: BillItem[] = [
    {
      id: 'bi-1',
      billId: 'b-101',
      itemId: 'i-1',
      itemCode: '101',
      itemName: 'Ghee Roast Dosa',
      itemNameTamil: 'நெய் ரோஸ்ட் தோசை',
      quantity: 1,
      unitPrice: 100,
      totalPrice: 100,
      priceType: 'NON_AC',
      createdAt: 1726550400000
    },
    {
      id: 'bi-2',
      billId: 'b-101',
      itemId: 'i-2',
      itemCode: '102',
      itemName: 'Filter Coffee',
      itemNameTamil: 'பில்டர் காபி',
      quantity: 2,
      unitPrice: 25,
      totalPrice: 50,
      priceType: 'NON_AC',
      createdAt: 1726550400000
    }
  ];

  const sampleSettings: RestaurantSettings = {
    restaurantName: 'Sri Saravana Bhavan',
    restaurantNameTamil: 'ஸ்ரீ சரவண பவன்',
    address: 'No:8A, Rajambal Nagar\nKallakurichi-606213',
    phone: '7708159933',
    gstNumber: '33AAAAA0000A1Z5',
    fssaiNumber: '12421000000000',
    paperWidth: '80mm',
    printerType: 'THERMAL_80MM',
    upiId: 'saravana@upi'
  };

  describe('ESC/POS Command Helper Functions', () => {
    it('generates bold ON and OFF commands accurately', () => {
      const boldOn = createBoldCommand(true);
      expect(boldOn).toEqual(new Uint8Array([0x1b, 0x45, 0x01]));

      const boldOff = createBoldCommand(false);
      expect(boldOff).toEqual(new Uint8Array([0x1b, 0x45, 0x00]));
    });

    it('generates line feed commands accurately', () => {
      const singleFeed = createLineFeedCommand(1);
      expect(singleFeed).toEqual(new Uint8Array([0x0a]));

      const multiFeed = createLineFeedCommand(4);
      expect(multiFeed).toEqual(new Uint8Array([0x1b, 0x64, 0x04]));

      const zeroFeed = createLineFeedCommand(0);
      expect(zeroFeed.length).toBe(0);
    });

    it('generates line spacing commands', () => {
      const defaultSpacing = createLineSpacingCommand();
      expect(defaultSpacing).toEqual(new Uint8Array([0x1b, 0x32]));

      const customSpacing = createLineSpacingCommand(24);
      expect(customSpacing).toEqual(new Uint8Array([0x1b, 0x33, 24]));
    });

    it('generates font size and character expansion commands', () => {
      expect(createFontSizeCommand('normal')).toEqual(new Uint8Array([0x1d, 0x21, 0x00]));
      expect(createFontSizeCommand('double-height')).toEqual(new Uint8Array([0x1d, 0x21, 0x01]));
      expect(createFontSizeCommand('double-width')).toEqual(new Uint8Array([0x1d, 0x21, 0x10]));
      expect(createFontSizeCommand('double-both')).toEqual(new Uint8Array([0x1d, 0x21, 0x11]));
    });

    it('generates paper cut and cash drawer pulse commands', () => {
      const partialCut = createPaperCutCommand('partial');
      expect(partialCut).toEqual(new Uint8Array([0x1d, 0x56, 0x42, 0x00]));

      const fullCut = createPaperCutCommand('full');
      expect(fullCut).toEqual(new Uint8Array([0x1d, 0x56, 0x41, 0x00]));

      const drawer = createCashDrawerCommand(0, 50, 500);
      expect(drawer[0]).toBe(0x1b);
      expect(drawer[1]).toBe(0x70);
      expect(drawer[2]).toBe(0x00);
    });
  });

  describe('Graphics and Raster Bit Image Generation', () => {
    it('converts RGBA pixel buffer into standard ESC/POS raster bit image (GS v 0)', () => {
      // 16x8 pixels (2 bytes wide x 8 rows = 16 bytes of bitmap data)
      const width = 16;
      const height = 8;
      const rgba = new Uint8ClampedArray(width * height * 4);

      // Fill top row with black pixels (RGBA: 0, 0, 0, 255)
      for (let x = 0; x < width; x++) {
        const idx = x * 4;
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 255;
      }

      const raster = convertRgbaToEscPosRaster(rgba, width, height, { threshold: 128 });

      // Check ESC/POS GS v 0 header (8 bytes): 1D 76 30 00 xL xH yL yH
      expect(raster[0]).toBe(0x1d); // GS
      expect(raster[1]).toBe(0x76); // v
      expect(raster[2]).toBe(0x30); // 0
      expect(raster[3]).toBe(0x00); // normal mode
      expect(raster[4]).toBe(2);    // xL (16 pixels / 8 = 2 bytes)
      expect(raster[5]).toBe(0);    // xH
      expect(raster[6]).toBe(8);    // yL (8 dots high)
      expect(raster[7]).toBe(0);    // yH

      // Row 0 should be all black (11111111 11111111 = 0xFF 0xFF)
      expect(raster[8]).toBe(0xff);
      expect(raster[9]).toBe(0xff);

      // Remaining rows should be white (0x00)
      for (let i = 10; i < raster.length; i++) {
        expect(raster[i]).toBe(0x00);
      }
    });
  });

  describe('convertReceiptDataToEscPos', () => {
    it('parses bill data and generates complete ESC/POS receipt byte sequence', () => {
      const props: ReactReceiptProps = {
        bill: sampleBill,
        items: sampleItems,
        settings: sampleSettings
      };

      const buffer = convertReceiptDataToEscPos(props, { paperWidth: '80mm' });
      expect(buffer).toBeInstanceOf(Uint8Array);
      expect(buffer.length).toBeGreaterThan(100);

      const text = new TextDecoder('ascii', { fatal: false }).decode(buffer);

      // Restaurant address & contact info
      expect(text).toContain('Rajambal Nagar');
      expect(text).toContain('7708159933');

      // Bill Number & Captain Number
      expect(text).toContain('BN-101');
      expect(text).toContain('Cap No: 1');

      // Totals
      expect(text).toContain('GRAND TOTAL:');
      expect(text).toContain('140.00');

      // Footer
      expect(text).toContain('THANK YOU VISIT AGAIN');
    });

    it('handles 58mm compact receipts properly', () => {
      const props: ReactReceiptProps = {
        bill: sampleBill,
        items: sampleItems,
        settings: { ...sampleSettings, paperWidth: '58mm' }
      };

      const buffer = convertReceiptDataToEscPos(props, { paperWidth: '58mm', compactMode: true });
      expect(buffer.length).toBeGreaterThan(50);

      // Should include custom line spacing command ESC 3 n
      let hasCustomSpacing = false;
      for (let i = 0; i < buffer.length - 2; i++) {
        if (buffer[i] === 0x1b && buffer[i + 1] === 0x33) {
          hasCustomSpacing = true;
          break;
        }
      }
      expect(hasCustomSpacing).toBe(true);
    });

    it('formats duplicate/reprint banner when isReprint is true', () => {
      const props: ReactReceiptProps = {
        bill: { ...sampleBill, reprintCount: 2 },
        items: sampleItems,
        settings: sampleSettings,
        isReprint: true
      };

      const buffer = convertReceiptDataToEscPos(props);
      const text = new TextDecoder('ascii', { fatal: false }).decode(buffer);
      expect(text).toContain('*** DUPLICATE / REPRINT');
    });
  });

  describe('convertReceiptComponentToEscPos & React Element Extraction', () => {
    it('extracts props safely from ReactElement or props object', () => {
      const props: ReactReceiptProps = {
        bill: sampleBill,
        items: sampleItems,
        settings: sampleSettings
      };

      // Mock React element
      const element = React.createElement('div', props as any);
      const extracted = extractReceiptProps(element);

      expect(extracted.bill).toEqual(sampleBill);
      expect(extracted.items.length).toBe(2);
    });

    it('converts a component or element asynchronously to ESC/POS bytes', async () => {
      const props: ReactReceiptProps = {
        bill: sampleBill,
        items: sampleItems,
        settings: sampleSettings
      };

      const bytes = await convertReceiptComponentToEscPos(props, { includeLogo: false });
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(100);

      // Verify initialization at start: ESC @
      expect(bytes[0]).toBe(0x1b);
      expect(bytes[1]).toBe(0x40);

      // Verify partial cut at end: GS V 66 0
      const len = bytes.length;
      expect(bytes[len - 4]).toBe(0x1d);
      expect(bytes[len - 3]).toBe(0x56);
      expect(bytes[len - 2]).toBe(0x42);
      expect(bytes[len - 1]).toBe(0x00);
    });
  });
});
