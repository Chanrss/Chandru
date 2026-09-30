/**
 * Centralized Receipt Logo Processor Utility
 * 
 * Provides automated analysis, dimension scaling, transparent whitespace trimming,
 * and bulletproof receipt printing CSS for thermal POS printers (80mm & 58mm).
 */

export type LogoShape = 'circular-square' | 'banner' | 'wide-banner' | 'tall';

export interface LogoImageMetrics {
  naturalWidth: number;
  naturalHeight: number;
  aspectRatio: number; // width / height
  shape: LogoShape;
  isSvg: boolean;
  byteSizeApprox: number;
  isFirestoreSafe: boolean;
  hasUnevenPadding?: boolean;
}

export interface LogoDimensionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
  isRecommendedFor: LogoShape[];
}

export const LOGO_PRESETS_80MM: LogoDimensionPreset[] = [
  {
    id: 'crest-standard',
    label: 'Circular Crest (Standard)',
    width: 85,
    height: 85,
    description: 'Perfect 1:1 balance for Sri Saravana Bhavan crest (Recommended)',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'crest-prominent',
    label: 'Prominent Crest',
    width: 95,
    height: 95,
    description: 'Emphasized circular emblem at top of receipt',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'crest-compact',
    label: 'Compact Crest',
    width: 70,
    height: 70,
    description: 'Space-saving circular emblem for high-volume billing',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'banner-standard',
    label: 'Standard Banner',
    width: 140,
    height: 52,
    description: 'Balanced 2.5:1 to 3:1 rectangular header banner',
    isRecommendedFor: ['banner']
  },
  {
    id: 'banner-wide',
    label: 'Wide Banner (Edge-to-Edge)',
    width: 200,
    height: 65,
    description: 'Full-width banner across the printable roll area',
    isRecommendedFor: ['banner', 'wide-banner']
  }
];

export const LOGO_PRESETS_58MM: LogoDimensionPreset[] = [
  {
    id: 'crest-standard-58',
    label: 'Circular Crest (Standard 58mm)',
    width: 70,
    height: 70,
    description: 'Optimized for 58mm / 2-inch thermal rolls',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'crest-prominent-58',
    label: 'Prominent Crest (58mm)',
    width: 80,
    height: 80,
    description: 'Max size for circular logo on 58mm rolls',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'crest-compact-58',
    label: 'Compact Crest (58mm)',
    width: 55,
    height: 55,
    description: 'Minimalist circular crest to minimize paper length',
    isRecommendedFor: ['circular-square']
  },
  {
    id: 'banner-standard-58',
    label: 'Standard Banner (58mm)',
    width: 115,
    height: 44,
    description: 'Proportional rectangular banner for 58mm rolls',
    isRecommendedFor: ['banner']
  },
  {
    id: 'banner-wide-58',
    label: 'Wide Banner (58mm)',
    width: 155,
    height: 52,
    description: 'Full-width banner across 58mm printhead',
    isRecommendedFor: ['banner', 'wide-banner']
  }
];

/**
 * Analyze an image URL or data URL and return its optical and shape metrics
 */
export async function analyzeLogoImage(imageUrl: string): Promise<LogoImageMetrics> {
  const isSvg = imageUrl.includes('image/svg+xml') || imageUrl.toLowerCase().endsWith('.svg');
  const byteSizeApprox = imageUrl.startsWith('data:') 
    ? Math.round((imageUrl.length * 3) / 4)
    : 15 * 1024; // estimate for external URLs

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalWidth = img.naturalWidth || 100;
      const naturalHeight = img.naturalHeight || 100;
      const ratio = naturalWidth / Math.max(1, naturalHeight);

      let shape: LogoShape = 'circular-square';
      if (ratio >= 2.8) {
        shape = 'wide-banner';
      } else if (ratio >= 1.35) {
        shape = 'banner';
      } else if (ratio <= 0.8) {
        shape = 'tall';
      } else {
        shape = 'circular-square';
      }

      resolve({
        naturalWidth,
        naturalHeight,
        aspectRatio: Math.round(ratio * 100) / 100,
        shape,
        isSvg,
        byteSizeApprox,
        isFirestoreSafe: byteSizeApprox < 850 * 1024
      });
    };

    img.onerror = () => {
      resolve({
        naturalWidth: 100,
        naturalHeight: 100,
        aspectRatio: 1.0,
        shape: 'circular-square',
        isSvg,
        byteSizeApprox,
        isFirestoreSafe: true
      });
    };

    img.src = imageUrl;
  });
}

