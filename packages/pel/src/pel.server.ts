/**
 * PEL Server
 * Receives data from PEM devices and manages transmission to ADE
 */

import type { DocumentoCommerciale, ISODateTime, Journal } from '@openade/common';
import express, { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ADEClient } from './ade.client';
import type { IDatabase } from './database.interface';
import type { IStorage } from './storage.interface';

export interface PELServerConfig {
  storage: IStorage;
  database: IDatabase;
  adeClient: ADEClient;
  port?: number;
}

/**
 * Express server for PEL
 * Receives documents and journals from PEM devices
 */
export class PELServer {
  private app: express.Application;
  private router: Router;
  private storage: IStorage;
  private database: IDatabase;
  private adeClient: ADEClient;
  private port: number;

  constructor(config: PELServerConfig) {
    this.storage = config.storage;
    this.database = config.database;
    this.adeClient = config.adeClient;
    this.port = config.port || 4000;
    this.app = express();
    this.router = Router();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS for PEM devices
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });
  }

  private setupRoutes(): void {
    /**
     * GET /api/session/seed
     * PEM requests session seed to open cash session
     */
    this.router.get('/api/session/seed', async (req: Request, res: Response) => {
      try {
        const sessionId = uuidv4();
        const seed = this.generateSeed();

        // Store seed for validation
        await this.storage.store(
          `seeds/${sessionId}.json`,
          new TextEncoder().encode(
            JSON.stringify({ sessionId, seed, timestamp: new Date().toISOString() })
          )
        );

        res.json({ sessionId, seed });
      } catch (error) {
        console.error('Error generating session seed:', error);
        res.status(500).json({ error: 'Failed to generate session seed' });
      }
    });

    /**
     * POST /api/document
     * PEM sends document in real-time after transaction
     */
    this.router.post('/api/document', async (req: Request, res: Response) => {
      try {
        const document: DocumentoCommerciale = req.body;

        if (!this.validateDocument(document)) {
          return res.status(400).json({ error: 'Invalid document' });
        }

        const messageId = uuidv4();
        const receiveTime: ISODateTime = new Date().toISOString() as ISODateTime;

        // Store document
        const docDate = document.datiGenerali.dataOra.substring(0, 10);
        const docNumber = document.datiGenerali.numero;
        const path = `documents/${document.identificativoPEM}/${docDate}/${docNumber}.xml`;
        await this.storage.store(path, new TextEncoder().encode(JSON.stringify(document)));

        // Save to database
        await this.database.saveDocument(document);

        // Log transmission time difference
        const emitTime = new Date(document.datiGenerali.dataOra).getTime();
        const receiveTimeMs = new Date(receiveTime).getTime();
        const timeDiff = receiveTimeMs - emitTime;

        console.log(`Document received: ${docNumber} (transmission time: ${timeDiff}ms)`);

        res.json({ messageId, received: receiveTime });
      } catch (error) {
        console.error('Error receiving document:', error);
        res.status(500).json({ error: 'Failed to save document' });
      }
    });

    /**
     * POST /api/journal
     * PEM sends journal at cash session close
     */
    this.router.post('/api/journal', async (req: Request, res: Response) => {
      try {
        const journal: Journal = req.body;

        if (!this.validateJournal(journal)) {
          return res.status(400).json({ error: 'Invalid journal' });
        }

        const messageId = uuidv4();

        // Verify journal integrity
        const isValid = await this.verifyJournalIntegrity(journal);
        if (!isValid) {
          console.error('Journal integrity check failed');
          // Still save but flag anomaly
          await this.reportAnomaly({
            type: 'JOURNAL_INTEGRITY_ERROR',
            pemId: journal.identificativoPEM,
            details: `Journal for ${journal.dataRiferimento} failed integrity check`,
            timestamp: new Date().toISOString(),
          });
        }

        // Store journal
        const path = `journals/${journal.identificativoPEM}/${journal.dataRiferimento}/${journal.dataOraGenerazione.replace(/:/g, '-')}.xml`;
        await this.storage.store(path, new TextEncoder().encode(JSON.stringify(journal)));

        // Save to database
        await this.database.saveJournal(journal);

        // Trigger daily receipts generation (async)
        this.generateDailyReceipts(journal).catch((err) =>
          console.error('Error generating daily receipts:', err)
        );

        res.json({ messageId, status: 'received' });
      } catch (error) {
        console.error('Error receiving journal:', error);
        res.status(500).json({ error: 'Failed to save journal' });
      }
    });

    /**
     * POST /api/anomaly
     * PEM reports connection errors or anomalies
     */
    this.router.post('/api/anomaly', async (req: Request, res: Response) => {
      try {
        const anomaly = req.body;
        await this.reportAnomaly(anomaly);
        res.json({ status: 'recorded' });
      } catch (error) {
        console.error('Error recording anomaly:', error);
        res.status(500).json({ error: 'Failed to record anomaly' });
      }
    });

    this.app.use(this.router);
  }

  /**
   * Generate random seed for PEM session
   */
  private generateSeed(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let seed = '';
    for (let i = 0; i < 32; i++) {
      seed += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return seed;
  }

  /**
   * Validate document structure
   */
  private validateDocument(doc: DocumentoCommerciale): boolean {
    return !!(
      doc.datiGenerali?.numero &&
      doc.datiGenerali?.dataOra &&
      doc.identificativoPEM &&
      doc.contribuente &&
      doc.dettaglioLinee &&
      doc.datiRiepilogo
    );
  }

  /**
   * Validate journal structure
   */
  private validateJournal(journal: Journal): boolean {
    return !!(
      journal.versione &&
      journal.identificativoPEM &&
      journal.dataRiferimento &&
      journal.dataOraGenerazione &&
      journal.voci &&
      Array.isArray(journal.voci)
    );
  }

  /**
   * Verify journal hash chain integrity
   * Validates the cryptographic hash chain to ensure journal hasn't been tampered with
   *
   * Note: The Journal type from @openade/common uses VoceGiornale which doesn't include
   * hash fields. In production, you would need to extend the Journal type to include
   * hash chain information or verify hashes from stored journal entries.
   */
  private async verifyJournalIntegrity(journal: Journal): Promise<boolean> {
    if (!journal.voci || journal.voci.length === 0) {
      console.warn('Journal has no entries to verify');
      return false;
    }

    try {
      // Basic validation: check all entries are sequential and complete
      for (let i = 0; i < journal.voci.length; i++) {
        const entry = journal.voci[i];

        // Verify sequential numbering
        if (entry.numeroProgressivo !== i + 1) {
          console.error(
            `Journal entry numbering error at ${i}: expected ${i + 1}, got ${entry.numeroProgressivo}`
          );
          return false;
        }

        // Verify all required fields
        if (!entry.dataOra || !entry.tipo || entry.importo === undefined) {
          console.error(`Journal entry ${i} missing required fields`);
          return false;
        }
      }

      // Verify total amount matches sum of entries
      const calculatedTotal = journal.voci.reduce((sum, entry) => sum + entry.importo, 0);
      const expectedTotal = journal.importoTotaleGiornata;

      if (Math.abs(calculatedTotal - expectedTotal) > 0.01) {
        console.error(
          `Journal total mismatch: calculated=${calculatedTotal}, expected=${expectedTotal}`
        );
        return false;
      }

      console.log(
        `✓ Journal integrity verified (${journal.voci.length} entries, €${calculatedTotal.toFixed(2)})`
      );
      return true;
    } catch (error) {
      console.error('Error verifying journal integrity:', error);
      return false;
    }
  }

  /**
   * Report anomaly to be transmitted to ADE
   */
  private async reportAnomaly(anomaly: {
    type: string;
    pemId: string;
    details: string;
    timestamp: string;
  }): Promise<void> {
    console.warn('Anomaly detected:', anomaly);

    // Store anomaly for ADE transmission
    const path = `anomalies/${anomaly.pemId}/${anomaly.timestamp}.json`;
    await this.storage.store(path, new TextEncoder().encode(JSON.stringify(anomaly)));
  }

  /**
   * Generate daily receipts (Corrispettivi Giornalieri) from journal
   * Aggregates all documents in the journal and transmits to ADE
   */
  private async generateDailyReceipts(journal: Journal): Promise<void> {
    try {
      console.log(
        `Generating daily receipts for PEM ${journal.identificativoPEM} on ${journal.dataRiferimento}`
      );

      // Get all documents for this journal from database
      const result = await this.database.listDocuments({
        emissionPointId: journal.identificativoPEM,
        dateFrom: journal.dataRiferimento,
        dateTo: journal.dataRiferimento,
      });

      const documents = result.data || [];

      if (documents.length === 0) {
        console.warn('No documents found for journal, skipping daily receipts generation');
        return;
      }

      // Aggregate VAT breakdown
      const vatMap = new Map<
        string,
        { imponibile: number; imposta: number; aliquotaIVA?: number; natura?: string }
      >();
      let totalAmount = 0;

      for (const doc of documents) {
        totalAmount += doc.importoTotale;

        // Aggregate by VAT rate or nature
        for (const riepilogo of doc.datiRiepilogo) {
          const key =
            riepilogo.aliquotaIVA !== undefined
              ? `VAT_${riepilogo.aliquotaIVA}`
              : `NAT_${riepilogo.natura}`;

          const existing = vatMap.get(key);
          if (existing) {
            existing.imponibile += riepilogo.imponibile;
            existing.imposta += riepilogo.imposta;
          } else {
            vatMap.set(key, {
              imponibile: riepilogo.imponibile,
              imposta: riepilogo.imposta,
              aliquotaIVA: riepilogo.aliquotaIVA,
              natura: riepilogo.natura as any,
            });
          }
        }
      }

      // Build CorrispettiviGiornalieri
      const dailyReceipts = {
        versione: '1.0',
        contribuente: {
          partitaIVA: documents[0].contribuente.partitaIVA,
          codiceFiscale: documents[0].contribuente.codiceFiscale,
        },
        identificativoPEM: journal.identificativoPEM,
        dataRiferimento: journal.dataRiferimento,
        dataOraTrasmissione: new Date().toISOString(),
        divisa: 'EUR' as any,
        numeroDocumenti: documents.length,
        importoTotale: totalAmount,
        riepilogoIVA: Array.from(vatMap.values()) as any,
      };

      // Save to database
      await this.database.saveDailyReceipts(dailyReceipts);

      // Transmit to ADE
      const outcome = await this.adeClient.trasmissioneCorrispettivi(dailyReceipts);
      console.log(
        `✓ Daily receipts transmitted: ${documents.length} documents, €${totalAmount.toFixed(2)}`
      );
      console.log(`  VAT breakdown: ${vatMap.size} rates/natures`);
      console.log(`  ADE Outcome: ${outcome.codiceEsito || 'OK'}`);
    } catch (error) {
      console.error('Error generating daily receipts:', error);
      throw error;
    }
  }

  /**
   * Start the server
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`PEL Server listening on port ${this.port}`);
        console.log('Endpoints:');
        console.log(`  GET  /api/session/seed - Get session seed for PEM`);
        console.log(`  POST /api/document - Receive document from PEM`);
        console.log(`  POST /api/journal - Receive journal from PEM`);
        console.log(`  POST /api/anomaly - Receive anomaly report from PEM`);
        resolve();
      });
    });
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}
