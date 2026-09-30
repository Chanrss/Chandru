import { ref, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, storage } from './firebase';
import officialLogoPng from '../assets/images/ssb_logo.png';
import { DEFAULT_RESTAURANT_LOGO } from '../data/defaultLogo';

/**
 * BRAND LOGO SERVICE — STRICT LOGO PRESERVATION
 * 
 * Rules:
 * 1. The uploaded logo is a protected brand asset and treated as immutable.
 * 2. Never regenerate, redraw, recreate, redesign, or re-style the logo.
 * 3. Never use AI image generation for the logo.
 * 4. Never modify colors, text, shapes, or aspect ratio.
 * 5. Display size may change proportionally only (width: auto; height: auto; max-width: [w]).
 * 6. If the original asset cannot be loaded, show "Original logo asset is unavailable".
 */

export const OFFICIAL_LOGO_STORAGE_PATH = 'brand/official_ssb_receipt_logo.png';
export const OFFICIAL_LOGO_STORAGE_BUCKET = 'gen-lang-client-0511742281.firebasestorage.app';
export const OFFICIAL_LOGO_PUBLIC_URL = DEFAULT_RESTAURANT_LOGO;
export const OFFICIAL_LOGO_ASSET = officialLogoPng;
export const OFFICIAL_LOGO_STORAGE_URL = `https://firebasestorage.googleapis.com/v0/b/${OFFICIAL_LOGO_STORAGE_BUCKET}/o/${encodeURIComponent(OFFICIAL_LOGO_STORAGE_PATH)}?alt=media`;

export interface BrandLogoConfig {
  logoUrl: string;
  logoStoragePath: string;
  logoStorageUrl: string;
  isImmutable: boolean;
  aspectRatio: number;
}

/**
 * Synchronize official logo metadata to Firebase Firestore database
 */
export async function syncBrandLogoToFirebase(): Promise<{ success: boolean; url: string; path: string }> {
  const payload = {
    logoUrl: OFFICIAL_LOGO_PUBLIC_URL,
    logoStoragePath: OFFICIAL_LOGO_STORAGE_PATH,
    logoStorageUrl: OFFICIAL_LOGO_STORAGE_URL,
    logoProtectedBrandAsset: true,
    logoImmutable: true,
    logoDisplay: 'both',
    receiptLogoMaxWidth: 90,
    receiptLogoMaxHeight: 90,
    receiptAlignment: 'center',
    updatedAt: Date.now()
  };

  try {
    const docRef = doc(db, 'settings', 'restaurant');
    await setDoc(docRef, payload, { merge: true });
    return { success: true, url: OFFICIAL_LOGO_PUBLIC_URL, path: OFFICIAL_LOGO_STORAGE_PATH };
  } catch (err) {
    console.warn('Firebase Firestore settings logo sync note:', err);
    return { success: false, url: OFFICIAL_LOGO_PUBLIC_URL, path: OFFICIAL_LOGO_STORAGE_PATH };
  }
}

/**
 * Retrieves the exact uploaded logo file from Firebase Storage / database.
 * If Firebase Storage is available, resolves its download URL.
 * Falls back safely to the exact unedited uploaded asset (/ssb_logo.png).
 */
export async function getOfficialReceiptLogoUrl(): Promise<string> {
  try {
    // 1. Check if Firebase Storage has the live download URL
    const storageRef = ref(storage, OFFICIAL_LOGO_STORAGE_PATH);
    const downloadUrl = await getDownloadURL(storageRef);
    if (downloadUrl) return downloadUrl;
  } catch {
    // Storage bucket might be restricted or offline, proceed to configuration
  }

  try {
    // 2. Check Firestore configuration
    const docRef = doc(db, 'settings', 'restaurant');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.logoStorageUrl && typeof data.logoStorageUrl === 'string' && data.logoStorageUrl.startsWith('http')) {
        return data.logoStorageUrl;
      }
      if (data.logoUrl && typeof data.logoUrl === 'string' && data.logoUrl.trim().length > 0) {
        return data.logoUrl;
      }
    }
  } catch {
    // Offline Firestore
  }

  // 3. Return exact original uploaded asset
  return OFFICIAL_LOGO_PUBLIC_URL;
}

/**
 * Returns bulletproof CSS properties ensuring proportional scaling and preservation
 * of the original logo dimensions/aspect ratio for thermal receipts.
 */
export function getReceiptLogoStyles(options?: {
  maxWidth?: number;
  maxHeight?: number;
  alignment?: 'center' | 'left' | 'right';
  isCompact?: boolean;
}) {
  const maxWidth = options?.maxWidth || 85;
  const maxHeight = options?.maxHeight || 85;
  const alignment = options?.alignment || 'center';
  const marginBottom = options?.isCompact ? '3px' : '6px';

  return {
    containerStyle: {
      display: 'block' as const,
      width: '100%',
      textAlign: alignment as any,
      margin: `0 auto ${marginBottom} auto`,
      padding: 0,
      position: 'relative' as const
    },
    imgStyle: {
      display: 'block' as const,
      marginLeft: alignment === 'left' ? '0' : 'auto',
      marginRight: alignment === 'right' ? '0' : 'auto',
      maxWidth: `${maxWidth}px`,
      maxHeight: `${maxHeight}px`,
      width: 'auto',
      height: 'auto',
      objectFit: 'contain' as const
    },
    errorStyle: {
      color: '#dc2626',
      fontSize: '11px',
      fontWeight: 700,
      textAlign: 'center' as const,
      border: '1px dashed #dc2626',
      padding: '4px 6px',
      margin: '4px auto',
      backgroundColor: '#fef2f2',
      borderRadius: '4px',
      maxWidth: '220px'
    }
  };
}
