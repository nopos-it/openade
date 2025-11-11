/**
 * Storage Interface for PEM
 * Abstract interface for storing documents and journals on devices
 * Can be implemented with IndexedDB, SQLite, LocalStorage, etc.
 */

import type { DocumentoCommerciale } from '@openade/common';

export interface IPEMStorage {
  /**
   * Save a document
   */
  saveDocument(id: string, document: DocumentoCommerciale): Promise<void>;

  /**
   * Get a document by ID
   */
  getDocument(id: string): Promise<DocumentoCommerciale | null>;

  /**
   * List all documents
   */
  listDocuments(): Promise<DocumentoCommerciale[]>;

  /**
   * Save journal for a date
   */
  saveJournal(date: string, journal: string): Promise<void>;

  /**
   * Get journal for a date
   */
  getJournal(date: string): Promise<string | null>;

  /**
   * Save metadata (key-value pairs)
   */
  saveMetadata(key: string, value: unknown): Promise<void>;

  /**
   * Get metadata by key
   */
  getMetadata(key: string): Promise<unknown>;

  /**
   * Clear all data
   */
  clear(): Promise<void>;
}
