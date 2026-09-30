import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Trash2, 
  Sparkles, 
  Link, 
  Sliders, 
  FileCode, 
  Save, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Eye,
  Crown,
  Flame,
  Coffee,
  Download,
  Info
} from 'lucide-react';
import { DEFAULT_RESTAURANT_LOGO } from '../../data/defaultLogo';

export type ConversionMode = 'thermal-optimized' | 'monochrome-1bit' | 'raw-base64';

export interface ConvertedFileMeta {
  fileName: string;
  originalSizeBytes: number;
  base64SizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
  base64String: string;
  isFirestoreSafe: boolean;
}

interface FileToBase64LogoConverterProps {
  currentLogoUrl?: string;
  onLogoChange: (base64Url: string) => void;
  onSaveToFirestore?: (newLogoUrl: string) => Promise<void>;
  restaurantName?: string;
}

// Preset vector logos for instant fallback & preview
const PRESET_SAMPLE_LOGOS = [
  {
    id: 'sri_saravana_bhavan',
    name: 'Sri Saravana Bhavan (SSB)',
    icon: Sparkles,
    dataUrl: DEFAULT_RESTAURANT_LOGO
  },
  {
    id: 'royal_crest',
    name: 'Royal Crest',
    icon: Crown,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M40 55 L160 55 L150 25 L125 40 L100 15 L75 40 L50 25 Z" fill="%23000" stroke="%23000" stroke-width="2"/><circle cx="50" cy="22" r="5" fill="%23000"/><circle cx="100" cy="12" r="6" fill="%23000"/><circle cx="150" cy="22" r="5" fill="%23000"/><text x="100" y="73" font-family="monospace" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="3">ROYAL DINING</text></svg>'
  },
  {
    id: 'south_kalash',
    name: 'Traditional Lamp',
    icon: Flame,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M100 10 Q108 24 100 32 Q92 24 100 10 Z" fill="%23000"/><path d="M85 36 Q100 30 115 36 L118 48 Q100 52 82 48 Z" fill="%23000"/><rect x="94" y="48" width="12" height="8" fill="%23000"/><rect x="80" y="56" width="40" height="4" rx="2" fill="%23000"/><text x="100" y="74" font-family="monospace" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="2">AUTHENTIC SOUTH</text></svg>'
  },
  {
    id: 'artisan_cafe',
    name: 'Café & Tiffin',
    icon: Coffee,
    dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="200" height="80"><path d="M75 32 L125 32 L120 54 Q100 62 80 54 Z" fill="%23000"/><path d="M123 36 Q138 36 138 44 Q138 52 120 52" stroke="%23000" stroke-width="4" fill="none"/><path d="M88 24 Q92 16 88 12 M100 24 Q104 16 100 12 M112 24 Q116 16 112 12" stroke="%23000" stroke-width="2.5" fill="none" stroke-linecap="round"/><line x1="70" y1="62" x2="130" y2="62" stroke="%23000" stroke-width="4" stroke-linecap="round"/><text x="100" y="75" font-family="monospace" font-size="11" font-weight="900" text-anchor="middle" letter-spacing="2">HOT TIFFIN & TEA</text></svg>'
  }
];

