/**
 * Safe LocalStorage abstraction that gracefully handles cross-origin iframes,
 * disabled third-party cookies, and private browsing modes where accessing
 * window.localStorage throws a DOMException / SecurityError.
 */

class MemoryStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const memoryFallback = new MemoryStorage();

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const storageAvailable = isLocalStorageAvailable();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (storageAvailable) {
        return window.localStorage.getItem(key);
      }
      return memoryFallback.getItem(key);
    } catch (e) {
      return memoryFallback.getItem(key);
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (storageAvailable) {
        window.localStorage.setItem(key, value);
        return;
      }
      memoryFallback.setItem(key, value);
    } catch (e) {
      memoryFallback.setItem(key, value);
    }
  },

  removeItem(key: string): void {
    try {
      if (storageAvailable) {
        window.localStorage.removeItem(key);
        return;
      }
      memoryFallback.removeItem(key);
    } catch (e) {
      memoryFallback.removeItem(key);
    }
  },

  clear(): void {
    try {
      if (storageAvailable) {
        window.localStorage.clear();
      }
      memoryFallback.clear();
    } catch (e) {
      memoryFallback.clear();
    }
  }
};
