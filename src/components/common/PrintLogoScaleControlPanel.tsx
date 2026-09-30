import React, { useState, useEffect, useCallback } from 'react';
import { Sliders, Link, Unlink, RotateCcw, Save, Check, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react';
import { PrinterService } from '../../services/printerService';

export interface PrintLogoScaleControlPanelProps {
  initialWidth?: number;
  initialHeight?: number;
  paperWidth?: '80mm' | '58mm';
  onSizeChange: (width: number, height: number) => void;
  onSaveDefault?: (width: number, height: number) => Promise<void>;
  logoDisplay?: 'watermark' | 'header' | 'both' | 'none';
  onLogoDisplayChange?: (mode: 'watermark' | 'header' | 'both' | 'none') => void;
  className?: string;
}

// 80mm thermal paper standard printable width is approx 72mm (~272px at 203dpi)
// 58mm thermal paper printable width is approx 48mm (~180px at 203dpi)
const PAPER_MAX_WIDTH_80MM = 270;
const PAPER_MAX_WIDTH_58MM = 180;

export const PRESETS_80MM = [
  { label: 'Crest (Circular)', width: 85, height: 85, desc: 'Official SSB Crest (Recommended)' },
  { label: 'Prominent Crest', width: 95, height: 95, desc: 'Large 1:1 circular crest' },
  { label: 'Compact Crest', width: 70, height: 70, desc: 'Small circular logo' },
  { label: 'Standard Banner', width: 140, height: 50, desc: 'Rectangular banner' },
  { label: 'Wide Banner', width: 200, height: 70, desc: 'Edge-to-edge banner' }
];

export const PrintLogoScaleControlPanel: React.FC<PrintLogoScaleControlPanelProps> = ({
  initialWidth = 90,
  initialHeight = 90,
  paperWidth = '80mm',
  onSizeChange,
  onSaveDefault,
  logoDisplay,
  onLogoDisplayChange,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [width, setWidth] = useState<number>(initialWidth);
  const [height, setHeight] = useState<number>(initialHeight);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<number>(initialWidth / (initialHeight || 1));
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const maxPaperWidth = paperWidth === '58mm' ? PAPER_MAX_WIDTH_58MM : PAPER_MAX_WIDTH_80MM;

  // Initialize ratio when initial dimensions arrive
  useEffect(() => {
    if (initialWidth && initialHeight && initialHeight > 0) {
      setWidth(initialWidth);
      setHeight(initialHeight);
      setAspectRatio(initialWidth / initialHeight);
      // Immediately reflect to #pos-print-root
      PrinterService.setPrintRootLogoSize(initialWidth, initialHeight);
    }
  }, [initialWidth, initialHeight]);

  // Apply change to state, callback, #pos-print-root, and localStorage
  const applyDimensions = useCallback((newW: number, newH: number) => {
    const clampedW = Math.max(30, Math.min(maxPaperWidth + 20, Math.round(newW)));
    const clampedH = Math.max(16, Math.min(160, Math.round(newH)));

    setWidth(clampedW);
    setHeight(clampedH);
    onSizeChange(clampedW, clampedH);

    // Update the real-time CSS variables on #pos-print-root
    PrinterService.setPrintRootLogoSize(clampedW, clampedH);

    // Save transient settings to localStorage for instant persistence across re-renders
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('pos_receipt_logo_max_width', String(clampedW));
        localStorage.setItem('pos_receipt_logo_max_height', String(clampedH));
      } catch {
        // Ignore storage errors in restricted iframes
      }
    }
  }, [maxPaperWidth, onSizeChange]);

  const handleWidthChange = (val: number) => {
    if (lockAspectRatio && aspectRatio > 0) {
      const computedH = Math.round(val / aspectRatio);
      applyDimensions(val, computedH);
    } else {
      applyDimensions(val, height);
    }
  };

  const handleHeightChange = (val: number) => {
    if (lockAspectRatio && aspectRatio > 0) {
      const computedW = Math.round(val * aspectRatio);
      applyDimensions(computedW, val);
    } else {
      applyDimensions(width, val);
    }
  };

  const handleToggleLock = () => {
    if (!lockAspectRatio && height > 0) {
      setAspectRatio(width / height);
    }
    setLockAspectRatio(!lockAspectRatio);
  };

  const handlePresetSelect = (presetW: number, presetH: number) => {
    setAspectRatio(presetW / presetH);
    applyDimensions(presetW, presetH);
  };

  const handleReset = () => {
    const defW = 140;
    const defH = 50;
    setAspectRatio(defW / defH);
    applyDimensions(defW, defH);
  };

  const handleSave = async () => {
    if (!onSaveDefault) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveDefault(width, height);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save logo scale default:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate percentage of 80mm paper width occupied by the logo
  const widthPercentage = Math.min(100, Math.round((width / maxPaperWidth) * 100));

  return (
    <div 
      id="pos-logo-scale-control-panel"
      className={`bg-slate-900/90 text-slate-100 rounded-xl border border-slate-700/80 shadow-md transition-all overflow-hidden ${className}`}
    >
      {/* Collapsible Header Bar */}
      <div 
        className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800/80 cursor-pointer select-none hover:bg-slate-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        id="btn-toggle-logo-scaler"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-white">
            Logo Scaling & 80mm Paper Fit
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 font-medium">
            {width} × {height}px
          </span>
          <span className="hidden sm:inline-block text-[10px] text-emerald-400/90 font-medium">
            ({widthPercentage}% of {paperWidth} roll)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 hover:text-slate-200">
            {isExpanded ? 'Hide' : 'Adjust'}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Controls */}
      {isExpanded && (
        <div className="p-3.5 space-y-3.5 text-xs bg-slate-900/95">
          {/* Quick Display Mode Toggle (Header vs Watermark) */}
          {logoDisplay && onLogoDisplayChange && (
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                Logo Placement:
              </span>
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                {(['header', 'watermark', 'both'] as const).map((mode) => (
                  <button
                    key={mode}
                    id={`btn-logo-placement-${mode}`}
                    type="button"
                    onClick={() => onLogoDisplayChange(mode)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors capitalize ${
                      logoDisplay === mode
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'header' ? 'Top Header' : mode === 'watermark' ? 'Watermark' : 'Both'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 80mm Thermal Paper Width Visualizer Bar */}
          <div className="space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">
                80mm Roll Width Coverage:
              </span>
              <span className="font-mono text-emerald-400 font-semibold">
                {width}px / {maxPaperWidth}px ({widthPercentage}%)
              </span>
            </div>
            
            {/* Visualizer Scale Bar */}
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-150"
                style={{ width: `${widthPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 font-mono px-0.5 pt-0.5">
              <span>0mm (Left Edge)</span>
              <span>40mm (Center)</span>
              <span>80mm (Right Edge)</span>
            </div>
          </div>

          {/* Real-time Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Max Width Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="input-logo-max-width" 
                  className="font-medium text-slate-300 flex items-center gap-1.5"
                >
                  <span>Max Width</span>
                  <span className="text-[10px] text-slate-500">(--receipt-logo-max-width)</span>
                </label>
                <span className="font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                  {width}px
                </span>
              </div>
              <input
                id="input-logo-max-width"
                type="range"
                min="40"
                max={maxPaperWidth}
                step="2"
                value={width}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-750 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>40px</span>
                <span>140px (Default)</span>
                <span>{maxPaperWidth}px</span>
              </div>
            </div>

            {/* Max Height Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="input-logo-max-height" 
                  className="font-medium text-slate-300 flex items-center gap-1.5"
                >
                  <span>Max Height</span>
                  <span className="text-[10px] text-slate-500">(--receipt-logo-max-height)</span>
                </label>
                <span className="font-mono text-emerald-400 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                  {height}px
                </span>
              </div>
              <input
                id="input-logo-max-height"
                type="range"
                min="20"
                max="140"
                step="2"
                value={height}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-750 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>20px</span>
                <span>50px (Default)</span>
                <span>140px</span>
              </div>
            </div>
          </div>

          {/* Aspect Ratio Lock Toggle */}
          <div className="flex items-center justify-between pt-1">
            <button
              id="btn-toggle-aspect-ratio"
              type="button"
              onClick={handleToggleLock}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                lockAspectRatio
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/80'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {lockAspectRatio ? (
                <>
                  <Link className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aspect Ratio Locked (Proportional)</span>
                </>
              ) : (
                <>
                  <Unlink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Aspect Ratio Free (Independent)</span>
                </>
              )}
            </button>

            <button
              id="btn-reset-logo-scale"
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] transition-colors"
              title="Reset to 140 × 50px standard"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              <span>Reset</span>
            </button>
          </div>

          {/* One-Click 80mm Fit Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] text-slate-400 font-medium">
              Quick 80mm Presets:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {PRESETS_80MM.map((p) => {
                const isSelected = width === p.width && height === p.height;
                return (
                  <button
                    key={p.label}
                    id={`btn-preset-${p.label.toLowerCase().replace(/\s+/g, '-')}`}
                    type="button"
                    onClick={() => handlePresetSelect(p.width, p.height)}
                    className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 font-semibold shadow-sm'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80 text-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-medium leading-tight">{p.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                      {p.width}×{p.height}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save as Default Action */}
          {onSaveDefault && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-[10px] text-slate-400">
                Changes apply instantly in real-time to preview and #pos-print-root.
              </span>

              <button
                id="btn-save-logo-scale-default"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  saveSuccess
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow active:scale-95 disabled:opacity-50'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Saved Default!</span>
                  </>
                ) : isSaving ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save as Default</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
