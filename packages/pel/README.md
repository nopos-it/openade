# @openade/pel

Point of Elaboration (Punto di Elaborazione) server library for managing PEMs, communicating with ADE, and handling audits.

## Features

- 🖥️ PEL server for receiving data from PEM devices
- 🔍 Audit server for asynchronous audit requests
- 🌐 ADE API client for transmission to Agenzia delle Entrate
- 📊 Outcome polling from ADE
- 🚨 Anomaly management and reporting
- 📋 Metadata generation for archives
- 💾 Flexible storage and database interfaces
- 🔄 Real-time PEM synchronization

## Installation

```bash
npm install @openade/pel @openade/common
```

## Quick Start

### 1. Create PEL Server

```typescript
import { PELServer } from '@openade/pel';

const pelServer = new PELServer({
  port: 4000,
  storage: myStorage,
  database: myDatabase,
});

await pelServer.start();
console.log('PEL Server started on port 4000');
```

### 2. Create Audit Server

```typescript
import { AuditServer } from '@openade/pel';

const auditServer = new AuditServer({
  port: 3000,
  storage: myStorage,
  database: myDatabase,
});

await auditServer.start();
console.log('Audit Server started on port 3000');
```

### 3. ADE API Client

```typescript
import { ADEClient } from '@openade/pel';

const adeClient = new ADEClient({
  baseURL: 'https://test.agenziaentrate.gov.it/api',
  authToken: 'your-auth-token',
  debug: true,
});

// Send emission point census
const censusResult = await adeClient.sendEmissionPointCensus(censusData);

// Send daily receipts
const receiptsResult = await adeClient.sendDailyReceipts(receiptsData);
```

## PEL Server

The PEL server receives data from PEM devices:

```typescript
import { PELServer } from '@openade/pel';

const server = new PELServer({
  port: 4000,
  storage: myStorage,
  database: myDatabase,
  cors: {
    origin: ['https://pem.example.com'],
    credentials: true,
  },
});

// Handle PEM connections
server.on('pemConnected', (pemId) => {
  console.log(`PEM ${pemId} connected`);
});

server.on('documentReceived', (document) => {
  console.log('Document received:', document.number);
});

await server.start();
```

## Audit Server

Handle asynchronous audit requests:

```typescript
import { AuditServer, AuditRequestStatus } from '@openade/pel';

const auditServer = new AuditServer({
  port: 3000,
  storage: myStorage,
  database: myDatabase,
});

// Handle audit requests
auditServer.on('auditRequest', async (request) => {
  console.log('Audit request received:', request.id);

  // Process audit request
  const result = await processAuditRequest(request);

  // Update status
  await auditServer.updateRequestStatus(request.id, AuditRequestStatus.COMPLETED);
});

await auditServer.start();
```

## Outcome Poller

Poll for transmission outcomes from ADE:

```typescript
import { OutcomePoller } from '@openade/pel';

const poller = new OutcomePoller({
  adeClient,
  database: myDatabase,
  pollInterval: 30000, // 30 seconds
});

// Start polling
await poller.start();

// Handle outcomes
poller.on('outcomeReceived', (outcome) => {
  console.log('Outcome received:', outcome.transmissionId);
});
```

## Anomaly Manager

Manage and report anomalies:

```typescript
import { AnomalyManager, AnomalyType } from '@openade/pel';

const anomalyManager = new AnomalyManager({
  storage: myStorage,
  database: myDatabase,
});

// Report anomaly
await anomalyManager.reportAnomaly({
  type: AnomalyType.TRANSMISSION_FAILURE,
  description: 'Failed to transmit to ADE',
  details: { error: 'Network timeout' },
  timestamp: new Date(),
});

// Get anomaly report
const report = await anomalyManager.generateReport({
  fromDate: new Date('2024-01-01'),
  toDate: new Date('2024-01-31'),
});
```

## Metadata Builder

Generate metadata for archives:

```typescript
import { generateMetadataXML, createArchiveMetadata } from '@openade/pel';

// Generate journal metadata
const journalMetadata = generateMetadataXML({
  type: 'journal',
  period: {
    from: '2024-01-01',
    to: '2024-01-31',
  },
  documents: journalEntries,
});

// Create archive metadata
const archiveMetadata = createArchiveMetadata({
  archiveId: 'ARCH-2024-001',
  period: {
    from: '2024-01-01',
    to: '2024-01-31',
  },
  documents: allDocuments,
  checksums: {
    journal: 'sha256:abc123...',
    documents: 'sha256:def456...',
  },
});
```

## Storage Interface

Implement `IStorage` for custom storage:

```typescript
import { IStorage } from '@openade/pel';

class MyStorage implements IStorage {
  async save(key: string, data: any): Promise<void> {
    // Save data
  }

  async load(key: string): Promise<any> {
    // Load data
  }

  async delete(key: string): Promise<void> {
    // Delete data
  }

  async list(prefix?: string): Promise<string[]> {
    // List keys
  }
}
```

## Database Interface

Implement `IDatabase` for custom database:

```typescript
import { IDatabase } from '@openade/pel';

class MyDatabase implements IDatabase {
  async query<T>(filter: QueryFilter): Promise<QueryResult<T>> {
    // Query database
  }

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    // Save audit log
  }

  async getAuditLogs(filter: QueryFilter): Promise<QueryResult<AuditLogEntry>> {
    // Get audit logs
  }
}
```

## Conservation Interface

Implement `IConservation` for document conservation:

```typescript
import { IConservation } from '@openade/pel';

class MyConservation implements IConservation {
  async conserveDocuments(documents: DocumentoCommerciale[]): Promise<ConservationPackage> {
    // Conserve documents
  }

  async conserveJournals(journals: Journal[]): Promise<ConservationPackage> {
    // Conserve journals
  }

  async getConservationStats(filter: ConservationFilter): Promise<ConservationStats> {
    // Get conservation statistics
  }
}
```

## API Reference

### PELServer

```typescript
class PELServer {
  constructor(config: PELServerConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  on(event: string, handler: Function): void;
}
```

### AuditServer

```typescript
class AuditServer {
  constructor(config: AuditServerConfig);
  start(): Promise<void>;
  stop(): Promise<void>;
  updateRequestStatus(id: string, status: AuditRequestStatus): Promise<void>;
}
```

### ADEClient

```typescript
class ADEClient {
  constructor(config: APIClientConfig);
  sendEmissionPointCensus(census: EmissionPointCensus): Promise<TransmissionOutcome>;
  sendDailyReceipts(receipts: CorrispettiviGiornalieri): Promise<TransmissionOutcome>;
  sendCommercialDocument(document: DocumentoCommerciale): Promise<TransmissionOutcome>;
  sendJournal(journal: Journal): Promise<TransmissionOutcome>;
  sendAnomalies(anomalies: AnomalyReport[]): Promise<TransmissionOutcome>;
}
```

## Examples

See `examples/pel/` for complete working examples.

## Specifications

Based on:

- SSW (Soluzione Software) v1.1 specifications
- Agenzia delle Entrate REST API documentation
- Italian fiscal regulations

## License

MIT

## Disclaimer

This library is not affiliated with Agenzia delle Entrate. Use at your own risk.
