/**
 * Audit Server - REST APIs for ADE Audit Queries
 *
 * Implements "API REST Audit Esposti Erogatore" specifications
 * These are endpoints that YOUR software must EXPOSE for Agenzia delle Entrate to call during audits
 *
 * Based on: Allegato–SSW-Api Rest Audit Esposti Erogatore.pdf
 */

import type { DocumentoCommerciale, Journal } from '@openade/common';
import express, { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import type { IDatabase } from './database.interface';
import type { IStorage } from './storage.interface';

/**
 * Audit request status
 */
export enum AuditRequestStatus {
  PRONTA = 'PRONTA', // Ready - files can be downloaded
  IN_ELABORAZIONE = 'IN_ELABORAZIONE', // Processing
  NON_DISPONIBILE = 'NON_DISPONIBILE', // No longer available
}

/**
 * Audit job information
 */
interface AuditJob {
  id: string;
  type: 'journal' | 'dc';
  status: AuditRequestStatus;
  requestData: Record<string, unknown>;
  files: Array<{ nome: string; size: string }>;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Audit server configuration
 */
export interface AuditServerConfig {
  /** Port to listen on */
  port: number;
  /** Storage implementation for document retrieval */
  storage: IStorage;
  /** Database implementation for queries (optional) */
  database?: IDatabase;
  /** Authentication middleware */
  authMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
  /** Enable CORS */
  enableCORS?: boolean;
  /** Job retention time in milliseconds (default: 24 hours) */
  jobRetentionMs?: number;
}

/**
 * Audit Server
 * Exposes endpoints for ADE to query your fiscal data
 */
export class AuditServer {
  private app: express.Application;
  private config: AuditServerConfig;
  private jobs: Map<string, AuditJob> = new Map();
  private server: Server | null = null;

  constructor(config: AuditServerConfig) {
    this.config = {
      jobRetentionMs: 24 * 60 * 60 * 1000, // 24 hours default
      ...config,
    };
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.startJobCleanup();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // JSON body parser
    this.app.use(express.json());

    // Raw body parser for XML/octet-stream
    this.app.use(express.raw({ type: 'application/octet-stream', limit: '50mb' }));

    // CORS if enabled
    if (this.config.enableCORS) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      });
    }

    // Authentication middleware if provided
    if (this.config.authMiddleware) {
      this.app.use(this.config.authMiddleware);
    }

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      console.error('Error:', err);
      res.status(500).json({
        anomalie: [
          {
            codice: 'ERR_INTERNAL',
            descrizione: 'Errore non previsto',
          },
        ],
      });
    });
  }

  /**
   * Setup API routes according to specifications
   */
  private setupRoutes(): void {
    // ============================================
    // Audit Journal APIs
    // ============================================

    /**
     * POST /audit/journal
     * Request journal audit (ADE calls this)
     */
    this.app.post('/audit/journal', async (req: Request, res: Response) => {
      try {
        // Create job with unique ID
        const idPresaInCarico = randomUUID();

        const job: AuditJob = {
          id: idPresaInCarico,
          type: 'journal',
          status: AuditRequestStatus.IN_ELABORAZIONE,
          requestData: req.body,
          files: [],
          createdAt: new Date(),
        };

        this.jobs.set(idPresaInCarico, job);

        // Process async
        this.processJournalAudit(job).catch((err) => {
          console.error('Error processing journal audit:', err);
          job.status = AuditRequestStatus.NON_DISPONIBILE;
        });

        res.status(200).json({ idPresaInCarico });
      } catch (error) {
        res.status(500).json({
          anomalie: [{ codice: 'ERR_INTERNAL', descrizione: 'Errore non previsto' }],
        });
      }
    });

    /**
     * GET /audit/journal/{idPresaInCarico}/stato
     * Check journal audit status
     */
    this.app.get('/audit/journal/:idPresaInCarico/stato', (req: Request, res: Response) => {
      const job = this.jobs.get(req.params.idPresaInCarico);

      if (!job || job.type !== 'journal') {
        return res.status(404).json({
          anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'Richiesta di Audit non trovata' }],
        });
      }

      res.status(200).json({ stato: job.status });
    });

    /**
     * GET /audit/journal/{idPresaInCarico}
     * Get list of journal files
     */
    this.app.get('/audit/journal/:idPresaInCarico', (req: Request, res: Response) => {
      const job = this.jobs.get(req.params.idPresaInCarico);

      if (!job || job.type !== 'journal') {
        return res.status(404).json({
          anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'IdPresoinCarico non trovato' }],
        });
      }

      if (job.status !== AuditRequestStatus.PRONTA) {
        return res.status(409).json({
          anomalie: [
            {
              codice: 'ERR_NOT_READY',
              descrizione: 'Richiesta correttamente elaborata ma requisiti non soddisfatti',
            },
          ],
        });
      }

      res.status(200).json({ archivi: job.files });
    });

    /**
     * GET /audit/journal/{idPresaInCarico}/zip/{nomeFile}
     * Download specific journal file
     */
    this.app.get(
      '/audit/journal/:idPresaInCarico/zip/:nomeFile',
      async (req: Request, res: Response) => {
        const job = this.jobs.get(req.params.idPresaInCarico);

        if (!job || job.type !== 'journal') {
          return res.status(404).json({
            anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'IdPresoInCarico non trovato' }],
          });
        }

        try {
          const filePath = `audit/journal/${job.id}/${req.params.nomeFile}`;
          const fileData = await this.config.storage.retrieve(filePath);

          if (!fileData) {
            return res.status(404).json({
              anomalie: [{ codice: 'ERR_FILE_NOT_FOUND', descrizione: 'File non trovato' }],
            });
          }

          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${req.params.nomeFile}"`);
          res.send(fileData);
        } catch (error) {
          res.status(500).json({
            anomalie: [{ codice: 'ERR_INTERNAL', descrizione: 'Errore non previsto' }],
          });
        }
      }
    );

    // ============================================
    // Audit Commercial Documents APIs
    // ============================================

    /**
     * POST /audit/dc
     * Request document audit by hash list (ADE calls this)
     */
    this.app.post('/audit/dc', async (req: Request, res: Response) => {
      try {
        const { hash } = req.body;

        if (!hash || !Array.isArray(hash)) {
          return res.status(406).json({
            anomalie: [
              { codice: 'ERR_INVALID_PARAMS', descrizione: 'Parametri di input non validi' },
            ],
          });
        }

        const idPresaInCarico = randomUUID();

        const job: AuditJob = {
          id: idPresaInCarico,
          type: 'dc',
          status: AuditRequestStatus.IN_ELABORAZIONE,
          requestData: { hash },
          files: [],
          createdAt: new Date(),
        };

        this.jobs.set(idPresaInCarico, job);

        // Process async
        this.processDocumentAudit(job).catch((err) => {
          console.error('Error processing document audit:', err);
          job.status = AuditRequestStatus.NON_DISPONIBILE;
        });

        res.status(200).json({ idPresaInCarico });
      } catch (error) {
        res.status(500).json({
          anomalie: [{ codice: 'ERR_INTERNAL', descrizione: 'Errore non previsto' }],
        });
      }
    });

    /**
     * GET /audit/dc/{idPresaInCarico}/stato
     * Check document audit status
     */
    this.app.get('/audit/dc/:idPresaInCarico/stato', (req: Request, res: Response) => {
      const job = this.jobs.get(req.params.idPresaInCarico);

      if (!job || job.type !== 'dc') {
        return res.status(404).json({
          anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'Richiesta non trovata' }],
        });
      }

      res.status(200).json({ stato: job.status });
    });

    /**
     * GET /audit/dc/{idPresaInCarico}
     * Get list of document files
     */
    this.app.get('/audit/dc/:idPresaInCarico', (req: Request, res: Response) => {
      const job = this.jobs.get(req.params.idPresaInCarico);

      if (!job || job.type !== 'dc') {
        return res.status(404).json({
          anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'IdPresoinCarico non trovato' }],
        });
      }

      if (job.status !== AuditRequestStatus.PRONTA) {
        return res.status(409).json({
          anomalie: [
            {
              codice: 'ERR_NOT_READY',
              descrizione: 'Richiesta correttamente elaborata ma requisiti non soddisfatti',
            },
          ],
        });
      }

      res.status(200).json({ dc: job.files });
    });

    /**
     * GET /audit/dc/{idPresaInCarico}/files/{nomeFile}
     * Download specific document file
     */
    this.app.get(
      '/audit/dc/:idPresaInCarico/files/:nomeFile',
      async (req: Request, res: Response) => {
        const job = this.jobs.get(req.params.idPresaInCarico);

        if (!job || job.type !== 'dc') {
          return res.status(404).json({
            anomalie: [{ codice: 'ERR_NOT_FOUND', descrizione: 'IdPresoInCarico non trovato' }],
          });
        }

        try {
          const filePath = `audit/dc/${job.id}/${req.params.nomeFile}`;
          const fileData = await this.config.storage.retrieve(filePath);

          if (!fileData) {
            return res.status(404).json({
              anomalie: [{ codice: 'ERR_FILE_NOT_FOUND', descrizione: 'File non trovato' }],
            });
          }

          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename="${req.params.nomeFile}"`);
          res.send(fileData);
        } catch (error) {
          res.status(500).json({
            anomalie: [{ codice: 'ERR_INTERNAL', descrizione: 'Errore non previsto' }],
          });
        }
      }
    );
  }

  /**
   * Process journal audit request asynchronously
   * Queries database, retrieves journals, creates ZIP archive
   */
  private async processJournalAudit(job: AuditJob): Promise<void> {
    try {
      console.log(`Processing journal audit request ${job.id}`);

      const { emissionPointId, dateFrom, dateTo } = job.requestData;

      // Query database for journals in date range
      const result = await this.config.database!.listJournals({
        emissionPointId: emissionPointId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });

      const journals = result.data || [];

      if (journals.length === 0) {
        console.warn('No journals found for audit request');
        job.status = AuditRequestStatus.NON_DISPONIBILE;
        return;
      }

      console.log(`Found ${journals.length} journals for audit`);

      // Create ZIP file with journals
      const encoder = new TextEncoder();
      const files: Array<{ nome: string; size: string }> = [];

      for (const journal of journals) {
        // Generate XML for journal
        const journalXML = this.generateJournalXML(journal);
        const xmlData = encoder.encode(journalXML);

        // Create filename: J_Progressivo_MatricolaPEM_DataChiusura.xml
        const dateStr = journal.dataRiferimento.replace(/[:-]/g, '');
        const fileName = `J_${journal.identificativoPEM}_${dateStr}.xml`;

        // Store in audit folder
        await this.config.storage.store(`audit/journal/${job.id}/${fileName}`, xmlData);

        files.push({
          nome: fileName,
          size: xmlData.length.toString(),
        });
      }

      // Create ZIP archive name
      const zipFileName = `journal_audit_${job.id}.zip`;

      // In production, you would:
      // 1. Use a ZIP library to compress all XML files
      // 2. Store the ZIP file
      // For now, we store individual files and list them

      job.files = files;
      job.status = AuditRequestStatus.PRONTA;
      job.completedAt = new Date();

      console.log(`✓ Journal audit completed: ${files.length} files ready`);
    } catch (error) {
      console.error('Failed to process journal audit:', error);
      job.status = AuditRequestStatus.NON_DISPONIBILE;
    }
  }

  /**
   * Generate XML representation of journal
   * Simple implementation - in production use proper XML builder
   */
  private generateJournalXML(journal: Journal): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Journal versione="${journal.versione}">
  <IdentificativoPEM>${journal.identificativoPEM}</IdentificativoPEM>
  <DataRiferimento>${journal.dataRiferimento}</DataRiferimento>
  <DataOraGenerazione>${journal.dataOraGenerazione}</DataOraGenerazione>
  <NumeroVoci>${journal.numeroVoci || (journal.voci ? journal.voci.length : 0)}</NumeroVoci>
  <ImportoTotaleGiornata>${journal.importoTotaleGiornata || 0}</ImportoTotaleGiornata>
</Journal>`;
  }

  /**
   * Process document audit request asynchronously
   * Retrieves commercial documents by hash and prepares for download
   */
  private async processDocumentAudit(job: AuditJob): Promise<void> {
    try {
      console.log(`Processing document audit request ${job.id}`);

      const { hash, emissionPointId, dateFrom, dateTo } = job.requestData;
      const encoder = new TextEncoder();
      const files: Array<{ nome: string; size: string }> = [];

      // Query by hash if provided
      if (hash && Array.isArray(hash)) {
        for (const documentHash of hash) {
          try {
            // Query database for document by hash (if method exists)
            let document = null;
            if (this.config.database && this.config.database.getDocumentByHash) {
              document = await this.config.database.getDocumentByHash(documentHash);
            }

            if (!document) {
              console.warn(
                `Document with hash ${documentHash} not found or method not implemented`
              );
              continue;
            }

            // Generate XML for document
            const docXML = this.generateDocumentXML(document);
            const xmlData = encoder.encode(docXML);

            // Create filename: DC_NumeroDC_MatricolaPEM_DataEmissione.xml
            const dateStr = document.datiGenerali.dataOra.substring(0, 10).replace(/[:-]/g, '');
            const fileName = `DC_${document.datiGenerali.numero}_${document.identificativoPEM}_${dateStr}.xml`;

            // Store in audit folder
            await this.config.storage.store(`audit/dc/${job.id}/${fileName}`, xmlData);

            files.push({
              nome: fileName,
              size: xmlData.length.toString(),
            });
          } catch (err) {
            console.error(`Error processing document hash ${documentHash}:`, err);
          }
        }
      }
      // Query by date range and PEM if no hashes provided
      else if (emissionPointId || (dateFrom && dateTo)) {
        const result = await this.config.database!.listDocuments({
          emissionPointId: emissionPointId as string | undefined,
          dateFrom: dateFrom as string | undefined,
          dateTo: dateTo as string | undefined,
        });

        const documents = result.data || [];

        console.log(`Found ${documents.length} documents for audit`);

        for (const document of documents) {
          const docXML = this.generateDocumentXML(document);
          const xmlData = encoder.encode(docXML);

          const dateStr = document.datiGenerali.dataOra.substring(0, 10).replace(/[:-]/g, '');
          const fileName = `DC_${document.datiGenerali.numero}_${document.identificativoPEM}_${dateStr}.xml`;

          await this.config.storage.store(`audit/dc/${job.id}/${fileName}`, xmlData);

          files.push({
            nome: fileName,
            size: xmlData.length.toString(),
          });
        }
      }

      if (files.length === 0) {
        console.warn('No documents found for audit request');
        job.status = AuditRequestStatus.NON_DISPONIBILE;
        return;
      }

      job.files = files;
      job.status = AuditRequestStatus.PRONTA;
      job.completedAt = new Date();

      console.log(`✓ Document audit completed: ${files.length} files ready`);
    } catch (error) {
      console.error('Failed to process document audit:', error);
      job.status = AuditRequestStatus.NON_DISPONIBILE;
    }
  }

  /**
   * Generate XML representation of commercial document
   * Simple implementation - in production use proper XML builder from common package
   */
  private generateDocumentXML(document: DocumentoCommerciale): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<DocumentoCommerciale>
  <IdentificativoPEM>${document.identificativoPEM}</IdentificativoPEM>
  <DatiGenerali>
    <Numero>${document.datiGenerali.numero}</Numero>
    <DataOra>${document.datiGenerali.dataOra}</DataOra>
    <TipoDocumento>${document.datiGenerali.tipoDocumento}</TipoDocumento>
  </DatiGenerali>
  <ImportoTotale>${document.importoTotale}</ImportoTotale>
</DocumentoCommerciale>`;
  }

  /**
   * Start background job cleanup
   */
  private startJobCleanup(): void {
    setInterval(
      () => {
        const now = Date.now();
        const retentionMs = this.config.jobRetentionMs!;

        for (const [id, job] of this.jobs.entries()) {
          const jobAge = now - job.createdAt.getTime();
          if (jobAge > retentionMs) {
            this.jobs.delete(id);
            console.log(`Cleaned up expired job: ${id}`);
          }
        }
      },
      60 * 60 * 1000
    ); // Run every hour
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log(`Audit server listening on port ${this.config.port}`);
        console.log(`Endpoints:`);
        console.log(`  POST /audit/journal - Request journal audit`);
        console.log(`  GET  /audit/journal/{id}/stato - Check journal status`);
        console.log(`  GET  /audit/journal/{id} - List journal files`);
        console.log(`  GET  /audit/journal/{id}/zip/{file} - Download journal file`);
        console.log(`  POST /audit/dc - Request document audit`);
        console.log(`  GET  /audit/dc/{id}/stato - Check document status`);
        console.log(`  GET  /audit/dc/{id} - List document files`);
        console.log(`  GET  /audit/dc/{id}/files/{file} - Download document file`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get Express app instance (for testing)
   */
  getApp(): express.Application {
    return this.app;
  }
}