/**
 * Automatically trims transparent or white borders from an image canvas,
 * centering the actual visual mark so it doesn't print off-center.
 */
export async function autoCenterAndTrimLogo(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);

        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Find bounding box of non-transparent / non-pure-white pixels
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let foundContent = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Consider pixel as content if alpha > 15 and not pure white (r > 250, g > 250, b > 250)
            const isWhite = r > 248 && g > 248 && b > 248;
            if (alpha > 15 && !isWhite) {
              foundContent = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!foundContent || maxX <= minX || maxY <= minY) {
          return resolve(imageUrl);
        }

        // Add 4% padding around cropped content for breathing room
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const padX = Math.round(cropW * 0.04);
        const padY = Math.round(cropH * 0.04);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = cropW + padX * 2;
        finalCanvas.height = cropH + padY * 2;
        const fCtx = finalCanvas.getContext('2d');
        if (!fCtx) return resolve(imageUrl);

        fCtx.drawImage(
          canvas,
          Math.max(0, minX),
          Math.max(0, minY),
          cropW,
          cropH,
          padX,
          padY,
          cropW,
          cropH
        );

        resolve(finalCanvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Auto-center trim note:', err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}

/**
 * Convert image to a 1-bit crisp monochrome bitmap for pure B&W thermal printing
 */
export async function generateMonochromeThermalLogo(imageUrl: string, threshold = 140): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxW = 300;
        const maxH = 150;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        if (w > maxW || h > maxH) {
          const scale = Math.min(maxW / w, maxH / h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);

        // Draw background white
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
          const alpha = d[i + 3];
          if (alpha < 60) {
            d[i] = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = 0;
            continue;
          }

          // Luminance calculation
          const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const val = lum < threshold ? 0 : 255;
          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
          d[i + 3] = val === 0 ? 255 : 0; // Transparent for white
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Monochrome conversion note:', err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}

/**
 * Generate standard, bulletproof CSS properties and CSS variables for receipt logos.
 * Uses block-level centering with auto margins to avoid flexbox print driver bugs.
 */
export function generateReceiptLogoPrintStyles(options: {
  maxWidth?: number;
  maxHeight?: number;
  alignment?: 'center' | 'left' | 'right';
  isCompact?: boolean;
  watermarkOpacity?: number;
}) {
  const {
    maxWidth = 85,
    maxHeight = 85,
    alignment = 'center',
    isCompact = false,
    watermarkOpacity = 0.12
  } = options;

  const marginBottom = isCompact ? '2px' : '5px';
  const alignClass = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';
  const marginRule = alignment === 'left' 
    ? 'margin-left: 0 !important; margin-right: auto !important;' 
    : alignment === 'right'
    ? 'margin-left: auto !important; margin-right: 0 !important;'
    : 'margin-left: auto !important; margin-right: auto !important;';

  // CSS variables dictionary
  const cssVariables: Record<string, string> = {
    '--receipt-logo-max-width': `${maxWidth}px`,
    '--receipt-logo-max-height': `${maxHeight}px`,
    '--receipt-logo-margin-bottom': marginBottom,
    '--receipt-watermark-opacity': String(watermarkOpacity)
  };

  // Inline CSS strings for container and img tag
  const containerInlineStyle = `display: block !important; width: 100% !important; text-align: ${alignment} !important; margin: 0 auto ${marginBottom} auto !important; padding: 0 !important; position: relative !important;`;
  const imgInlineStyle = `display: block !important; ${marginRule} max-width: var(--receipt-logo-max-width, ${maxWidth}px) !important; max-height: var(--receipt-logo-max-height, ${maxHeight}px) !important; width: auto !important; height: auto !important; object-fit: contain !important;`;

  return {
    cssVariables,
    containerInlineStyle,
    imgInlineStyle,
    alignClass,
    marginBottom
  };
}
