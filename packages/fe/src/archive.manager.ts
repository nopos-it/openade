/**
 * Archive Management
 * Handles archive management and retention policies for FatturaPA invoices
 */

import type { FatturaElettronica } from '@nopos-ade/common';
import { createHash } from 'crypto';
import { CompressionService } from './compression.service';
import { EncryptionService } from './encryption.service';
import type { IStorage } from './storage.interface';

export interface ArchiveConfig {
  /** File storage service */
  fileStorage: IStorage;
  /** Archive storage directory */
  archiveDir: string;
  /** Retention period in days */
  retentionDays?: number;
  /** Compression enabled */
  compression?: boolean;
  /** Encryption enabled */
  encryption?: boolean;
  /** Archive format (zip, tar, custom) */
  format?: 'zip' | 'tar' | 'custom';
  /** Metadata file name */
  metadataFile?: string;
  /** Index file name */
  indexFile?: string;
}

export interface ArchiveMetadata {
  /** Archive ID */
  id: string;
  /** Archive name */
  name: string;
  /** Creation date */
  createdAt: string;
  /** Archive period start */
  periodStart: string;
  /** Archive period end */
  periodEnd: string;
  /** Number of invoices */
  invoiceCount: number;
  /** Total size in bytes */
  totalSize: number;
  /** Archive checksum */
  checksum: string;
  /** Compression applied */
  compressed: boolean;
  /** Encryption applied */
  encrypted: boolean;
  /** Archive format */
  format: string;
  /** Retention date */
  retentionDate: string;
}

export interface ArchiveEntry {
  /** Invoice filename */
  filename: string;
  /** Invoice ID */
  invoiceId: string;
  /** Invoice date */
  invoiceDate: string;
  /** Customer VAT number */
  customerVatNumber?: string;
  /** Invoice amount */
  amount: number;
  /** File size */
  size: number;
  /** File checksum */
  checksum: string;
  /** Archive date */
  archiveDate: string;
}

export interface ArchiveResult {
  /** Archive ID */
  archiveId: string;
  /** Success status */
  success: boolean;
  /** Number of invoices archived */
  invoiceCount: number;
  /** Archive size */
  archiveSize: number;
  /** Error message if failed */
  error?: string;
  /** Archive metadata */
  metadata?: ArchiveMetadata;
}

/**
 * Archive manager for FatturaPA invoices
 */
export class ArchiveManager {
  private config: ArchiveConfig;
  private compressionService: CompressionService;
  private encryptionService: EncryptionService;

  constructor(config: ArchiveConfig) {
    this.config = {
      retentionDays: 3650, // 10 years default
      compression: true,
      encryption: false,
      format: 'zip',
      metadataFile: 'metadata.json',
      indexFile: 'index.json',
      ...config,
    };

    // Create service instances
    this.compressionService = new CompressionService();
    this.encryptionService = new EncryptionService();
  }

  async initialize(): Promise<void> {
    // Ensure archive directory exists
    await this.ensureArchiveDirectory();
  }