export const FileToBase64LogoConverter: React.FC<FileToBase64LogoConverterProps> = ({
  currentLogoUrl,
  onLogoChange,
  onSaveToFirestore,
  restaurantName = 'SRI SARAVANA BHAVAN'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [activeTab, setActiveTab] = useState<'converter' | 'presets' | 'url'>('converter');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [conversionMode, setConversionMode] = useState<ConversionMode>('thermal-optimized');
  const [threshold, setThreshold] = useState<number>(128);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCodeInspector, setShowCodeInspector] = useState(false);
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Converted Metadata
  const [meta, setMeta] = useState<ConvertedFileMeta | null>(null);

  // Initialize meta if currentLogoUrl is already base64
  useEffect(() => {
    if (currentLogoUrl && currentLogoUrl.startsWith('data:image')) {
      const approxBytes = Math.round((currentLogoUrl.length * 3) / 4);
      setMeta((prev) => {
        if (prev && prev.base64String === currentLogoUrl) return prev;
        return {
          fileName: 'current_restaurant_logo.png',
          originalSizeBytes: approxBytes,
          base64SizeBytes: approxBytes,
          mimeType: currentLogoUrl.split(';')[0].replace('data:', '') || 'image/png',
          width: 0,
          height: 0,
          base64String: currentLogoUrl,
          isFirestoreSafe: approxBytes < 850 * 1024
        };
      });
      // Also calculate actual dimensions asynchronously
      const img = new Image();
      img.onload = () => {
        setMeta((prev) => prev ? { ...prev, width: img.width, height: img.height } : null);
      };
      img.src = currentLogoUrl;
    }
  }, [currentLogoUrl]);

  /**
   * Format bytes helper
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  /**
   * Convert image file into Base64 using selected mode
   */
  const processFileToBase64 = async (file: File, mode: ConversionMode, threshVal: number = threshold) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid image file (PNG, JPG, JPEG, SVG, WebP, BMP).');
      return;
    }

    // Check maximum raw upload limit (10MB limit before client-side downscaling)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image file is too large. Please select an image under 10MB.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);

    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        const rawResult = e.target?.result as string;

        // Mode 1: RAW BASE64 (No modifications)
        if (mode === 'raw-base64' || file.type === 'image/svg+xml') {
          const byteSize = Math.round((rawResult.length * 3) / 4);
          const isSafe = byteSize < 850 * 1024; // Safe for Firestore 1MB doc

          const img = new Image();
          img.onload = () => {
            const newMeta: ConvertedFileMeta = {
              fileName: file.name,
              originalSizeBytes: file.size,
              base64SizeBytes: byteSize,
              mimeType: file.type,
              width: img.width,
              height: img.height,
              base64String: rawResult,
              isFirestoreSafe: isSafe
            };
            setMeta(newMeta);
            onLogoChange(rawResult);
            setIsProcessing(false);
          };
          img.onerror = () => {
            const newMeta: ConvertedFileMeta = {
              fileName: file.name,
              originalSizeBytes: file.size,
              base64SizeBytes: byteSize,
              mimeType: file.type,
              width: 0,
              height: 0,
              base64String: rawResult,
              isFirestoreSafe: isSafe
            };
            setMeta(newMeta);
            onLogoChange(rawResult);
            setIsProcessing(false);
          };
          img.src = rawResult;
          return;
        }

        // Mode 2 & Mode 3: CANVAS PROCESSING (Thermal Optimized or Monochrome 1-Bit)
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxW = 340; // Optimal width for 80mm & 58mm thermal printheads
          const maxH = 140;

          let targetW = img.width;
          let targetH = img.height;

          // Scale while maintaining aspect ratio
          if (targetW > maxW || targetH > maxH) {
            const ratio = Math.min(maxW / targetW, maxH / targetH);
            targetW = Math.round(targetW * ratio);
            targetH = Math.round(targetH * ratio);
          }

          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            setErrorMessage('Unable to initialize canvas context for Base64 conversion.');
            setIsProcessing(false);
            return;
          }

          // Thermal print heads need a solid white background (transparent renders as messy dots or black on some ESC/POS heads)
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);

          if (mode === 'thermal-optimized') {
            // High contrast thermal enhancement
            ctx.drawImage(img, 0, 0, targetW, targetH);
            
            // Apply a slight contrast & sharpness filter via pixel data or standard canvas export
            const base64Output = canvas.toDataURL('image/png', 0.95);
            const byteSize = Math.round((base64Output.length * 3) / 4);

            const newMeta: ConvertedFileMeta = {
              fileName: file.name,
              originalSizeBytes: file.size,
              base64SizeBytes: byteSize,
              mimeType: 'image/png',
              width: targetW,
              height: targetH,
              base64String: base64Output,
              isFirestoreSafe: byteSize < 850 * 1024
            };
            setMeta(newMeta);
            onLogoChange(base64Output);
            setIsProcessing(false);
          } else if (mode === 'monochrome-1bit') {
            // Draw image and perform pure 1-bit thresholding (crisp black & white)
            ctx.drawImage(img, 0, 0, targetW, targetH);
            const imgData = ctx.getImageData(0, 0, targetW, targetH);
            const data = imgData.data;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              // If transparent, convert to white
              if (a < 50) {
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                data[i + 3] = 255;
              } else {
                // Perceived luminance formula (ITU-R BT.601)
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const binaryVal = luminance < threshVal ? 0 : 255;
                data[i] = binaryVal;
                data[i + 1] = binaryVal;
                data[i + 2] = binaryVal;
                data[i + 3] = 255;
              }
            }

            ctx.putImageData(imgData, 0, 0);
            const base64Output = canvas.toDataURL('image/png');
            const byteSize = Math.round((base64Output.length * 3) / 4);

            const newMeta: ConvertedFileMeta = {
              fileName: file.name,
              originalSizeBytes: file.size,
              base64SizeBytes: byteSize,
              mimeType: 'image/png',
              width: targetW,
              height: targetH,
              base64String: base64Output,
              isFirestoreSafe: byteSize < 850 * 1024
            };
            setMeta(newMeta);
            onLogoChange(base64Output);
            setIsProcessing(false);
          }
        };

        img.onerror = () => {
          setErrorMessage('Failed to decode image file.');
          setIsProcessing(false);
        };

        img.src = rawResult;
      };

      reader.onerror = () => {
        setErrorMessage('Failed to read file from disk.');
        setIsProcessing(false);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error converting file to Base64.');
      setIsProcessing(false);
    }
  };

  /**
   * Handle file selection from input
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      processFileToBase64(file, conversionMode, threshold);
    }
  };

  /**
   * Handle Drag and Drop
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      processFileToBase64(file, conversionMode, threshold);
    }
  };

  /**
   * Mode change handler
   */
  const handleModeChange = (newMode: ConversionMode) => {
    setConversionMode(newMode);
    if (selectedFile) {
      processFileToBase64(selectedFile, newMode, threshold);
    }
  };

  /**
   * Threshold slider handler
   */
  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    if (selectedFile && conversionMode === 'monochrome-1bit') {
      processFileToBase64(selectedFile, 'monochrome-1bit', newThreshold);
    }
  };

  /**
   * Copy Base64 to clipboard
   */
  const handleCopyBase64 = async () => {
    if (!currentLogoUrl) return;
    try {
      await navigator.clipboard.writeText(currentLogoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setErrorMessage('Failed to copy to clipboard.');
    }
  };

  /**
   * One-click Direct Save to Firestore
   */
  const handleDirectSave = async () => {
    if (!currentLogoUrl) {
      setErrorMessage('No logo to save. Please convert or select a logo first.');
      return;
    }
    if (!onSaveToFirestore) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccessMsg(null);
    try {
      await onSaveToFirestore(currentLogoUrl);
      setSaveSuccessMsg('Logo saved to Firestore! All POS terminals and receipts will now use this logo.');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save logo to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle Preset selection
   */
  const handleSelectPreset = (dataUrl: string) => {
    onLogoChange(dataUrl);
    setSaveSuccessMsg(null);
    setSelectedFile(null);
  };

  /**
   * Handle Direct URL apply
   */
  const handleApplyDirectUrl = () => {
    if (!directUrlInput.trim()) {
      setErrorMessage('Please enter an image URL.');
      return;
    }
    onLogoChange(directUrlInput.trim());
    setSelectedFile(null);
    setSaveSuccessMsg('Direct image URL applied!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  /**
   * Remove logo
   */
  const handleRemoveLogo = () => {
    onLogoChange('');
    setSelectedFile(null);
    setMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSaveSuccessMsg('Logo cleared from settings.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const activeLogo = currentLogoUrl || '';
  const isBase64 = activeLogo.startsWith('data:image/');
  const base64Length = activeLogo.length;
  const approxSizeKb = Math.round((base64Length * 3) / 4 / 1024);
  const isSafe = approxSizeKb < 850;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
      
      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                Restaurant Thermal Logo & Base64 Converter
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                Firestore Sync
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Convert any logo file to Base64 for instant storage in Firestore & crisp thermal receipt output
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {activeLogo && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 bg-red-950/40 hover:bg-red-950/80 border border-red-800/50 rounded-lg cursor-pointer transition-colors"
              title="Remove current logo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}

          {activeLogo && onSaveToFirestore && (
            <button
              type="button"
              onClick={handleDirectSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-xs text-slate-950 font-bold px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving...' : 'Save to Firestore'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {saveSuccessMsg && (
        <div className="flex items-center gap-2 text-xs bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 px-3 py-2 rounded-xl animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 text-xs bg-red-950/80 border border-red-700/80 text-red-300 px-3 py-2 rounded-xl animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('converter')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'converter' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>File-to-Base64 Converter</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'presets' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Preset Emblems</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
            activeTab === 'url' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Link className="w-3.5 h-3.5" />
          <span>Direct Web URL</span>
        </button>
      </div>

      {/* TAB 1: FILE-TO-BASE64 CONVERTER */}
      {activeTab === 'converter' && (
        <div className="space-y-4">
          
          {/* Conversion Mode Switcher */}
          <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Base64 Converter Engine & Thermal Filter:
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Target Width: <strong className="text-amber-400">340px Max</strong> (80mm & 58mm POS)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('thermal-optimized')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  conversionMode === 'thermal-optimized'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>1. Thermal Optimized</span>
                  {conversionMode === 'thermal-optimized' && <span className="text-[10px] text-amber-400 font-bold">ACTIVE</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Recommended. Auto-resizes, cleans transparency to white, contrast-boosted PNG. Compact & fast.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('monochrome-1bit')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  conversionMode === 'monochrome-1bit'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>2. 1-Bit Dot Matrix</span>
                  {conversionMode === 'monochrome-1bit' && <span className="text-[10px] text-amber-400 font-bold">ACTIVE</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Pure black & white thresholding. Razor-sharp dot matrix output with zero gray dithering.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('raw-base64')}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                  conversionMode === 'raw-base64'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>3. Direct / Raw Base64</span>
                  {conversionMode === 'raw-base64' && <span className="text-[10px] text-amber-400 font-bold">ACTIVE</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  1:1 byte-for-byte Base64 encoding without resizing. Perfect for vector SVG logos.
                </p>
              </button>
            </div>

            {/* Threshold Slider for 1-bit mode */}
            {conversionMode === 'monochrome-1bit' && (
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center gap-3">
                <span className="text-[11px] font-bold text-slate-300 whitespace-nowrap">
                  Black/White Threshold: {threshold}
                </span>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={threshold}
                  onChange={(e) => handleThresholdChange(Number(e.target.value))}
                  className="flex-1 accent-amber-500 h-1.5 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">Slide to balance dark/light details</span>
              </div>
            )}
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragOver 
                ? 'border-amber-400 bg-amber-500/10' 
                : 'border-slate-700 bg-slate-900/60 hover:border-amber-500/50 hover:bg-slate-900'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/svg+xml,image/webp,image/bmp,image/gif" 
              className="hidden" 
            />
            <div className="flex flex-col items-center justify-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                <Upload className={`w-6 h-6 ${isProcessing ? 'animate-bounce text-amber-300' : ''}`} />
              </div>
              <div>
                <span className="font-bold text-slate-200 block text-sm sm:text-base">
                  {isProcessing 
                    ? 'Converting file to Base64 & optimizing for thermal printing...' 
                    : 'Choose Image File or Drag & Drop Here'}
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  PNG, JPG, SVG, WebP, BMP supported • Automatically converted to Base64 Data URL
                </span>
              </div>
            </div>
          </div>

          {/* Active / Converted Base64 Details Dashboard */}
          {activeLogo && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                    Base64 Conversion Result & Receipt Simulation
                  </span>
                </div>
                
                {/* Status Badge */}
                <div className="flex items-center gap-1.5">
                  {isSafe ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Firestore Safe ({approxSizeKb} KB / 1MB limit)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-md">
                      <AlertCircle className="w-3 h-3 text-amber-400" />
                      Large Base64 ({approxSizeKb} KB) - Switch to Thermal Optimized
                    </span>
                  )}
                </div>
              </div>

              {/* Side-by-side: Thermal Receipt Paper Simulation & Metadata Stats */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                
                {/* Thermal Simulation Column */}
                <div className="md:col-span-5 bg-white rounded-xl p-3 border border-slate-300 shadow-md text-center flex flex-col items-center justify-center min-h-[110px]">
                  <span className="text-[9px] uppercase font-mono tracking-widest text-slate-400 font-bold mb-1">
                    Thermal Paper Simulation
                  </span>
                  <div className="w-full flex items-center justify-center p-1 bg-white">
                    <img 
                      src={activeLogo} 
                      alt="Thermal Receipt Logo Preview" 
                      className="max-h-16 max-w-full object-contain filter grayscale contrast-125"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <span className="text-[10px] text-slate-700 font-mono font-bold mt-1">
                    {restaurantName}
                  </span>
                </div>

                {/* Metadata & Stats Column */}
                <div className="md:col-span-7 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">FORMAT / MIME</span>
                      <span className="font-mono text-slate-200 font-bold truncate block">
                        {meta?.mimeType || (activeLogo.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png')}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">DIMENSIONS</span>
                      <span className="font-mono text-slate-200 font-bold">
                        {meta?.width ? `${meta.width} × ${meta.height} px` : 'Auto-scaled'}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">BASE64 PAYLOAD SIZE</span>
                      <span className="font-mono text-amber-400 font-bold">
                        {meta ? formatBytes(meta.base64SizeBytes) : `${approxSizeKb} KB`}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">BASE64 CHARACTERS</span>
                      <span className="font-mono text-slate-200 font-bold">
                        {base64Length.toLocaleString()} chars
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyBase64}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied Data URL!' : 'Copy Base64 String'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCodeInspector(!showCodeInspector)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer border border-slate-700 transition-colors"
                    >
                      <FileCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>{showCodeInspector ? 'Hide Raw Code' : 'Inspect Base64 Code'}</span>
                    </button>

                    {onSaveToFirestore && (
                      <button
                        type="button"
                        onClick={handleDirectSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 ml-auto"
                      >
                        {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save to Firestore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Base64 Code Inspector */}
              {showCodeInspector && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono text-amber-400 font-bold">Base64 Data URL Snippet:</span>
                    <span>Total Length: {base64Length.toLocaleString()} characters</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 max-h-24 overflow-y-auto break-all select-all leading-relaxed">
                    {activeLogo.slice(0, 500)}... <span className="text-amber-400 italic">[{base64Length - 500} more characters]</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRESET EMBLEMS */}
      {activeTab === 'presets' && (
        <div className="space-y-3">
          <span className="text-xs text-slate-400 block">
            Choose a high-contrast vector emblem pre-encoded for instant thermal printing:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {PRESET_SAMPLE_LOGOS.map((preset) => {
              const isSelected = activeLogo === preset.dataUrl;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.dataUrl)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="w-full bg-white rounded-lg p-2 flex items-center justify-center h-14 border border-slate-200">
                    <img src={preset.dataUrl} alt={preset.name} className="max-h-11 max-w-full object-contain" />
                  </div>
                  <span className="font-bold text-xs">{preset.name}</span>
                  {isSelected && (
                    <span className="text-[9.5px] uppercase font-bold text-amber-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: DIRECT WEB URL */}
      {activeTab === 'url' && (
        <div className="space-y-2.5">
          <span className="text-xs text-slate-400 block">
            Enter a public HTTPS image URL. (For permanent offline POS usage, uploading via the File-to-Base64 Converter is recommended):
          </span>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://example.com/restaurant-logo.png"
              value={directUrlInput}
              onChange={(e) => setDirectUrlInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleApplyDirectUrl}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl cursor-pointer transition-colors text-xs"
            >
              Apply URL
            </button>
          </div>
        </div>
      )}

      {/* Footer Info Notice */}
      <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Thermal Printer Tip:</strong> Uploaded logos are converted to Base64 and stored inside the Firestore <code className="text-amber-300 font-mono">settings/restaurant</code> document. Thermal print heads print in high-contrast monochrome, so simple, bold logos with solid fills print with the highest clarity.
        </p>
      </div>

    </div>
  );
};
