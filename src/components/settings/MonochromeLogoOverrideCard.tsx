import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Upload, 
  Trash2, 
  CheckCircle, 
  Sliders, 
  FileText,
  HelpCircle,
  Eye
} from 'lucide-react';

interface MonochromeLogoOverrideCardProps {
  primaryLogoUrl?: string;
  monochromeLogoUrl?: string;
  onSaveMonochromeLogo: (url: string) => Promise<void>;
  onClearMonochromeLogo: () => Promise<void>;
}

export const MonochromeLogoOverrideCard: React.FC<MonochromeLogoOverrideCardProps> = ({
  primaryLogoUrl,
  monochromeLogoUrl,
  onSaveMonochromeLogo,
  onClearMonochromeLogo
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [threshold, setThreshold] = useState(135);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasOverride = Boolean(monochromeLogoUrl && monochromeLogoUrl.trim().length > 0);

  /**
   * Convert an image file to a pure 1-bit high-contrast black-and-white bitmap
   */
  const processImageToMonochrome = (file: File, threshValue: number) => {
    setIsProcessing(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 320;
          let targetW = img.width;
          let targetH = img.height;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas 2D context unavailable');

          // White background for thermal paper simulation
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          // Get image pixel data and convert to pure 1-bit monochrome
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // If translucent or light, mark as pure white; otherwise evaluate luminance
            if (a < 50) {
              data[i] = 255;
              data[i + 1] = 255;
              data[i + 2] = 255;
              data[i + 3] = 255;
            } else {
              const lum = 0.299 * r + 0.587 * g + 0.114 * b;
              const val = lum < threshValue ? 0 : 255;
              data[i] = val;
              data[i + 1] = val;
              data[i + 2] = val;
              data[i + 3] = 255;
            }
          }

          ctx.putImageData(imgData, 0, 0);
          const bwDataUrl = canvas.toDataURL('image/png');
          onSaveMonochromeLogo(bwDataUrl);
        } catch (err: any) {
          setErrorMsg(err?.message || 'Error processing monochrome image');
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setErrorMsg('Invalid image file format.');
        setIsProcessing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Convert current primary logo into a 1-bit monochrome thermal override
   */
  const convertPrimaryToMonochrome = () => {
    if (!primaryLogoUrl) return;
    setIsProcessing(true);
    setErrorMsg(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxDim = 320;
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDim || targetH > maxDim) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const imgData = ctx.getImageData(0, 0, targetW, targetH);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 50) {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 255;
          } else {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const val = lum < threshold ? 0 : 255;
            data[i] = val;
            data[i + 1] = val;
            data[i + 2] = val;
            data[i + 3] = 255;
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const bwDataUrl = canvas.toDataURL('image/png');
        onSaveMonochromeLogo(bwDataUrl);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Could not auto-convert primary logo');
      } finally {
        setIsProcessing(false);
      }
    };
    img.onerror = () => {
      setErrorMsg('Failed to load primary logo for conversion. Try uploading a file directly.');
      setIsProcessing(false);
    };
    img.src = primaryLogoUrl;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageToMonochrome(file, threshold);
    }
  };

  const handleApplyManual = () => {
    if (!manualInput.trim()) return;
    onSaveMonochromeLogo(manualInput.trim());
    setManualInput('');
    setShowManualInput(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-xl p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-100 uppercase tracking-wide">
                Specialized Monochrome Logo Override
              </span>
              {hasOverride ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" /> ACTIVE IN THERMAL PRINT CSS
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  OPTIONAL • NOT SET
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Provides a direct 1-bit black &amp; white asset. When set, thermal receipts bypass CSS grayscale filtering and render pure crisp black pixels.
            </p>
          </div>
        </div>

        {hasOverride && (
          <button
            type="button"
            onClick={onClearMonochromeLogo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors font-medium cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove Override
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-2 text-xs">
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Visual Preview & Controls */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Left: Thermal Printer Output Preview */}
        <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 mb-2">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                Receipt Header Thermal Preview
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {hasOverride ? '1-Bit Crisp B&W' : 'Standard CSS Grayscale'}
              </span>
            </div>

            <div className="bg-white rounded p-4 text-center flex flex-col items-center justify-center min-h-[110px] border border-slate-200">
              {hasOverride ? (
                <div>
                  <img
                    src={monochromeLogoUrl}
                    alt="Monochrome Thermal Logo"
                    className="max-h-12 max-w-[150px] object-contain mx-auto"
                    style={{
                      imageRendering: 'pixelated',
                      filter: 'none'
                    }}
                  />
                  <div className="mt-2 text-[9px] font-mono text-emerald-800 font-bold tracking-wider">
                    [OVERRIDE APPLIED: 1-BIT MONOCHROME]
                  </div>
                </div>
              ) : primaryLogoUrl ? (
                <div>
                  <img
                    src={primaryLogoUrl}
                    alt="Standard Receipt Logo"
                    className="max-h-12 max-w-[150px] object-contain mx-auto"
                    style={{
                      filter: 'grayscale(100%) contrast(140%)'
                    }}
                  />
                  <div className="mt-2 text-[9px] font-mono text-slate-500">
                    [FALLBACK: STANDARD LOGO + CSS GRAYSCALE]
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-xs italic">No logo configured</div>
              )}
            </div>
          </div>

          <div className="mt-3 text-[10.5px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
            <span className="font-semibold text-slate-300">CSS Rule Applied: </span>
            {hasOverride ? (
              <code className="text-amber-300 font-mono text-[10px]">
                .receipt-logo.monochrome-override &#123; filter: none; image-rendering: pixelated; &#125;
              </code>
            ) : (
              <code className="text-slate-400 font-mono text-[10px]">
                .receipt-logo &#123; filter: grayscale(100%) contrast(140%); &#125;
              </code>
            )}
          </div>
        </div>

        {/* Right: Actions & Upload */}
        <div className="bg-slate-950 rounded-lg p-3.5 border border-slate-800 flex flex-col justify-between space-y-3">
          <div>
            <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Provide Specialized Black-and-White Asset
            </div>

            <div className="space-y-2">
              {/* Action 1: Upload Dedicated B&W Image */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors font-semibold cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                {isProcessing ? 'Processing Image...' : 'Upload Specialized B&W Logo (PNG / SVG)'}
              </button>

              {/* Action 2: Convert Primary Logo with Threshold Slider */}
              {primaryLogoUrl && (
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>B&amp;W Contrast Threshold:</span>
                    <span className="font-mono text-amber-400 font-bold">{threshold}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="64"
                      max="220"
                      value={threshold}
                      onChange={(e) => setThreshold(Number(e.target.value))}
                      className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={convertPrimaryToMonochrome}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      Convert Primary to 1-Bit
                    </button>
                  </div>
                </div>
              )}

              {/* Action 3: Manual Base64 / SVG Paste */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  {showManualInput ? 'Hide Base64 input' : 'Paste Base64 or Data URI directly'}
                </button>

                {showManualInput && (
                  <div className="mt-2 flex gap-1.5">
                    <input
                      type="text"
                      placeholder="data:image/png;base64,..."
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-[10px] focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleApplyManual}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px]"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-800/60">
            <HelpCircle className="w-3 h-3 shrink-0 text-slate-400" />
            <span>Direct thermal printers do not have ink; 1-bit logos print with zero dithering artifacts.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
