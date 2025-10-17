/**
 * Database interface for fiscal data persistence
 *
 * This interface defines the contract for storing and retrieving fiscal data
 * required by the SSW (Soluzione Software) specifications.
 *
 * Implementations can use any database (PostgreSQL, MongoDB, SQLite, etc.)
 */

import type {
  CorrispettiviEsito,
  CorrispettiviGiornalieri,
  DocumentoCommerciale,
  ElaborationPointCensus,
  ElaborationPointStatusInfo,
  EmissionPointCensus,
  EmissionPointStatusInfo,
  Journal,
} from '@nopos-ade/common';

/**
 * Query filters for searching records
 */
export interface QueryFilter {
  /** VAT number */
  vatNumber?: string;
  /** Emission point identifier */
  emissionPointId?: string;
  /** Elaboration point identifier */
  elaborationPointId?: string;
  /** Start date (ISO format) */
  dateFrom?: string;
  /** End date (ISO format) */
  dateTo?: string;
  /** Status filter */
  status?: string;
  /** Document type */
  documentType?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Query result with pagination
 */
export interface QueryResult<T> {
  /** Result items */
  items: T[];
  /** Result data (alias for items) */
  data: T[];
  /** Total count */
  total: number;
  /** Has more results */
  hasMore: boolean;
}

/**
 * Database interface for fiscal data
 */
export interface IDatabase {
  // ============================================
  // Emission Points (PEM)
  // ============================================

  /**
   * Save emission point census
   */
  saveEmissionPoint(census: EmissionPointCensus): Promise<void>;

  /**
   * Get emission point by ID
   */
  getEmissionPoint(vatNumber: string, emissionPointId: string): Promise<EmissionPointCensus | null>;

  /**
   * Update emission point status
   */
  updateEmissionPointStatus(
    vatNumber: string,
    emissionPointId: string,
    status: EmissionPointStatusInfo
  ): Promise<void>;

  /**
   * List emission points
   */
  listEmissionPoints(filter: QueryFilter): Promise<QueryResult<EmissionPointCensus>>;

  /**
   * Delete emission point
   */
  deleteEmissionPoint(vatNumber: string, emissionPointId: string): Promise<void>;

  // ============================================
  // Elaboration Points (PEL)
  // ============================================

  /**
   * Save elaboration point census
   */
  saveElaborationPoint(census: ElaborationPointCensus): Promise<void>;

  /**
   * Get elaboration point by ID
   */
  getElaborationPoint(
    vatNumber: string,
    elaborationPointId: string
  ): Promise<ElaborationPointCensus | null>;

  /**
   * Update elaboration point status
   */
  updateElaborationPointStatus(
    vatNumber: string,
    elaborationPointId: string,
    status: ElaborationPointStatusInfo
  ): Promise<void>;

  /**
   * List elaboration points
   */
  listElaborationPoints(filter: QueryFilter): Promise<QueryResult<ElaborationPointCensus>>;

  // ============================================
  // Daily Receipts (Corrispettivi)
  // ============================================

  /**
   * Save daily receipts
   */
  saveDailyReceipts(receipts: CorrispettiviGiornalieri): Promise<void>;

  /**
   * Get daily receipts
   */
  getDailyReceipts(
    vatNumber: string,
    emissionPointId: string,
    date: string
  ): Promise<CorrispettiviGiornalieri | null>;

  /**
   * Save daily receipts transmission outcome
   */
  saveDailyReceiptsOutcome(outcome: CorrispettiviEsito): Promise<void>;

  /**
   * Get daily receipts transmission outcome
   */
  getDailyReceiptsOutcome(
    vatNumber: string,
    emissionPointId: string,
    date: string
  ): Promise<CorrispettiviEsito | null>;

  /**
   * List daily receipts
   */
  listDailyReceipts(filter: QueryFilter): Promise<QueryResult<CorrispettiviGiornalieri>>;

  // ============================================
  // Commercial Documents
  // ============================================

  /**
   * Save commercial document
   */
  saveDocument(document: DocumentoCommerciale): Promise<void>;

  /**
   * Get commercial document by identifiers
   */
  getDocument(
    vatNumber: string,
    emissionPointId: string,
    documentNumber: string
  ): Promise<DocumentoCommerciale | null>;

  /**
   * Get commercial document by hash (optional)
   */
  getDocumentByHash?(hash: string): Promise<DocumentoCommerciale | null>;

  /**
   * List commercial documents
   */
  listDocuments(filter: QueryFilter): Promise<QueryResult<DocumentoCommerciale>>;

  /**
   * Delete commercial document
   */
  deleteDocument(vatNumber: string, emissionPointId: string, documentNumber: string): Promise<void>;

  // ============================================
  // Journal (Giornale)
  // ============================================

  /**
   * Save journal
   */
  saveJournal(journal: Journal): Promise<void>;

  /**
   * Get journal
   */
  getJournal(vatNumber: string, emissionPointId: string, date: string): Promise<Journal | null>;

  /**
   * List journals
   */
  listJournals(filter: QueryFilter): Promise<QueryResult<Journal>>;

  // ============================================
  // Audit and Compliance
  // ============================================

  /**
   * Get audit trail for a specific entity
   */
  getAuditTrail(
    entityType: string,
    entityId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<AuditLogEntry[]>;

  /**
   * Save audit log entry
   */
  saveAuditLog(entry: {
    timestamp: string;
    entityType: string;
    entityId: string;
    action: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Health check
   */
  isHealthy(): Promise<boolean>;

  /**
   * Close database connection
   */
  close(): Promise<void>;

  /**
   * Begin transaction (if supported)
   */
  beginTransaction?(): Promise<void>;

  /**
   * Commit transaction (if supported)
   */
  commitTransaction?(): Promise<void>;

  /**
   * Rollback transaction (if supported)
   */
  rollbackTransaction?(): Promise<void>;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database type */
  type: 'postgres' | 'mysql' | 'mongodb' | 'sqlite' | 'custom';
  /** Connection string or configuration */
  connection: string | Record<string, unknown>;
  /** Pool size */
  poolSize?: number;
  /** Connection timeout */
  timeout?: number;
  /** Enable logging */
  logging?: boolean;
  /** Additional options */
  options?: Record<string, unknown>;
}
