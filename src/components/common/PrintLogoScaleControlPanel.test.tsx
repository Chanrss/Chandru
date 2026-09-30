import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrintLogoScaleControlPanel, PRESETS_80MM } from './PrintLogoScaleControlPanel';
import { PrinterService } from '../../services/printerService';

vi.mock('../../services/printerService', () => ({
  PrinterService: {
    setPrintRootLogoSize: vi.fn(),
    getPrintRootLogoSize: vi.fn(() => ({ width: 140, height: 50 }))
  }
}));

describe('PrintLogoScaleControlPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with initial dimensions and updates PrinterService', () => {
    const handleSizeChange = vi.fn();

    render(
      <PrintLogoScaleControlPanel
        initialWidth={140}
        initialHeight={50}
        paperWidth="80mm"
        onSizeChange={handleSizeChange}
      />
    );

    expect(screen.getByText(/Logo Scaling & 80mm Paper Fit/i)).toBeDefined();
    expect(screen.getByText(/140 × 50px/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Width/i)).toBeDefined();
    expect(screen.getByLabelText(/Max Height/i)).toBeDefined();
  });

  it('adjusts width slider and triggers callbacks and CSS variable update', () => {
    const handleSizeChange = vi.fn();

    render(
      <PrintLogoScaleControlPanel
        initialWidth={140}
        initialHeight={50}
        paperWidth="80mm"
        onSizeChange={handleSizeChange}
      />
    );

    const widthSlider = screen.getByLabelText(/Max Width/i);
    fireEvent.change(widthSlider, { target: { value: '180' } });

    expect(handleSizeChange).toHaveBeenCalled();
    expect(PrinterService.setPrintRootLogoSize).toHaveBeenCalled();
  });

  it('clicking quick presets sets exact dimensions for 80mm roll', () => {
    const handleSizeChange = vi.fn();

    render(
      <PrintLogoScaleControlPanel
        initialWidth={140}
        initialHeight={50}
        paperWidth="80mm"
        onSizeChange={handleSizeChange}
      />
    );

    // Look for preset button "Prominent Crest" (95x95)
    const prominentBtn = screen.getByText('Prominent Crest');
    fireEvent.click(prominentBtn);

    expect(handleSizeChange).toHaveBeenCalledWith(95, 95);
    expect(PrinterService.setPrintRootLogoSize).toHaveBeenCalledWith(95, 95);
  });

  it('saves default size when "Save as Default" is clicked', async () => {
    const handleSaveDefault = vi.fn().mockResolvedValue(undefined);

    render(
      <PrintLogoScaleControlPanel
        initialWidth={160}
        initialHeight={55}
        paperWidth="80mm"
        onSizeChange={vi.fn()}
        onSaveDefault={handleSaveDefault}
      />
    );

    const saveBtn = screen.getByText(/Save as Default/i);
    fireEvent.click(saveBtn);

    expect(handleSaveDefault).toHaveBeenCalledWith(160, 55);
  });
});
