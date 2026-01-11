
import { HarvestEntry, HarvestSettings } from './types';

const DB_NAME = 'ShrimpHarvestDB';
const DB_VERSION = 12; 
const STORE_NAME = 'harvest_entries';
const SETTINGS_KEY = 'harvest_settings';

export class DBService {
  private static instance: IDBDatabase | null = null;
  private static dbPromise: Promise<IDBDatabase> | null = null;

  static generateId(): string {
    return `id_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  }

  static async isStoragePersisted(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
    return false;
  }

  static async requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`Storage persistence ${isPersisted ? 'granted' : 'denied'}`);
      return isPersisted;
    }
    return false;
  }

  private static async getDB(): Promise<IDBDatabase> {
    if (this.instance) return this.instance;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.instance = (event.target as IDBOpenDBRequest).result;
        this.dbPromise = null;
        
        this.instance.onversionchange = () => {
          this.instance?.close();
          this.instance = null;
          window.location.reload();
        };

        this.instance.onclose = () => {
          this.instance = null;
        };

        resolve(this.instance);
      };

      request.onblocked = () => {
        console.warn("Database opening blocked. Please close other tabs.");
      };

      request.onerror = (event) => {
        this.dbPromise = null;
        console.error("IndexedDB Error:", (event.target as IDBOpenDBRequest).error);
        reject(new Error("Database connection failed"));
      };
    });

    return this.dbPromise;
  }

  static async saveEntry(entry: HarvestEntry): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  static async upsertEntries(entries: HarvestEntry[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      entries.forEach(entry => store.put(entry));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getCount(): Promise<number> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteEntry(id: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  static async deleteEntries(ids: string[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach(id => id && store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllEntries(): Promise<HarvestEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      return [];
    }
  }

  static async markSynced(ids: string[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      ids.forEach(id => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            request.result.synced = true;
            store.put(request.result);
          }
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async nuclearReset(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        this.instance?.close();
        this.instance = null;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  static saveSettings(settings: HarvestSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  static getSettings(): HarvestSettings {
    const data = localStorage.getItem(SETTINGS_KEY);
    // User's specifically provided Web App URL
    const defaultUrl = 'https://script.google.com/macros/s/AKfycbyieNqD1ZFwnSh0ZVn3JkAb5y5epoak2xc3IK1XX6wTtgqoRiytiL-TleBakjEy1gro/exec';
    
    if (data) {
      const parsed = JSON.parse(data);
      // Ensure the URL is updated if it's the old default or empty
      if (!parsed.googleSheetUrl || parsed.googleSheetUrl.includes('docs.google.com')) {
        parsed.googleSheetUrl = defaultUrl;
      }
      return parsed;
    }

    return { 
      activeTank: 'Tank 1', 
      shrimpCount: 50, 
      tankCounts: {}, 
      tankPrices: {},
      crateWeight: 1.8, 
      teamName: 'Team A',
      farmName: 'Main Farm',
      sessionName: 'Session 1',
      googleSheetUrl: defaultUrl
    };
  }
}
