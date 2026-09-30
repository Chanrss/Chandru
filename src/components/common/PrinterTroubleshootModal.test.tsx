import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrinterTroubleshootModal } from './PrinterTroubleshootModal';
import { PrinterService } from '../../services/printerService';
import { RestaurantSettings } from '../../types';

const mockSettings: RestaurantSettings = {
  restaurantName: 'Sri Saravana Bhavan',
  address: '100 Main St',
  phone: '9876543210',
  paperWidth: '80mm',
  receiptFontSize: 12,
  compactMode: false
};

describe('PrinterTroubleshootModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PrinterTroubleshootModal
        isOpen={false}
        onClose={vi.fn()}
        settings={mockSettings}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders printer telemetry and connection status when isOpen is true', () => {
    render(
      <PrinterTroubleshootModal
        isOpen={true}
        onClose={vi.fn()}
        settings={mockSettings}
      />
    );

    expect(screen.getByRole('heading', { name: /Thermal Printer/i })).toBeDefined();
    expect(screen.getByText(/Software ↔ Printer Link Status/i)).toBeDefined();
    expect(screen.getByText(/USB \/ System Spooler/i)).toBeDefined();
    expect(screen.getByText(/80mm \(3-Inch\)/i)).toBeDefined();
    expect(screen.getByText(/Quick Test/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Print Test Receipt Now/i })).toBeDefined();
    expect(screen.getByText(/Simple 3-Step Setup/i)).toBeDefined();
  });

  it('triggers PrinterService.printDiagnosticTestPage when Print Test Receipt Now is clicked', () => {
    const printSpy = vi.spyOn(PrinterService, 'printDiagnosticTestPage').mockReturnValue({
      success: true
    });

    render(
      <PrinterTroubleshootModal
        isOpen={true}
        onClose={vi.fn()}
        settings={mockSettings}
      />
    );

    const testBtn = screen.getByRole('button', { name: /Print Test Receipt Now/i });
    fireEvent.click(testBtn);

    expect(printSpy).toHaveBeenCalledWith(mockSettings, true);
  });

  it('calls onNavigateSettings when Full Receipt Settings is clicked', () => {
    const navSpy = vi.fn();
    const closeSpy = vi.fn();

    render(
      <PrinterTroubleshootModal
        isOpen={true}
        onClose={closeSpy}
        settings={mockSettings}
        onNavigateSettings={navSpy}
      />
    );

    const settingsBtn = screen.getByRole('button', { name: /Full Receipt Settings/i });
    fireEvent.click(settingsBtn);

    expect(closeSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalled();
  });
});
