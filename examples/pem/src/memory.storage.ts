/**
 * In-Memory Storage Implementation for PEM
 * Simple storage for testing/demo purposes
 */

import type { DocumentoCommerciale } from '@nopos-ade/common';
import type { IPEMStorage } from '@nopos-ade/pem';

export class MemoryStorage implements IPEMStorage {
  private documents: Map<string, DocumentoCommerciale> = new Map();
  private journals: Map<string, string> = new Map();
  private metadata: Map<string, any> = new Map();

  async saveDocument(id: string, document: DocumentoCommerciale): Promise<void> {
    this.documents.set(id, document);
  }

  async getDocument(id: string): Promise<DocumentoCommerciale | null> {
    return this.documents.get(id) || null;
  }

  async listDocuments(): Promise<DocumentoCommerciale[]> {
    return Array.from(this.documents.values());
  }

  async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async saveJournal(date: string, journal: string): Promise<void> {
    this.journals.set(date, journal);
  }

  async getJournal(date: string): Promise<string | null> {
    return this.journals.get(date) || null;
  }

  async listJournals(): Promise<string[]> {
    return Array.from(this.journals.keys());
  }

  async deleteJournal(date: string): Promise<void> {
    this.journals.delete(date);
  }

  async saveMetadata(key: string, value: unknown): Promise<void> {
    this.metadata.set(key, value);
  }

  async getMetadata(key: string): Promise<any | null> {
    return this.metadata.get(key) || null;
  }

  async clear(): Promise<void> {
    this.documents.clear();
    this.journals.clear();
    this.metadata.clear();
  }
}