  /**
   * Create archive from invoices
   */
  async createArchive(
    invoices: Array<{
      invoice: FatturaElettronica;
      filename: string;
      xmlContent: string;
    }>,
    archiveName: string,
    periodStart: string,
    periodEnd: string
  ): Promise<ArchiveResult> {
    try {
      const archiveId = this.generateArchiveId();
      const archivePath = `${this.config.archiveDir}/${archiveId}_${archiveName}`;

      // Create archive directory
      if (this.config.fileStorage.createDirectory) {
        await this.config.fileStorage.createDirectory(archivePath);
      }

      const entries: ArchiveEntry[] = [];
      let totalSize = 0;

      // Process each invoice
      for (const { invoice, filename, xmlContent } of invoices) {
        const entry = await this.archiveInvoice(invoice, filename, xmlContent, archivePath);
        entries.push(entry);
        totalSize += entry.size;
      }

      // Create metadata
      const metadata: ArchiveMetadata = {
        id: archiveId,
        name: archiveName,
        createdAt: new Date().toISOString(),
        periodStart,
        periodEnd,
        invoiceCount: invoices.length,
        totalSize,
        checksum: this.calculateArchiveChecksum(entries),
        compressed: this.config.compression!,
        encrypted: this.config.encryption!,
        format: this.config.format!,
        retentionDate: this.calculateRetentionDate(),
      };

      // Save metadata and index
      await this.saveArchiveMetadata(archivePath, metadata);
      await this.saveArchiveIndex(archivePath, entries);

      // Compress archive if enabled
      if (this.config.compression) {
        await this.compressArchive(archivePath);
      }

      // Encrypt archive if enabled
      if (this.config.encryption) {
        await this.encryptArchive(archivePath);
      }

      return {
        archiveId,
        success: true,
        invoiceCount: invoices.length,
        archiveSize: totalSize,
        metadata,
      };
    } catch (error) {
      return {
        archiveId: '',
        success: false,
        invoiceCount: 0,
        archiveSize: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Archive a single invoice
   */
  private async archiveInvoice(
    invoice: FatturaElettronica,
    filename: string,
    xmlContent: string,
    archivePath: string
  ): Promise<ArchiveEntry> {
    const filePath = `${archivePath}/${filename}`;
    const content = Buffer.from(xmlContent, 'utf8');
    const checksum = this.calculateFileChecksum(content);

    // Write invoice file
    await this.config.fileStorage.store(filePath, new Uint8Array(content));

    // Extract invoice data
    const invoiceId = this.extractInvoiceId(invoice);
    const invoiceDate = this.extractInvoiceDate(invoice);
    const customerVatNumber = this.extractCustomerVatNumber(invoice);
    const amount = this.extractInvoiceAmount(invoice);

    return {
      filename,
      invoiceId,
      invoiceDate,
      customerVatNumber,
      amount,
      size: content.length,
      checksum,
      archiveDate: new Date().toISOString(),
    };
  }

  /**
   * List all archives
   */
  async listArchives(): Promise<ArchiveMetadata[]> {
    try {
      const archives: ArchiveMetadata[] = [];
      const items = await this.config.fileStorage.list(this.config.archiveDir);

      for (const item of items) {
        const metadata = await this.loadArchiveMetadata(item);
        if (metadata) {
          archives.push(metadata);
        }
      }

      return archives.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get archive by ID
   */
  async getArchive(archiveId: string): Promise<ArchiveMetadata | null> {
    try {
      const archivePath = await this.findArchivePath(archiveId);
      if (!archivePath) {
        return null;
      }

      return await this.loadArchiveMetadata(archivePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract archive
   */
  async extractArchive(archiveId: string, extractPath: string): Promise<boolean> {
    try {
      const archivePath = await this.findArchivePath(archiveId);
      if (!archivePath) {
        return false;
      }

      // Create extract directory
      if (this.config.fileStorage.createDirectory) {
        await this.config.fileStorage.createDirectory(extractPath);
      }

      // Copy archive contents
      await this.copyArchiveContents(archivePath, extractPath);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete archive
   */
  async deleteArchive(archiveId: string): Promise<boolean> {
    try {
      const archivePath = await this.findArchivePath(archiveId);
      if (!archivePath) {
        return false;
      }

      // Remove archive directory
      await this.removeDirectory(archivePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up expired archives
   */
  async cleanupExpiredArchives(): Promise<number> {
    try {
      const archives = await this.listArchives();
      const now = new Date();
      let deletedCount = 0;

      for (const archive of archives) {
        const retentionDate = new Date(archive.retentionDate);
        if (now > retentionDate) {
          const deleted = await this.deleteArchive(archive.id);
          if (deleted) {
            deletedCount++;
          }
        }
      }

      return deletedCount;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate archive ID
   */
  private generateArchiveId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ARCH_${timestamp}_${random}`;
  }

  /**
   * Ensure archive directory exists
   */
  private async ensureArchiveDirectory(): Promise<void> {
    if (this.config.fileStorage.createDirectory) {
      await this.config.fileStorage.createDirectory(this.config.archiveDir);
    }
  }

  /**
   * Calculate file checksum
   */
  private calculateFileChecksum(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate archive checksum
   */
  private calculateArchiveChecksum(entries: ArchiveEntry[]): string {
    const combined = entries.map((e) => `${e.filename}:${e.checksum}`).join('|');
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Calculate retention date
   */
  private calculateRetentionDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + this.config.retentionDays!);
    return date.toISOString();
  }

  /**
   * Save archive metadata
   */
  private async saveArchiveMetadata(archivePath: string, metadata: ArchiveMetadata): Promise<void> {
    const metadataPath = `${archivePath}/${this.config.metadataFile!}`;
    await this.config.fileStorage.store(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Save archive index
   */
  private async saveArchiveIndex(archivePath: string, entries: ArchiveEntry[]): Promise<void> {
    const indexPath = `${archivePath}/${this.config.indexFile!}`;
    await this.config.fileStorage.store(indexPath, JSON.stringify(entries, null, 2));
  }

  /**
   * Load archive metadata
   */
  private async loadArchiveMetadata(archivePath: string): Promise<ArchiveMetadata | null> {
    try {
      const metadataPath = `${archivePath}/${this.config.metadataFile!}`;
      const content = await this.config.fileStorage.retrieve(metadataPath);
      if (!content) {
        return null;
      }

      return JSON.parse(Buffer.from(content).toString('utf8')) as ArchiveMetadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find archive path by ID
   */
  private async findArchivePath(archiveId: string): Promise<string | null> {
    try {
      const items = await this.config.fileStorage.list(this.config.archiveDir);
      for (const item of items) {
        if (item.startsWith(archiveId)) {
          return `${this.config.archiveDir}/${item}`;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Copy archive contents
   */
  private async copyArchiveContents(sourcePath: string, destPath: string): Promise<void> {
    const items = await this.config.fileStorage.list(sourcePath);
    for (const item of items) {
      const sourceItemPath = `${sourcePath}/${item}`;
      const destItemPath = `${destPath}/${item}`;

      const content = await this.config.fileStorage.retrieve(sourceItemPath);
      if (content) {
        await this.config.fileStorage.store(destItemPath, content);
      }
    }
  }

  /**
   * Remove directory recursively
   */
  private async removeDirectory(dirPath: string): Promise<void> {
    const items = await this.config.fileStorage.list(dirPath);
    for (const item of items) {
      const itemPath = `${dirPath}/${item}`;
      await this.config.fileStorage.delete(itemPath);
    }
    // Note: deleteDirectory is not part of IStorage interface
    // Implementation would need to handle directory deletion separately
  }

  /**
   * Compress archive
   */
  private async compressArchive(archivePath: string): Promise<void> {
    if (!this.config.compression) return;

    const items = await this.config.fileStorage.list(archivePath);
    for (const item of items) {
      const filePath = `${archivePath}/${item}`;
      const content = await this.config.fileStorage.retrieve(filePath);
      if (content) {
        const compressed = await this.compressionService.compress(Buffer.from(content));
        await this.config.fileStorage.store(filePath, compressed);
      }
    }
  }

  /**
   * Encrypt archive
   */
  private async encryptArchive(archivePath: string): Promise<void> {
    if (!this.config.encryption) return;

    const encryptionKey = await this.encryptionService.generateKey();
    const items = await this.config.fileStorage.list(archivePath);
    for (const item of items) {
      const filePath = `${archivePath}/${item}`;
      const content = await this.config.fileStorage.retrieve(filePath);
      if (content) {
        const encrypted = await this.encryptionService.encrypt(Buffer.from(content), encryptionKey);
        await this.config.fileStorage.store(filePath, encrypted);
      }
    }
  }

  /**
   * Extract invoice ID
   */
  private extractInvoiceId(invoice: FatturaElettronica): string {
    return invoice.fatturaElettronicaHeader.datiTrasmissione.progressivoInvio;
  }

  /**
   * Extract invoice date
   */
  private extractInvoiceDate(invoice: FatturaElettronica): string {
    const body = Array.isArray(invoice.fatturaElettronicaBody)
      ? invoice.fatturaElettronicaBody[0]
      : invoice.fatturaElettronicaBody;
    return body.datiGenerali.datiGeneraliDocumento.data;
  }

  /**
   * Extract customer VAT number
   */
  private extractCustomerVatNumber(invoice: FatturaElettronica): string | undefined {
    const customer = invoice.fatturaElettronicaHeader.cessionarioCommittente;
    return customer.datiAnagrafici.idFiscaleIVA?.idCodice;
  }

  /**
   * Extract invoice amount
   */
  private extractInvoiceAmount(invoice: FatturaElettronica): number {
    const body = Array.isArray(invoice.fatturaElettronicaBody)
      ? invoice.fatturaElettronicaBody[0]
      : invoice.fatturaElettronicaBody;
    return body.datiBeniServizi.datiRiepilogo.reduce((total: number, riepilogo: any) => {
      return total + riepilogo.imponibileImporto + riepilogo.imposta;
    }, 0);
  }
}

/**
 * Create an archive manager
 */
export function createArchiveManager(config: ArchiveConfig): ArchiveManager {
  return new ArchiveManager(config);
}

/**
 * Archive invoices
 */
export async function archiveInvoices(
  invoices: Array<{
    invoice: FatturaElettronica;
    filename: string;
    xmlContent: string;
  }>,
  archiveName: string,
  periodStart: string,
  periodEnd: string,
  config: ArchiveConfig
): Promise<ArchiveResult> {
  const manager = createArchiveManager(config);
  return await manager.createArchive(invoices, archiveName, periodStart, periodEnd);
}
