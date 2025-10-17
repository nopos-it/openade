/**
 * @nopos-ade/pem
 * Punto di Emissione (Emission Point) - Device library
 *
 * Handles fiscal document emission, journal management, and local storage
 */

// Main manager
export { PEMManager } from './pem.manager';
export type { PEMConfig } from './pem.manager';

// Document builder
export { DocumentBuilder } from './document.builder';
export type { DocumentLine } from './document.builder';

// PDF generator
export { generateCommercialDocumentPDF, generateDataMatrixContent } from './document.pdf';
export type { DataMatrixContent, PDFGeneratorConfig } from './document.pdf';

// Journal manager
export { JournalManager } from './journal.manager';
export type { JournalEntry } from './journal.manager';

// Storage
export type { IPEMStorage } from './storage.interface';

// PEL Client (for PEM to communicate with PEL)
export { PELClient } from './pel.client';
export type { PELClientConfig, SessionSeed, TransmissionResult } from './pel.client';

// Lottery Generator
export { LotteryGenerator } from './lottery.generator';
export type { LotteryGeneratorConfig } from './lottery.generator';

export const VERSION = '1.0.0';
