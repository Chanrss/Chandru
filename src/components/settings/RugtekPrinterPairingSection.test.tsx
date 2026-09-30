import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { RugtekPrinterPairingSection } from './RugtekPrinterPairingSection';
import { PrinterConnectionService } from '../../services/printerConnectionService';
import { RestaurantSettings, ConnectedPrinterInfo } from '../../types';

vi.mock('../../services/printerConnectionService', () => {
  let mockPrinter: ConnectedPrinterInfo = {
    connected: false,
    interfaceType: 'SYSTEM_SPOOLER',
    deviceName: 'Rugtek RP326 (Thermal POS)',
    baudRate: 19200,
    vendorId: '0x0416',
    productId: '0x5011',
    testPrintVerified: false
  };

  const subscribers = new Set<(info: any) => void>();

  return {
    RUGTEK_RP326B_PROFILE: {
      modelName: 'Rugtek RP326B',
      paperWidthMm: 80,
      printableWidthMm: 72,
      dotsPerLine: 576,
      defaultBaudRate: 19200,
      autoCutter: true
    },
    PrinterConnectionService: {
      SUPPORTED_BAUD_RATES: [9600, 19200, 38400, 57600, 115200],
      getConnectedPrinter: vi.fn(() => ({ ...mockPrinter })),
      getStoredBaudRate: vi.fn(() => 19200),
      setStoredBaudRate: vi.fn(),
      getCapabilities: vi.fn(() => ({
        hasWebSerial: true,
        hasWebUsb: true,
        isSandboxed: false
      })),
      connectSerial: vi.fn(async (baudRate?: number) => {
        mockPrinter = {
          connected: true,
          interfaceType: 'WEB_SERIAL' as const,
          deviceName: 'Rugtek RP326 (Serial / COM 0x0416:0x5011)',
          baudRate: baudRate || 19200,
          vendorId: '0x0416',
          productId: '0x5011',
          testPrintVerified: false
        };
        subscribers.forEach((cb) => cb(mockPrinter));
        return { success: true, deviceName: mockPrinter.deviceName };
      }),
      connectUsb: vi.fn(async () => {
        mockPrinter = {
          connected: true,
          interfaceType: 'WEB_USB' as const,
          deviceName: 'Rugtek RP326 (WebUSB Direct)',
          baudRate: 19200,
          vendorId: '0x0416',
          productId: '0x5011',
          testPrintVerified: false
        };
        subscribers.forEach((cb) => cb(mockPrinter));
        return { success: true, deviceName: mockPrinter.deviceName };
      }),
      disconnect: vi.fn(() => {
        mockPrinter = {
          connected: false,
          interfaceType: 'SYSTEM_SPOOLER' as const,
          deviceName: 'System Spooler (Default)',
          baudRate: 19200,
          vendorId: undefined,
          productId: undefined,
          testPrintVerified: false
        };
        subscribers.forEach((cb) => cb(mockPrinter));
      }),
      sendRawBytes: vi.fn(async () => ({ success: true, channel: 'Web Serial' })),
      testPaperCut: vi.fn(async () => ({ success: true })),
      testCashDrawer: vi.fn(async () => ({ success: true })),
      markTestPrintVerified: vi.fn(() => {
        mockPrinter.testPrintVerified = true;
        subscribers.forEach((cb) => cb(mockPrinter));
      }),
      subscribe: vi.fn((callback) => {
        subscribers.add(callback);
        callback({ ...mockPrinter });
        return () => subscribers.delete(callback);
      }),
      downloadSilentKioskBatScript: vi.fn()
    }
  };
});

describe('RugtekPrinterPairingSection', () => {
  const mockSettings: RestaurantSettings = {
    restaurantName: 'SRI SARAVANA BHAVAN',
    address: 'Salem Main Rd, Kallakurichi',
    phone: '7708159933',
    paperWidth: '80mm',
    autoPrintOnSave: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the pairing header, hardware badges, and printer identification grid', () => {
    render(<RugtekPrinterPairingSection settings={mockSettings} />);

    expect(screen.getByText(/Rugtek RP326 Hardware Pairing/i)).toBeDefined();
    expect(screen.getByText(/WEB SERIAL \/ WEBUSB/i)).toBeDefined();
    expect(screen.getByText(/Printer Device Identification/i)).toBeDefined();
    expect(screen.getByText(/80mm \/ 3-Inch Roll/i)).toBeDefined();
    expect(screen.getByText(/250 mm\/s Speed/i)).toBeDefined();
  });

  it('allows initiating Web Serial pairing and updates status to Connected', async () => {
    const handleUpdateSettings = vi.fn();
    render(
      <RugtekPrinterPairingSection 
        settings={mockSettings} 
        onUpdateSettings={handleUpdateSettings} 
      />
    );

    const pairSerialBtn = screen.getByRole('button', { name: /Pair via Web Serial/i });
    fireEvent.click(pairSerialBtn);

    await waitFor(() => {
      expect(PrinterConnectionService.connectSerial).toHaveBeenCalledWith(19200);
    });

    await waitFor(() => {
      expect(screen.getByText(/CONNECTED & READY/i)).toBeDefined();
    });
  });

  it('allows initiating WebUSB pairing', async () => {
    render(<RugtekPrinterPairingSection settings={mockSettings} />);

    const pairUsbBtn = screen.getByRole('button', { name: /Pair via WebUSB/i });
    fireEvent.click(pairUsbBtn);

    await waitFor(() => {
      expect(PrinterConnectionService.connectUsb).toHaveBeenCalled();
    });
  });

  it('allows changing the serial baud rate', () => {
    render(<RugtekPrinterPairingSection settings={mockSettings} />);

    const select = screen.getByTitle(/Rugtek RP326 default baud rate is 19200/i);
    fireEvent.change(select, { target: { value: '38400' } });

    expect(PrinterConnectionService.setStoredBaudRate).toHaveBeenCalledWith(38400);
  });

  it('dispatches hardware verification commands (test slip, paper cut, cash drawer)', async () => {
    render(<RugtekPrinterPairingSection settings={mockSettings} />);

    // Test slip
    const testSlipBtn = screen.getByRole('button', { name: /Send Test Slip/i });
    fireEvent.click(testSlipBtn);
    await waitFor(() => {
      expect(PrinterConnectionService.sendRawBytes).toHaveBeenCalled();
      expect(PrinterConnectionService.markTestPrintVerified).toHaveBeenCalled();
    });

    // Test cutter
    const testCutterBtn = screen.getByRole('button', { name: /Test Auto-Cutter/i });
    fireEvent.click(testCutterBtn);
    await waitFor(() => {
      expect(PrinterConnectionService.testPaperCut).toHaveBeenCalled();
    });

    // Test cash drawer
    const testDrawerBtn = screen.getByRole('button', { name: /Test Cash Drawer/i });
    fireEvent.click(testDrawerBtn);
    await waitFor(() => {
      expect(PrinterConnectionService.testCashDrawer).toHaveBeenCalled();
    });
  });

  it('allows disconnecting/unpairing the active printer', async () => {
    render(<RugtekPrinterPairingSection settings={mockSettings} />);

    // Connect first
    const pairSerialBtn = screen.getByRole('button', { name: /Pair via Web Serial/i });
    fireEvent.click(pairSerialBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Disconnect/i })).toBeDefined();
    });

    const disconnectBtn = screen.getByRole('button', { name: /Disconnect/i });
    fireEvent.click(disconnectBtn);

    expect(PrinterConnectionService.disconnect).toHaveBeenCalled();
  });
});
