/**
 * Database interface for FatturaPA data persistence
 *
 * This interface defines the contract for storing and retrieving FatturaPA data
 * including invoices, receipts, and audit information.
 *
 * Implementations can use any database (PostgreSQL, MongoDB, SQLite, etc.)
 */

import type { FatturaElettronica } from '@openade/common';

/**
 * Query filters for searching records
 */
export interface QueryFilter {
  /** VAT number */
  vatNumber?: string;
  /** Invoice number */
  invoiceNumber?: string;
  /** Start date (ISO format) */
  dateFrom?: string;
  /** End date (ISO format) */
  dateTo?: string;
  /** Status filter */
  status?: string;
  /** Document type */
  documentType?: string;
  /** SDI identifier */
  identificativoSdI?: string;
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
 * Invoice record for database storage
 */
export interface InvoiceRecord {
  /** Unique identifier */
  id: string;
  /** VAT number */
  vatNumber: string;
  /** Invoice number */
  invoiceNumber: string;
  /** Invoice date */
  invoiceDate: string;
  /** SDI identifier */
  identificativoSdI?: string;
  /** Invoice data */
  invoice: FatturaElettronica;
  /** XML content */
  xmlContent: string;
  /** Status */
  status: 'draft' | 'sent' | 'delivered' | 'rejected' | 'error';
  /** Created timestamp */
  createdAt: string;
  /** Updated timestamp */
  updatedAt: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Receipt record for database storage
 */
export interface ReceiptRecord {
  /** Unique identifier */
  id: string;
  /** Related invoice ID */
  invoiceId: string;
  /** SDI identifier */
  identificativoSdI: string;
  /** Receipt type */
  receiptType: 'RC' | 'NS' | 'MC' | 'NE' | 'MT' | 'DT';
  /** Receipt content */
  content: string;
  /** Receipt date */
  receiptDate: string;
  /** Created timestamp */
  createdAt: string;
}

/**
 * Database interface for FatturaPA data
 */
export interface IDatabase {
  // ============================================
  // Invoices
  // ============================================

  /**
   * Save invoice
   */
  saveInvoice(invoice: InvoiceRecord): Promise<void>;

  /**
   * Get invoice by ID
   */
  getInvoice(id: string): Promise<InvoiceRecord | null>;

  /**
   * Get invoice by identifiers
   */
  getInvoiceByIdentifiers(
    vatNumber: string,
    invoiceNumber: string,
    invoiceDate: string
  ): Promise<InvoiceRecord | null>;

  /**
   * Update invoice status
   */
  updateInvoiceStatus(id: string, status: InvoiceRecord['status']): Promise<void>;

  /**
   * Update invoice SDI identifier
   */
  updateInvoiceSdiId(id: string, identificativoSdI: string): Promise<void>;

  /**
   * List invoices
   */
  listInvoices(filter: QueryFilter): Promise<QueryResult<InvoiceRecord>>;

  /**
   * Delete invoice
   */
  deleteInvoice(id: string): Promise<void>;

  // ============================================
  // Receipts
  // ============================================

  /**
   * Save receipt
   */
  saveReceipt(receipt: ReceiptRecord): Promise<void>;

  /**
   * Get receipt by ID
   */
  getReceipt(id: string): Promise<ReceiptRecord | null>;

  /**
   * Get receipts for invoice
   */
  getReceiptsForInvoice(invoiceId: string): Promise<ReceiptRecord[]>;

  /**
   * Get receipt by SDI identifier
   */
  getReceiptBySdiId(identificativoSdI: string): Promise<ReceiptRecord | null>;

  /**
   * List receipts
   */
  listReceipts(filter: QueryFilter): Promise<QueryResult<ReceiptRecord>>;

  /**
   * Delete receipt
   */
  deleteReceipt(id: string): Promise<void>;

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
