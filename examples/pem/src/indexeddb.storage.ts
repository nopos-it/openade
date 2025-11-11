/**
 * IndexedDB Storage Example for PEM
 * For browser-based POS applications
 */

import type { DocumentoCommerciale } from '@openade/common';
import type { IPEMStorage } from '@openade/pem';

export class IndexedDBStorage implements IPEMStorage {
  private dbName = 'nopos-pem';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('journals')) {
          db.createObjectStore('journals', { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  async saveDocument(id: string, document: DocumentoCommerciale): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const request = store.put({ id, document });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDocument(id: string): Promise<DocumentoCommerciale | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result?.document || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listDocuments(): Promise<DocumentoCommerciale[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const request = store.getAll();

      request.onsuccess = () => {
        const docs = request.result.map(
          (item: { document: DocumentoCommerciale }) => item.document
        );
        resolve(docs);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveJournal(date: string, journal: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('journals', 'readwrite');
      const store = tx.objectStore('journals');
      const request = store.put({ date, journal });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getJournal(date: string): Promise<string | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('journals', 'readonly');
      const store = tx.objectStore('journals');
      const request = store.get(date);

      request.onsuccess = () => resolve(request.result?.journal || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(key: string, value: unknown): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('metadata', 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key: string): Promise<unknown> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('metadata', 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents', 'journals', 'metadata'], 'readwrite');

      tx.objectStore('documents').clear();
      tx.objectStore('journals').clear();
      tx.objectStore('metadata').clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/**
 * Usage:
 *
 * const storage = new IndexedDBStorage();
 * await storage.init();
 *
 * const pem = new PEMManager(config, storage);
 */
