/**
 * PEL Example Project
 * Complete PEL server with all features
 *
 * ARCHITECTURE:
 * PEM (Device) → sends documents in real-time → PEL (Server) → transmits to → ADE
 *                                                ↑
 *                                          Audit queries from ADE
 */

import { ADEClient, AnomalyManager, AuditServer, OutcomePoller, PELServer } from '@nopos-ade/pel';
import sqlite3 from 'sqlite3';
import { FilesystemStorage } from './filesystem.storage';
import { SQLDatabase } from './sql.database';

async function main() {
  console.log('🚀 PEL Server - Complete Setup\n');

  // Create data directory if not exists
  const fs = await import('fs');
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Initialize Components
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const storage = new FilesystemStorage('./data');
  const db = new sqlite3.Database('./data/pel.db');
  const database = new SQLDatabase(db);
  const adeClient = new ADEClient({
    baseURL: 'https://test.agenziaentrate.gov.it/api',
    authToken: 'YOUR_AUTH_TOKEN', // Or use certPath/keyPath for mutual TLS
  });

  console.log('✅ Storage, Database, and ADE Client initialized\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Start PEL Server (receives from PEM)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const pelServer = new PELServer({
    storage,
    database,
    adeClient,
    port: 4000,
  });
  await pelServer.start();
  console.log('✅ PEL Server started (port 4000)\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Start Audit Server (responds to ADE)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const auditServer = new AuditServer({
    storage,
    database,
    port: 3000,
  });
  await auditServer.start();
  console.log('✅ Audit Server started (port 3000)\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Start Outcome Poller (checks ADE responses)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const outcomePoller = new OutcomePoller({
    database,
    adeClient,
    pollingInterval: 5 * 60 * 1000, // 5 minutes
    maxRetries: 288, // 24 hours worth of retries
  });
  outcomePoller.start();
  console.log('✅ Outcome Poller started (5 min intervals)\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Initialize Anomaly Manager (reports issues)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const anomalyManager = new AnomalyManager({
    storage,
    adeClient,
    autoTransmit: true,
    batchSize: 10,
  });
  console.log('✅ Anomaly Manager initialized\n');

  console.log('📡 PEL Endpoints (receives FROM PEM):');
  console.log('   GET  http://localhost:4000/api/session/seed');
  console.log('   POST http://localhost:4000/api/document');
  console.log('   POST http://localhost:4000/api/journal');
  console.log('   POST http://localhost:4000/api/anomaly');
  console.log('');

  console.log('📡 Audit Endpoints (responds TO ADE):');
  console.log('   POST http://localhost:3000/audit/journal');
  console.log('   POST http://localhost:3000/audit/dc');
  console.log('   GET  http://localhost:3000/audit/journal/{id}/stato');
  console.log('   GET  http://localhost:3000/audit/dc/{id}/stato');
  console.log('');

  console.log('💡 Example Data Flow:');
  console.log('   1. PEM emits receipt → POST /api/document (real-time)');
  console.log('   2. PEM closes session → POST /api/journal');
  console.log('   3. PEL aggregates → Daily receipts (Corrispettivi)');
  console.log('   4. PEL transmits → ADE (via ADEClient)');
  console.log('   5. ADE audits → Queries /audit/* endpoints');
  console.log('');

  console.log('✨ PEL Server is running!');
  console.log('');
  console.log('📱 To test with PEM:');
  console.log('   cd examples/pem && npm start');
  console.log('');
  console.log('⏹️  Press Ctrl+C to stop');
}

main().catch(console.error);
