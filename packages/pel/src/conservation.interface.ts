/**
 * Digital Conservation Interface
 * Abstract interface for long-term digital document preservation
 *
 * Conservazione Digitale a Norma per documenti fiscali
 */

import type { DocumentoCommerciale, Journal } from '@nopos-ade/common';

/**
 * Conservation package metadata
 */
export interface ConservationPackage {
  /** Unique package identifier */
  packageId: string;
  /** Package creation timestamp */
  createdAt: string;
  /** Package type */
  type: 'DOCUMENTS' | 'JOURNALS' | 'DAILY_RECEIPTS' | 'MIXED';
  /** Period covered (start date) */
  periodFrom: string;
  /** Period covered (end date) */
  periodTo: string;
  /** Total number of items in package */
  itemCount: number;
  /** Package size in bytes */
  sizeBytes: number;
  /** Digital signature applied */
  signed: boolean;
  /** Timestamp applied */
  timestamped: boolean;
  /** Conservation expiry date */
  expiryDate: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conservation item
 */
export interface ConservationItem {
  /** Item identifier */
  itemId: string;
  /** Item type */
  type: 'DOCUMENT' | 'JOURNAL' | 'DAILY_RECEIPTS' | 'METADATA' | 'OTHER';
  /** Original filename */
  filename: string;
  /** Item hash (SHA-256) */
  hash: string;
  /** Item size in bytes */
  sizeBytes: number;
  /** Item creation timestamp */
  createdAt: string;
  /** Reference to original document */
  documentRef?: string;
}

/**
 * Conservation query filter
 */
export interface ConservationFilter {
  /** Package type */
  packageType?: string;
  /** Period start date */
  dateFrom?: string;
  /** Period end date */
  dateTo?: string;
  /** PEM identifier */
  emissionPointId?: string;
  /** Item type */
  itemType?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Conservation statistics
 */
export interface ConservationStats {
  /** Total number of packages */
  totalPackages: number;
  /** Total number of items conserved */
  totalItems: number;
  /** Total storage size in bytes */
  totalSizeBytes: number;
  /** Oldest package date */
  oldestPackage?: string;
  /** Newest package date */
  newestPackage?: string;
  /** Packages by type */
  packagesByType: Record<string, number>;
}

/**
 * Digital Conservation Interface
 *
 * Implementa questa interfaccia per integrarti con provider di conservazione:
 * - InfoCert
 * - Aruba PEC
 * - Poste Italiane
 * - Namirial
 * - O qualsiasi altro provider certificato AgID
 */
export interface IConservation {
  /**
   * Create a new conservation package
   * Groups multiple items for long-term preservation
   */
  createPackage(
    type: string,
    periodFrom: string,
    periodTo: string,
    metadata?: Record<string, any>
  ): Promise<ConservationPackage>;

  /**
   * Add item to conservation package
   */
  addItem(packageId: string, item: ConservationItem, content: Uint8Array): Promise<void>;

  /**
   * Finalize package
   * Applies digital signature and timestamp
   */
  finalizePackage(packageId: string): Promise<void>;

  /**
   * Retrieve conservation package
   */
  getPackage(packageId: string): Promise<ConservationPackage | null>;

  /**
   * List conservation packages
   */
  listPackages(filter?: ConservationFilter): Promise<ConservationPackage[]>;

  /**
   * Retrieve conserved item
   */
  getItem(packageId: string, itemId: string): Promise<Uint8Array | null>;

  /**
   * List items in package
   */
  listItems(packageId: string): Promise<ConservationItem[]>;

  /**
   * Verify package integrity
   * Checks signature and timestamp validity
   */
  verifyPackage(packageId: string): Promise<boolean>;

  /**
   * Get conservation statistics
   */
  getStats(): Promise<ConservationStats>;

  /**
   * Export package for external verification
   * Creates a self-contained archive with all items and signatures
   */
  exportPackage(packageId: string): Promise<Uint8Array>;

  /**
   * Delete expired packages
   * According to legal retention periods
   */
  deleteExpired(): Promise<number>;
}

/**
 * Helper: Create conservation package for documents
 */
export async function conserveDocuments(
  conservation: IConservation,
  documents: Array<{ document: DocumentoCommerciale; hash: string }>,
  periodFrom: string,
  periodTo: string
): Promise<ConservationPackage> {
  const pkg = await conservation.createPackage('DOCUMENTS', periodFrom, periodTo, {
    documentCount: documents.length,
  });

  for (const { document, hash } of documents) {
    const content = new TextEncoder().encode(JSON.stringify(document));
    const item: ConservationItem = {
      itemId: `DOC_${document.datiGenerali.numero}`,
      type: 'DOCUMENT',
      filename: `${document.datiGenerali.numero}.json`,
      hash,
      sizeBytes: content.length,
      createdAt: document.datiGenerali.dataOra,
      documentRef: document.datiGenerali.numero,
    };

    await conservation.addItem(pkg.packageId, item, content);
  }

  await conservation.finalizePackage(pkg.packageId);
  return pkg;
}

/**
 * Helper: Create conservation package for journals
 */
export async function conserveJournals(
  conservation: IConservation,
  journals: Array<{ journal: Journal; hash: string }>,
  periodFrom: string,
  periodTo: string
): Promise<ConservationPackage> {
  const pkg = await conservation.createPackage('JOURNALS', periodFrom, periodTo, {
    journalCount: journals.length,
  });

  for (const { journal, hash } of journals) {
    const content = new TextEncoder().encode(JSON.stringify(journal));
    const item: ConservationItem = {
      itemId: `JOURNAL_${journal.identificativoPEM}_${journal.dataRiferimento}`,
      type: 'JOURNAL',
      filename: `journal_${journal.dataRiferimento}.json`,
      hash,
      sizeBytes: content.length,
      createdAt: journal.dataOraGenerazione,
    };

    await conservation.addItem(pkg.packageId, item, content);
  }

  await conservation.finalizePackage(pkg.packageId);
  return pkg;
}
