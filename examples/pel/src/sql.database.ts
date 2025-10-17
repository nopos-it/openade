/**
 * SQL Database Implementation
 * Uses sqlite3 for persistent storage
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
import type { AuditLogEntry, IDatabase, QueryFilter, QueryResult } from '@nopos-ade/pel';
import type sqlite3 from 'sqlite3';
import { promisify } from 'util';

export class SQLDatabase implements IDatabase {
  private db: sqlite3.Database;
  private dbRun: (sql: string, params?: unknown[]) => Promise<void>;
  private dbGet: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | undefined>;
  private dbAll: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

  constructor(sqliteInstance: sqlite3.Database) {
    this.db = sqliteInstance;

    // Promisify sqlite3 methods
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));

    // Initialize tables
    this.initTables();
  }

  private async initTables() {
    // Emission Points table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS emission_points (
        vat_number TEXT NOT NULL,
        device_id TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_number, device_id)
      )
    `);

    // Elaboration Points table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS elaboration_points (
        vat_number TEXT NOT NULL,
        device_id TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_number, device_id)
      )
    `);

    // Documents table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS documents (
        vat_number TEXT NOT NULL,
        pem_id TEXT NOT NULL,
        document_number TEXT NOT NULL,
        datetime TEXT NOT NULL,
        hash TEXT,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_number, pem_id, document_number)
      )
    `);

    // Journals table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS journals (
        vat_number TEXT NOT NULL,
        pem_id TEXT NOT NULL,
        reference_date TEXT NOT NULL,
        hash TEXT,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_number, pem_id, reference_date)
      )
    `);

    // Daily Receipts table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS daily_receipts (
        vat_number TEXT NOT NULL,
        pem_id TEXT NOT NULL,
        reference_date TEXT NOT NULL,
        data TEXT NOT NULL,
        outcome TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vat_number, pem_id, reference_date)
      )
    `);

    // Audit Trail table
    await this.dbRun(`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id TEXT,
        metadata TEXT
      )
    `);
  }

  // Emission Points
  async saveEmissionPoint(census: EmissionPointCensus): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO emission_points (vat_number, device_id, data) 
       VALUES (?, ?, ?)`,
      [
        (census as any).contribuente.partitaIVA,
        (census as any).identificativoPEM,
        JSON.stringify(census),
      ]
    );
  }

  async getEmissionPoint(
    vatNumber: string,
    emissionPointId: string
  ): Promise<EmissionPointCensus | null> {
    const row = await this.dbGet<{ data: string }>(
      'SELECT data FROM emission_points WHERE vat_number = ? AND device_id = ?',
      [vatNumber, emissionPointId]
    );
    return row ? JSON.parse(row.data) : null;
  }

  async getEmissionPointStatus(
    vatNumber: string,
    emissionPointId: string
  ): Promise<EmissionPointStatusInfo | null> {
    const row = await this.dbGet<{ status: string }>(
      'SELECT status FROM emission_points WHERE vat_number = ? AND device_id = ?',
      [vatNumber, emissionPointId]
    );
    return row ? JSON.parse(row.status) : null;
  }

  async updateEmissionPointStatus(
    vatNumber: string,
    emissionPointId: string,
    status: EmissionPointStatusInfo
  ): Promise<void> {
    await this.dbRun(
      'UPDATE emission_points SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE vat_number = ? AND device_id = ?',
      [JSON.stringify(status), vatNumber, emissionPointId]
    );
  }

  async deleteEmissionPoint(vatNumber: string, emissionPointId: string): Promise<void> {
    await this.dbRun('DELETE FROM emission_points WHERE vat_number = ? AND device_id = ?', [
      vatNumber,
      emissionPointId,
    ]);
  }

  async listEmissionPoints(filter?: QueryFilter): Promise<QueryResult<EmissionPointCensus>> {
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    const rows = await this.dbAll<{ data: string }>(
      'SELECT data FROM emission_points ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countRow = await this.dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM emission_points'
    );
    const total = countRow?.count || 0;

    const items = rows.map((row) => JSON.parse(row.data) as EmissionPointCensus);
    return {
      items,
      data: items,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  // Elaboration Points
  async saveElaborationPoint(census: ElaborationPointCensus): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO elaboration_points (vat_number, device_id, data) 
       VALUES (?, ?, ?)`,
      [
        (census as any).contribuente.partitaIVA,
        (census as any).identificativoPEL,
        JSON.stringify(census),
      ]
    );
  }

  async getElaborationPoint(
    vatNumber: string,
    elaborationPointId: string
  ): Promise<ElaborationPointCensus | null> {
    const row = await this.dbGet<{ data: string }>(
      'SELECT data FROM elaboration_points WHERE vat_number = ? AND device_id = ?',
      [vatNumber, elaborationPointId]
    );
    return row ? JSON.parse(row.data) : null;
  }

  async getElaborationPointStatus(
    vatNumber: string,
    elaborationPointId: string
  ): Promise<ElaborationPointStatusInfo | null> {
    const row = await this.dbGet<{ status: string }>(
      'SELECT status FROM elaboration_points WHERE vat_number = ? AND device_id = ?',
      [vatNumber, elaborationPointId]
    );
    return row ? JSON.parse(row.status) : null;
  }

  async updateElaborationPointStatus(
    vatNumber: string,
    elaborationPointId: string,
    status: ElaborationPointStatusInfo
  ): Promise<void> {
    await this.dbRun(
      'UPDATE elaboration_points SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE vat_number = ? AND device_id = ?',
      [JSON.stringify(status), vatNumber, elaborationPointId]
    );
  }

  async listElaborationPoints(filter?: QueryFilter): Promise<QueryResult<ElaborationPointCensus>> {
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    const rows = await this.dbAll<{ data: string }>(
      'SELECT data FROM elaboration_points ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countRow = await this.dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM elaboration_points'
    );
    const total = countRow?.count || 0;

    const items = rows.map((row) => JSON.parse(row.data) as ElaborationPointCensus);
    return {
      items,
      data: items,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  // Daily Receipts
  async saveDailyReceipts(receipts: CorrispettiviGiornalieri): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO daily_receipts (vat_number, pem_id, reference_date, data) 
       VALUES (?, ?, ?, ?)`,
      [
        receipts.contribuente.partitaIVA,
        receipts.identificativoPEM,
        receipts.dataRiferimento,
        JSON.stringify(receipts),
      ]
    );
  }

  async getDailyReceipts(
    vatNumber: string,
    pemId: string,
    date: string
  ): Promise<CorrispettiviGiornalieri | null> {
    const row = await this.dbGet<{ data: string }>(
      'SELECT data FROM daily_receipts WHERE vat_number = ? AND pem_id = ? AND reference_date = ?',
      [vatNumber, pemId, date]
    );
    return row ? JSON.parse(row.data) : null;
  }

  async listDailyReceipts(filter?: QueryFilter): Promise<QueryResult<CorrispettiviGiornalieri>> {
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    const rows = await this.dbAll<{ data: string }>(
      'SELECT data FROM daily_receipts ORDER BY reference_date DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countRow = await this.dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM daily_receipts'
    );
    const total = countRow?.count || 0;

    const items = rows.map((row) => JSON.parse(row.data) as CorrispettiviGiornalieri);
    return {
      items,
      data: items,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async saveDailyReceiptsOutcome(outcome: CorrispettiviEsito): Promise<void> {
    await this.dbRun(
      `UPDATE daily_receipts SET outcome = ? 
       WHERE vat_number = ? AND pem_id = ? AND reference_date = ?`,
      [
        JSON.stringify(outcome),
        outcome.partitaIVA,
        outcome.identificativoPEM,
        outcome.dataRiferimento,
      ]
    );
  }

  async getDailyReceiptsOutcome(
    vatNumber: string,
    pemId: string,
    date: string
  ): Promise<CorrispettiviEsito | null> {
    const row = await this.dbGet<{ outcome: string }>(
      'SELECT outcome FROM daily_receipts WHERE vat_number = ? AND pem_id = ? AND reference_date = ?',
      [vatNumber, pemId, date]
    );
    return row?.outcome ? JSON.parse(row.outcome) : null;
  }

  // Documents
  async saveDocument(document: DocumentoCommerciale): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO documents (vat_number, pem_id, document_number, datetime, hash, data) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        document.contribuente.partitaIVA,
        document.identificativoPEM,
        document.datiGenerali.numero,
        document.datiGenerali.dataOra,
        (document as any).hash,
        JSON.stringify(document),
      ]
    );
  }

  async getDocument(
    vatNumber: string,
    pemId: string,
    documentNumber: string
  ): Promise<DocumentoCommerciale | null> {
    const row = await this.dbGet<{ data: string }>(
      'SELECT data FROM documents WHERE vat_number = ? AND pem_id = ? AND document_number = ?',
      [vatNumber, pemId, documentNumber]
    );
    return row ? JSON.parse(row.data) : null;
  }

  async listDocuments(filter?: QueryFilter): Promise<QueryResult<DocumentoCommerciale>> {
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    const rows = await this.dbAll<{ data: string }>(
      'SELECT data FROM documents ORDER BY datetime DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countRow = await this.dbGet<{ count: number }>('SELECT COUNT(*) as count FROM documents');
    const total = countRow?.count || 0;

    const items = rows.map((row) => JSON.parse(row.data) as DocumentoCommerciale);
    return {
      items,
      data: items,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async getDocumentByHash(hash: string): Promise<DocumentoCommerciale | null> {
    const row = await this.dbGet<{ data: string }>('SELECT data FROM documents WHERE hash = ?', [
      hash,
    ]);
    return row ? JSON.parse(row.data) : null;
  }

  async deleteDocument(vatNumber: string, pemId: string, documentNumber: string): Promise<void> {
    await this.dbRun(
      'DELETE FROM documents WHERE vat_number = ? AND pem_id = ? AND document_number = ?',
      [vatNumber, pemId, documentNumber]
    );
  }

  // Journals
  async saveJournal(journal: Journal): Promise<void> {
    await this.dbRun(
      `INSERT OR REPLACE INTO journals (vat_number, pem_id, reference_date, hash, data) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        journal.contribuente.partitaIVA,
        journal.identificativoPEM,
        journal.dataRiferimento,
        (journal as any).hashPrecedente,
        JSON.stringify(journal),
      ]
    );
  }

  async getJournal(vatNumber: string, pemId: string, date: string): Promise<Journal | null> {
    const row = await this.dbGet<{ data: string }>(
      'SELECT data FROM journals WHERE vat_number = ? AND pem_id = ? AND reference_date = ?',
      [vatNumber, pemId, date]
    );
    return row ? JSON.parse(row.data) : null;
  }

  async listJournals(filter?: QueryFilter): Promise<QueryResult<Journal>> {
    const limit = filter?.limit || 100;
    const offset = filter?.offset || 0;

    const rows = await this.dbAll<{ data: string }>(
      'SELECT data FROM journals ORDER BY reference_date DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const countRow = await this.dbGet<{ count: number }>('SELECT COUNT(*) as count FROM journals');
    const total = countRow?.count || 0;

    const items = rows.map((row) => JSON.parse(row.data) as Journal);
    return {
      items,
      data: items,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  // Audit Trail
  async getAuditTrail(
    entityType: string,
    entityId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<AuditLogEntry[]> {
    let query = 'SELECT * FROM audit_trail WHERE entity_type = ? AND entity_id = ?';
    const params: unknown[] = [entityType, entityId];

    if (dateFrom) {
      query += ' AND timestamp >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND timestamp <= ?';
      params.push(dateTo);
    }

    query += ' ORDER BY timestamp DESC';

    const rows = await this.dbAll<{
      entity_type: string;
      entity_id: string;
      action: string;
      timestamp: string;
      user_id?: string;
      metadata?: string;
    }>(query, params);

    return rows.map(
      (row): AuditLogEntry => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        timestamp: row.timestamp,
        userId: row.user_id,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      })
    );
  }

  async saveAuditLog(logEntry: AuditLogEntry): Promise<void> {
    await this.dbRun(
      `INSERT INTO audit_trail (entity_type, entity_id, action, user_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        logEntry.entityType,
        logEntry.entityId,
        logEntry.action,
        logEntry.userId,
        logEntry.metadata ? JSON.stringify(logEntry.metadata) : null,
      ]
    );
  }

  async deleteJournal(vatNumber: string, pemId: string, date: string): Promise<void> {
    await this.dbRun(
      'DELETE FROM journals WHERE vat_number = ? AND pem_id = ? AND reference_date = ?',
      [vatNumber, pemId, date]
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.dbGet('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
