import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PrinterDiagnosticView } from './PrinterDiagnosticView';
import { PrinterService } from '../../services/printerService';
import { RestaurantSettings } from '../../types';

vi.mock('../../services/printerService', () => ({
  PrinterService: {
    isMockPrintMode: vi.fn(() => false),
    setMockPrintMode: vi.fn(),
    printDiagnosticTestPage: vi.fn(() => ({ success: true })),
  },
}));

vi.mock('../../services/printDiagnostics', () => ({
  PrintDiagnosticsService: {
    subscribeLogs: vi.fn((cb) => {
      cb([]);
      return () => {};
    }),
    exportLogsAsJSON: vi.fn(() => '[]'),
    getLocalLogs: vi.fn(() => []),
  },
}));

describe('PrinterDiagnosticView', () => {
  const mockSettings: RestaurantSettings = {
    restaurantName: 'TEST RESTAURANT',
    address: '123 Main Street',
    phone: '9876543210',
    paperWidth: '80mm',
    autoPrintOnSave: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Printer Diagnostics header, status badges, and browser capabilities', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    expect(screen.getByText(/Printer Diagnostics & POS Setup/i)).toBeDefined();
    expect(screen.getByText(/80mm Roll/i)).toBeDefined();
    expect(screen.getByText(/Browser window.print\(\) Engine/i)).toBeDefined();
    expect(screen.getByText(/Thermal Printer Setup Instructions for POS Systems/i)).toBeDefined();
  });

  it('displays thermal printer setup instructions tabs and switches content when clicked', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    // Default tab is 1. Browser Dialog
    expect(screen.getByText(/Chrome \/ Edge POS Print Dialog Settings/i)).toBeDefined();
    expect(screen.getByText(/Margins: Set to "None"/i)).toBeDefined();

    // Click Kiosk Auto-Print tab
    const kioskTabBtn = screen.getByText(/2. Kiosk Auto-Print/i);
    fireEvent.click(kioskTabBtn);

    expect(screen.getByText(/Kiosk Mode: 0-Click Instant Silent Printing for Cashiers/i)).toBeDefined();
    expect(screen.getAllByText(/--kiosk-printing/i).length).toBeGreaterThan(0);

    // Click Hardware & Cables tab
    const hardwareTabBtn = screen.getByText(/3. Hardware & Cables/i);
    fireEvent.click(hardwareTabBtn);

    expect(screen.getByText(/Physical Thermal Hardware Connections & Cable Checklist/i)).toBeDefined();
    expect(screen.getByText(/24V DC 2.5A Dedicated Power Brick/i)).toBeDefined();

    // Click Brand Drivers tab
    const driversTabBtn = screen.getByText(/4. Brand Drivers/i);
    fireEvent.click(driversTabBtn);

    expect(screen.getByText(/Brand Drivers & Recommended Configuration/i)).toBeDefined();
    expect(screen.getByText(/Epson TM-T82, TM-T82II, TM-T82III, TM-m30/i)).toBeDefined();

    // Click Tamil & Fonts tab
    const tamilTabBtn = screen.getByText(/5. Tamil & Fonts/i);
    fireEvent.click(tamilTabBtn);

    expect(screen.getByText(/Tamil Unicode & Regional Font Thermal Printing/i)).toBeDefined();
  });

  it('calls PrinterService.printDiagnosticTestPage when Print Test Page is clicked', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    const testSlipBtn = screen.getByRole('button', { name: /Print Test Page/i });
    fireEvent.click(testSlipBtn);

    expect(PrinterService.printDiagnosticTestPage).toHaveBeenCalledWith(mockSettings);
  });

  it('triggers onOpenTestModal when Preview Slip button is clicked', () => {
    const handleOpenTestModal = vi.fn();
    render(<PrinterDiagnosticView settings={mockSettings} onOpenTestModal={handleOpenTestModal} />);

    const previewBtn = screen.getByRole('button', { name: /Preview Slip/i });
    fireEvent.click(previewBtn);

    expect(handleOpenTestModal).toHaveBeenCalledTimes(1);
  });

  it('renders the Troubleshooting accordion with common thermal printing fixes', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    // Section header
    expect(screen.getByText(/Troubleshooting & Common Fixes/i)).toBeDefined();

    // Check specific fixes requested by user
    expect(screen.getByText(/Check USB connection & port power/i)).toBeDefined();
    expect(screen.getByText(/Select correct printer model in Print dialog/i)).toBeDefined();
    expect(screen.getByText(/Verify Paper roll orientation \(Blank Receipts\)/i)).toBeDefined();
    expect(screen.getByText(/Fix margin offsets, blank top space & chopped borders/i)).toBeDefined();
    expect(screen.getByText(/Clear cutter blade jams & flashing red error lights/i)).toBeDefined();
    expect(screen.getByText(/Fix garbled symbols, "\?\?\?\?" or continuous feed/i)).toBeDefined();
  });

  it('allows collapsing and expanding accordion items', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    // By default, 'usb' is expanded so its step text is visible
    expect(screen.getByText(/Confirm the USB Type-B cable is firmly plugged directly/i)).toBeDefined();

    // Clicking header collapses it
    const usbHeaderBtn = screen.getByText(/Check USB connection & port power/i).closest('button')!;
    fireEvent.click(usbHeaderBtn);

    // After collapsing, the step is no longer in document
    expect(screen.queryByText(/Confirm the USB Type-B cable is firmly plugged directly/i)).toBeNull();

    // Clicking it again re-expands
    fireEvent.click(usbHeaderBtn);
    expect(screen.getByText(/Confirm the USB Type-B cable is firmly plugged directly/i)).toBeDefined();
  });

  it('supports filtering troubleshooting solutions by keyword search', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    const searchInput = screen.getByPlaceholderText(/Filter troubleshooting guides/i);
    fireEvent.change(searchInput, { target: { value: 'cutter' } });

    // 'Clear cutter blade jams' should still be visible
    expect(screen.getByText(/Clear cutter blade jams & flashing red error lights/i)).toBeDefined();

    // USB connection item should be filtered out
    expect(screen.queryByText(/Check USB connection & port power/i)).toBeNull();

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /Clear troubleshooting search/i });
    fireEvent.click(clearBtn);

    // USB connection item is restored
    expect(screen.getByText(/Check USB connection & port power/i)).toBeDefined();
  });

  it('supports Expand All and Collapse All buttons', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    const collapseAllBtn = screen.getByRole('button', { name: /Collapse All/i });
    fireEvent.click(collapseAllBtn);

    // All steps should be collapsed
    expect(screen.queryByText(/Confirm the USB Type-B cable is firmly plugged directly/i)).toBeNull();

    const expandAllBtn = screen.getByRole('button', { name: /Expand All/i });
    fireEvent.click(expandAllBtn);

    // All should be expanded
    expect(screen.getByText(/Confirm the USB Type-B cable is firmly plugged directly/i)).toBeDefined();
    expect(screen.getByText(/Turn the manual white plastic thumb-wheel gear/i)).toBeDefined();
  });

  it('displays Rugtek RP326B in Brand Drivers tab and handles profile configuration', () => {
    const handleUpdateSettings = vi.fn();
    render(<PrinterDiagnosticView settings={mockSettings} onUpdateSettings={handleUpdateSettings} />);

    // Check header banner has Rugtek profile
    expect(screen.getAllByText(/Rugtek RP326B/i).length).toBeGreaterThan(0);

    // Switch to Brand Drivers tab
    const driversTabBtn = screen.getByText(/4. Brand Drivers/i);
    fireEvent.click(driversTabBtn);

    // Verify Rugtek RP326B spotlight card details
    expect(screen.getByText(/80mm High-Speed \(250mm\/s\)/i)).toBeDefined();
    expect(screen.getByText(/72mm Printable \(576 dots\)/i)).toBeDefined();
    expect(screen.getByText(/Partial Cut \(Guillotine\)/i)).toBeDefined();
    expect(screen.getByText(/Rugtek RP326B Step-by-Step Configuration Guide/i)).toBeDefined();

    // Click Apply Rugtek RP326B button
    const applyBtn = screen.getByRole('button', { name: /Apply Rugtek RP326B Settings/i });
    fireEvent.click(applyBtn);

    expect(handleUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        paperWidth: '80mm',
        printerType: 'THERMAL_80MM',
        printerModelName: 'Rugtek RP326B',
        compactMode: true
      })
    );
  });

  it('includes a dedicated Rugtek RP326B troubleshooting guide in the accordion', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    expect(screen.getByText(/Rugtek RP326B optimal settings & configuration/i)).toBeDefined();

    // Expand Rugtek item
    const rugtekAccordionBtn = screen.getByText(/Rugtek RP326B optimal settings & configuration/i).closest('button')!;
    fireEvent.click(rugtekAccordionBtn);

    expect(screen.getByText(/Driver Name: Select "POS-80" or the official "Rugtek RP326 POS Printer" driver/i)).toBeDefined();
    expect(screen.getByText(/Printable area is 72mm \(576 dots per line\)/i)).toBeDefined();
    expect(screen.getByText(/Baud Rate \(Serial\/RS-232\): Default factory speed is 19200 bps/i)).toBeDefined();
  });

  it('renders the Raw ESC/POS Test button and opens the diagnostic handshake modal', () => {
    render(<PrinterDiagnosticView settings={mockSettings} />);

    const rawEscPosBtn = screen.getByRole('button', { name: /Raw ESC\/POS Test/i });
    expect(rawEscPosBtn).toBeDefined();

    fireEvent.click(rawEscPosBtn);

    expect(screen.getByText(/Raw ESC\/POS Diagnostic Test/i)).toBeDefined();
    expect(screen.getByText(/BYPASS DIALOG/i)).toBeDefined();
    expect(screen.getByText(/Character Sets & Handshake/i)).toBeDefined();
  });
});
