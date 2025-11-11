/**
 * @openade/fe
 * Fatturazione Elettronica (Electronic Invoicing)
 * Library for creating and transmitting FatturaPA invoices to SDI
 */

// Core FE Components
export { InvoiceBuilder } from './invoice.builder';
export type { InvoiceBuilderConfig, InvoiceData, InvoiceLine } from './invoice.builder';

export { buildInvoiceXML, validateInvoiceXML } from './invoice.xml';
export { ReceiptHandler, parseReceiptFilename, parseReceiptType } from './receipt.handler';

// Core Services
export { HttpService } from './http.service';
export { XmlService } from './xml.service';

// SDI Transmission Clients
export { SDICOOPClient } from './sdicoop.client';
export type { SDICOOPConfig } from './sdicoop.client';

export { SDIFTPClient } from './sdiftp.client';
export type { SDIFTPConfig } from './sdiftp.client';

// Storage Interfaces
export type {
  AuditLogEntry,
  DatabaseConfig,
  IDatabase,
  InvoiceRecord,
  QueryFilter,
  QueryResult,
  ReceiptRecord,
} from './database.interface';
export type { IStorage } from './storage.interface';

// Optional Features (Advanced)
export { SignatureManager as DigitalSignatureManager } from './signature.manager';
export type { SignatureConfig } from './signature.manager';

export { TimestampingManager } from './timestamping.manager';
export type { TimestampRequest, TimestampResult, TimestampingConfig } from './timestamping.manager';

export { AttachmentManager } from './attachments.manager';
export type { AttachmentConfig } from './attachments.manager';

export { ArchiveManager } from './archive.manager';
export type { ArchiveConfig } from './archive.manager';

export { AuditTrailManager } from './audit.manager';
export type { AuditConfig } from './audit.manager';

export { CrossBorderManager } from './crossborder.manager';
export type { CrossBorderConfig } from './crossborder.manager';

export { BatchProcessor } from './batch.processor';
export type { BatchConfig } from './batch.processor';

// Services
export { Asn1Service } from './asn1.service';
export { CompressionService } from './compression.service';
export { EncryptionService } from './encryption.service';
export { EUVATService } from './euvat.service';
export { SignatureService as DigitalSignatureService } from './signature.service';
export { TSAService } from './timestamping.service';

export const VERSION = '1.0.0';
