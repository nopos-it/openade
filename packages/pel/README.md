# @openade/pel

Libreria server Punto di Elaborazione per gestire PEM, comunicare con ADE e gestire audit.

## Funzionalità

- 🖥️ Server PEL per ricevere dati da dispositivi PEM
- 🔍 Server audit per richieste audit asincrone
- 🌐 Client API ADE per trasmissione ad Agenzia delle Entrate
- 📊 Polling esiti da ADE
- 🚨 Gestione e segnalazione anomalie
- 📋 Generazione metadati per archivi
- 💾 Interfacce storage e database flessibili
- 🔄 Sincronizzazione PEM in tempo reale

## Installazione

```bash
npm install @openade/pel @openade/common
```

## Guida Rapida

### 1. Crea Server PEL

```typescript
import { PELServer } from '@openade/pel';

const pelServer = new PELServer({
  port: 4000,
  storage: myStorage,
  database: myDatabase,
});

await pelServer.start();
console.log('Server PEL avviato sulla porta 4000');
```

### 2. Crea Server Audit

```typescript
import { AuditServer } from '@openade/pel';

const auditServer = new AuditServer({
  port: 3000,
  storage: myStorage,
  database: myDatabase,
});

await auditServer.start();
console.log('Server Audit avviato sulla porta 3000');
```

### 3. Client API ADE

```typescript
import { ADEClient } from '@openade/pel';

const adeClient = new ADEClient({
  baseURL: 'https://test.agenziaentrate.gov.it/api',
  authToken: 'your-auth-token',
  debug: true,
});

// Invia censimento punto emissione
const censusResult = await adeClient.sendEmissionPointCensus(censusData);

// Invia scontrini giornalieri
const receiptsResult = await adeClient.sendDailyReceipts(receiptsData);
```

## Server PEL

Il server PEL riceve dati da dispositivi PEM:

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

// Gestisci connessioni PEM
server.on('pemConnected', (pemId) => {
  console.log(`PEM ${pemId} connesso`);
});

server.on('documentReceived', (document) => {
  console.log('Documento ricevuto:', document.number);
});

await server.start();
```

## Server Audit

Gestisci richieste audit asincrone:

```typescript
import { AuditServer, AuditRequestStatus } from '@openade/pel';

const auditServer = new AuditServer({
  port: 3000,
  storage: myStorage,
  database: myDatabase,
});

// Gestisci richieste audit
auditServer.on('auditRequest', async (request) => {
  console.log('Richiesta audit ricevuta:', request.id);

  // Elabora richiesta audit
  const result = await processAuditRequest(request);

  // Aggiorna stato
  await auditServer.updateRequestStatus(request.id, AuditRequestStatus.COMPLETED);
});

await auditServer.start();
```

## Poller Esiti

Esegui polling per esiti trasmissione da ADE:

```typescript
import { OutcomePoller } from '@openade/pel';

const poller = new OutcomePoller({
  adeClient,
  database: myDatabase,
  pollInterval: 30000, // 30 secondi
});

// Avvia polling
await poller.start();

// Gestisci esiti
poller.on('outcomeReceived', (outcome) => {
  console.log('Esito ricevuto:', outcome.transmissionId);
});
```

## Gestore Anomalie

Gestisci e segnala anomalie:

```typescript
import { AnomalyManager, AnomalyType } from '@openade/pel';

const anomalyManager = new AnomalyManager({
  storage: myStorage,
  database: myDatabase,
});

// Segnala anomalia
await anomalyManager.reportAnomaly({
  type: AnomalyType.TRANSMISSION_FAILURE,
  description: 'Trasmissione ad ADE fallita',
  details: { error: 'Timeout di rete' },
  timestamp: new Date(),
});

// Ottieni report anomalie
const report = await anomalyManager.generateReport({
  fromDate: new Date('2024-01-01'),
  toDate: new Date('2024-01-31'),
});
```

## Costruttore Metadati

Genera metadati per archivi:

```typescript
import { generateMetadataXML, createArchiveMetadata } from '@openade/pel';

// Genera metadati registro
const journalMetadata = generateMetadataXML({
  type: 'journal',
  period: {
    from: '2024-01-01',
    to: '2024-01-31',
  },
  documents: journalEntries,
});

// Crea metadati archivio
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

## Interfaccia Storage

Implementa `IStorage` per storage personalizzato:

```typescript
import { IStorage } from '@openade/pel';

class MyStorage implements IStorage {
  async save(key: string, data: any): Promise<void> {
    // Salva dati
  }

  async load(key: string): Promise<any> {
    // Carica dati
  }

  async delete(key: string): Promise<void> {
    // Elimina dati
  }

  async list(prefix?: string): Promise<string[]> {
    // Elenca chiavi
  }
}
```

## Interfaccia Database

Implementa `IDatabase` per database personalizzato:

```typescript
import { IDatabase } from '@openade/pel';

class MyDatabase implements IDatabase {
  async query<T>(filter: QueryFilter): Promise<QueryResult<T>> {
    // Interroga database
  }

  async saveAuditLog(entry: AuditLogEntry): Promise<void> {
    // Salva log audit
  }

  async getAuditLogs(filter: QueryFilter): Promise<QueryResult<AuditLogEntry>> {
    // Ottieni log audit
  }
}
```

## Interfaccia Conservazione

Implementa `IConservation` per conservazione documenti:

```typescript
import { IConservation } from '@openade/pel';

class MyConservation implements IConservation {
  async conserveDocuments(documents: DocumentoCommerciale[]): Promise<ConservationPackage> {
    // Conserva documenti
  }

  async conserveJournals(journals: Journal[]): Promise<ConservationPackage> {
    // Conserva registri
  }

  async getConservationStats(filter: ConservationFilter): Promise<ConservationStats> {
    // Ottieni statistiche conservazione
  }
}
```

## Riferimento API

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

## Esempi

Vedi `examples/pel/` per esempi completi funzionanti.

## Specifiche

Basato su:

- Specifiche SSW (Soluzione Software) v1.1
- Documentazione API REST Agenzia delle Entrate
- Regolamenti fiscali italiani

## Licenza

MIT

## Disclaimer

Questa libreria non è affiliata con l'Agenzia delle Entrate. Utilizzare a proprio rischio.
