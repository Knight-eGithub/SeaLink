import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage Service with fallback support for unit tests and local persistence.
 */
class StorageService {
  private inMemoryStore: Map<string, string> = new Map();
  private isAsyncStorageAvailable: boolean = true;

  constructor() {
    if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
      this.isAsyncStorageAvailable = false;
    }
  }

  async getItem<T>(key: string, defaultValue: T): Promise<T> {
    try {
      if (this.isAsyncStorageAvailable) {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          return JSON.parse(value) as T;
        }
      }
    } catch {
      // Fallback to in-memory on storage failure
    }

    const memVal = this.inMemoryStore.get(key);
    if (memVal !== undefined) {
      try {
        return JSON.parse(memVal) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    this.inMemoryStore.set(key, serialized);

    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.setItem(key, serialized);
      }
    } catch (err) {
      console.warn(`[StorageService] Failed to persist key ${key}:`, err);
    }
  }

  async removeItem(key: string): Promise<void> {
    this.inMemoryStore.delete(key);
    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    this.inMemoryStore.clear();
    try {
      if (this.isAsyncStorageAvailable) {
        await AsyncStorage.clear();
      }
    } catch {
      // Ignore
    }
  }
}

export const storageService = new StorageService();
