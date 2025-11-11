/**
 * Journal Manager
 * Manages the immutable journal with hash chains
 */

import type { DocumentoCommerciale } from '@openade/common';
import { createHash } from 'crypto';

export interface JournalEntry {
  type: 'AA' | 'DC' | 'CG' | 'CC'; // Apertura, Documento, Cambio Giornata, Chiusura
  timestamp: string;
  data: unknown;
  previousHash: string;
  hash: string;
}

export class JournalManager {
  private entries: JournalEntry[] = [];
  private currentHash: string = '0'.repeat(64); // Initial hash
  private isOpen: boolean = false;

  /**
   * Open cash register
   */
  openCash(): string {
    if (this.isOpen) throw new Error('Cash register already open');

    const entry = {
      type: 'AA' as const,
      timestamp: new Date().toISOString(),
      data: { dataOraApertura: new Date().toISOString() },
      previousHash: this.currentHash,
      hash: '',
    };

    entry.hash = this.calculateHash(entry);
    this.currentHash = entry.hash;
    this.entries.push(entry);
    this.isOpen = true;

    return entry.hash;
  }

  /**
   * Add document to journal
   */
  addDocument(document: DocumentoCommerciale): string {
    if (!this.isOpen) throw new Error('Cash register not open');

    const entry = {
      type: 'DC' as const,
      timestamp: new Date().toISOString(),
      data: document,
      previousHash: this.currentHash,
      hash: '',
    };

    entry.hash = this.calculateHash(entry);
    this.currentHash = entry.hash;
    this.entries.push(entry);

    return entry.hash;
  }

  /**
   * Close cash register
   */
  closeCash(): { hash: string; totalDocuments: number; totalAmount: number } {
    if (!this.isOpen) throw new Error('Cash register not open');

    const documents = this.entries.filter((e) => e.type === 'DC');
    const totalAmount = documents.reduce((sum, e) => {
      const data = e.data as { importoTotale?: number };
      return sum + (data?.importoTotale || 0);
    }, 0);

    const entry = {
      type: 'CC' as const,
      timestamp: new Date().toISOString(),
      data: {
        dataOraChiusura: new Date().toISOString(),
        totaleNumeroDCProdottiJournal: documents.length,
        importoTotaleGiornaliero: totalAmount,
      },
      previousHash: this.currentHash,
      hash: '',
    };

    entry.hash = this.calculateHash(entry);
    this.currentHash = entry.hash;
    this.entries.push(entry);
    this.isOpen = false;

    return {
      hash: entry.hash,
      totalDocuments: documents.length,
      totalAmount,
    };
  }

  /**
   * Get all entries
   */
  getEntries(): JournalEntry[] {
    return [...this.entries];
  }

  /**
   * Verify journal integrity
   */
  verify(): boolean {
    let previousHash = '0'.repeat(64);

    for (const entry of this.entries) {
      if (entry.previousHash !== previousHash) return false;

      const calculatedHash = this.calculateHash({
        ...entry,
        hash: '', // Exclude current hash from calculation
      });

      if (calculatedHash !== entry.hash) return false;
      previousHash = entry.hash;
    }

    return true;
  }

  /**
   * Calculate hash for entry
   */
  private calculateHash(entry: Omit<JournalEntry, 'hash'> & { hash?: string }): string {
    const data = JSON.stringify({
      type: entry.type,
      timestamp: entry.timestamp,
      data: entry.data,
      previousHash: entry.previousHash,
    });

    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Export journal
   */
  exportJournal(): string {
    return JSON.stringify(
      {
        entries: this.entries,
        currentHash: this.currentHash,
        verified: this.verify(),
      },
      null,
      2
    );
  }
}
