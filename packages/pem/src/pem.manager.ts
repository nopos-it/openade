/**
 * PEM Manager
 * Main class for managing a Punto di Emissione (Emission Point)
 */

import type { DocumentoCommerciale, EmissionPointType } from '@openade/common';
import { DocumentBuilder, type DocumentLine } from './document.builder';
import { JournalManager } from './journal.manager';
import { PELClient } from './pel.client';
import type { IPEMStorage } from './storage.interface';

export interface PEMConfig {
  deviceType: EmissionPointType;
  serialNumber: string;
  vatNumber: string;
  businessName: string;
  pelUrl?: string; // Optional: PEL server URL for real-time transmission
}

export class PEMManager {
  private config: PEMConfig;
  private documentBuilder: DocumentBuilder;
  private journal: JournalManager;
  private storage: IPEMStorage;
  private pelClient?: PELClient;
  private documentCounter: number = 0;
  private isSessionOpen: boolean = false;
  private unsyncedDocuments: DocumentoCommerciale[] = [];

  constructor(config: PEMConfig, storage: IPEMStorage) {
    this.config = config;
    this.documentBuilder = new DocumentBuilder({
      vatNumber: config.vatNumber,
      businessName: config.businessName,
      pemId: config.serialNumber,
    });
    this.journal = new JournalManager();
    this.storage = storage;

    // Initialize PEL client if URL provided
    if (config.pelUrl) {
      this.pelClient = new PELClient({ pelBaseUrl: config.pelUrl });
    }
  }

  /**
   * Open sales session
   * Requests seed from PEL if connected
   */
  async openSession(): Promise<void> {
    if (this.isSessionOpen) throw new Error('Session already open');

    // Get seed from PEL if connected
    if (this.pelClient) {
      try {
        const { seed } = await this.pelClient.getSessionSeed();
        console.log(`Received session seed from PEL: ${seed.substring(0, 8)}...`);
      } catch (error) {
        console.warn('Failed to get seed from PEL, continuing offline:', error);
      }
    }

    this.journal.openCash();
    this.isSessionOpen = true;
    this.documentCounter = 0;
    this.unsyncedDocuments = [];

    console.log(`✅ PEM Session Opened (${this.config.serialNumber})`);
  }

  /**
   * Create and emit a receipt
   * Transmits to PEL in real-time if connected
   */
  async emitReceipt(
    lines: DocumentLine[]
  ): Promise<{ document: DocumentoCommerciale; hash: string; synced: boolean }> {
    if (!this.isSessionOpen) throw new Error('Session not open');

    // Generate document number
    this.documentCounter++;
    const documentNumber = this.documentCounter.toString().padStart(6, '0');

    // Build document
    const document = this.documentBuilder.build(lines, documentNumber);

    // Add to journal
    const hash = this.journal.addDocument(document);

    // Store locally
    await this.storage.saveDocument(documentNumber, document);

    // Transmit to PEL in real-time
    let synced = false;
    if (this.pelClient) {
      try {
        const result = await this.pelClient.sendDocument(document);
        if (result.success) {
          synced = true;
          console.log(
            `📄 Receipt emitted: ${documentNumber} (${document.importoTotale}€) ✓ Synced`
          );
        } else {
          console.warn(`📄 Receipt emitted: ${documentNumber} - Sync failed: ${result.error}`);
          this.unsyncedDocuments.push(document);
        }
      } catch (error) {
        console.warn('Failed to send document to PEL:', error);
        this.unsyncedDocuments.push(document);
      }
    } else {
      console.log(`📄 Receipt emitted: ${documentNumber} (${document.importoTotale}€) [Offline]`);
    }

    return { document, hash, synced };
  }

  /**
   * Close sales session
   * Transmits journal to PEL
   */
  async closeSession(): Promise<{
    totalDocuments: number;
    totalAmount: number;
    journalSynced: boolean;
    unsyncedDocuments: number;
  }> {
    if (!this.isSessionOpen) throw new Error('Session not open');

    // Close journal
    const result = this.journal.closeCash();

    // Save journal to storage
    const date = new Date().toISOString().split('T')[0];
    const journalData = this.journal.exportJournal();
    await this.storage.saveJournal(date, journalData);

    // Transmit journal to PEL
    let journalSynced = false;
    if (this.pelClient) {
      try {
        // Retry sending unsynced documents first
        if (this.unsyncedDocuments.length > 0) {
          console.log(`⚠️  Retrying ${this.unsyncedDocuments.length} unsynced documents...`);
          for (const doc of this.unsyncedDocuments) {
            try {
              await this.pelClient.sendDocument(doc);
              console.log(`  ✓ Synced ${doc.datiGenerali.numero}`);
            } catch {
              console.error(`  ✗ Failed to sync ${doc.datiGenerali.numero}`);
            }
          }
        }

        // Send journal (create Journal object from journal data)
        const journal = JSON.parse(journalData);
        const result = await this.pelClient.sendJournal(journal);
        if (result.success) {
          journalSynced = true;
          console.log('✓ Journal synced to PEL');
        } else {
          console.warn('⚠️  Journal sync failed:', result.error);
        }
      } catch (error) {
        console.warn('Failed to send journal to PEL:', error);
      }
    }

    this.isSessionOpen = false;

    console.log(`✅ Session Closed - ${result.totalDocuments} documents, ${result.totalAmount}€`);
    if (!journalSynced && this.pelClient) {
      console.warn(`⚠️  Journal NOT synced to PEL - stored locally`);
    }
    if (this.unsyncedDocuments.length > 0) {
      console.warn(`⚠️  ${this.unsyncedDocuments.length} documents failed to sync`);
    }

    return {
      totalDocuments: result.totalDocuments,
      totalAmount: result.totalAmount,
      journalSynced,
      unsyncedDocuments: this.unsyncedDocuments.length,
    };
  }

  /**
   * Get journal entries
   */
  getJournalEntries() {
    return this.journal.getEntries();
  }

  /**
   * Verify journal integrity
   */
  verifyJournal(): boolean {
    return this.journal.verify();
  }

  /**
   * Get all documents
   */
  async getDocuments(): Promise<DocumentoCommerciale[]> {
    return this.storage.listDocuments();
  }

  /**
   * Get session status
   */
  getStatus() {
    return {
      isOpen: this.isSessionOpen,
      deviceType: this.config.deviceType,
      serialNumber: this.config.serialNumber,
      documentsCount: this.documentCounter,
      journalVerified: this.journal.verify(),
    };
  }

  /**
   * Export journal for PEL synchronization
   */
  async exportForSync(): Promise<string> {
    return this.journal.exportJournal();
  }

  /**
   * Export journal data
   */
  exportJournal() {
    return JSON.parse(this.journal.exportJournal());
  }
}
