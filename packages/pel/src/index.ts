/**
 * @nopos-ade/pel
 * Punto di Elaborazione (Elaboration Point)
 * Server library for managing PEMs, communicating with ADE, and handling audits
 */

// ADE API Client
export { ADEClient as ADEAPIClient, ADEClient } from './ade.client'; // ADEAPIClient is backward compatibility
export type { APIClientConfig } from './ade.client';

// Storage Interface
export type { IStorage } from './storage.interface';

// Database Interface
export type {
  AuditLogEntry,
  DatabaseConfig,
  IDatabase,
  QueryFilter,
  QueryResult,
} from './database.interface';

// Audit Server
export { AuditRequestStatus, AuditServer } from './audit.server';
export type { AuditServerConfig } from './audit.server';

// PEL Server (receives data from PEM devices)
export { PELServer } from './pel.server';
export type { PELServerConfig } from './pel.server';

// Metadata Builder
export { createArchiveMetadata, generateMetadataXML } from './metadata.builder';
export type {
  ArchiveMetadata,
  DocumentMetadata,
  JournalMetadata,
  MetadataConfig,
} from './metadata.builder';

// Outcome Poller
export { OutcomePoller } from './outcome.poller';
export type { OutcomePollerConfig, PendingTransmission } from './outcome.poller';

// Anomaly Manager
export { AnomalyManager, AnomalyType } from './anomaly.manager';
export type { AnomalyManagerConfig, AnomalyReport } from './anomaly.manager';

// Conservation Interface
export { conserveDocuments, conserveJournals } from './conservation.interface';
export type {
  ConservationFilter,
  ConservationItem,
  ConservationPackage,
  ConservationStats,
  IConservation,
} from './conservation.interface';

export const VERSION = '1.0.0';
