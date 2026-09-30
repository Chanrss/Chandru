import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestPrintModal } from './TestPrintModal';
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

describe('TestPrintModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <TestPrintModal
        isOpen={false}
        onClose={vi.fn()}
        settings={mockSettings}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders test slip preview elements when isOpen is true', () => {
    render(
      <TestPrintModal
        isOpen={true}
        onClose={vi.fn()}
        settings={mockSettings}
      />
    );

    expect(screen.getByText(/Thermal Printer Test Page/i)).toBeDefined();
    expect(screen.getByText(/PRINTER DIAGNOSTIC/i)).toBeDefined();
    expect(screen.getByText(/STANDARDIZED TEST PAGE/i)).toBeDefined();
    expect(screen.getByText(/ONLINE \/ CONNECTED/i)).toBeDefined();
    expect(screen.getByText(/PASSED \/ 20MM FEED/i)).toBeDefined();
    expect(screen.getAllByText(/80mm \(3-Inch\)/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/STANDARDIZED DIAGNOSTIC STRING/i)).toBeDefined();
    expect(screen.getByText(/THERMAL HEAD DENSITY/i)).toBeDefined();
    expect(screen.getByText(/TEAR \/ CUT HERE/i)).toBeDefined();
  });

  it('triggers PrinterService.printDiagnosticTestPage when Print button is clicked', () => {
    const printSpy = vi.spyOn(PrinterService, 'printDiagnosticTestPage').mockReturnValue({
      success: true
    });
    const onPrintSuccess = vi.fn();

    render(
      <TestPrintModal
        isOpen={true}
        onClose={vi.fn()}
        settings={mockSettings}
        onPrintSuccess={onPrintSuccess}
      />
    );

    const printButton = screen.getByRole('button', { name: /Print Test Page/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledWith(mockSettings, true);
    expect(onPrintSuccess).toHaveBeenCalled();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <TestPrintModal
        isOpen={true}
        onClose={onClose}
        settings={mockSettings}
      />
    );

    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });
});
