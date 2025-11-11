# @openade/pem

Libreria Punto di Emissione per scontrini fiscali e documenti commerciali italiani.

## Funzionalità

- 🧾 Emissione documenti commerciali con generazione PDF
- 📊 Generazione codice a barre Data Matrix
- 📝 Registro hash-chain per immutabilità
- 🔄 Sincronizzazione PEM → PEL in tempo reale
- 🎲 Codici lotteria istantanei/differiti
- 💾 Interfaccia storage flessibile
- 📱 Supporto per vari tipi di dispositivi

## Installazione

```bash
npm install @openade/pem @openade/common
```

## Guida Rapida

### 1. Crea Manager PEM

```typescript
import { PEMManager, EmissionPointType } from '@openade/pem';

const pem = new PEMManager(
  {
    deviceType: EmissionPointType.SOFTWARE_SOLUTION,
    serialNumber: 'PEM001',
    vatNumber: '12345678901',
    businessName: 'My Shop SRL',
    pelUrl: 'https://pel.example.com', // Opzionale: per sincronizzazione in tempo reale
  },
  myStorage
);
```

### 2. Apri Sessione Vendita

```typescript
await pem.openSession();
```

### 3. Emetti Scontrino

```typescript
const lines = [
  {
    description: 'Prodotto 1',
    quantity: 2,
    unitPrice: 10.0,
    vatRate: 22,
  },
  {
    description: 'Prodotto 2',
    quantity: 1,
    unitPrice: 25.0,
    vatRate: 22,
  },
];

const result = await pem.emitReceipt(lines);

console.log('Documento:', result.document);
console.log('Hash:', result.hash);
console.log('Sincronizzato:', result.synced);
```

### 4. Chiudi Sessione

```typescript
await pem.closeSession();
```

## Costruttore Documenti

Crea documenti manualmente:

```typescript
import { DocumentBuilder } from '@openade/pem';

const builder = new DocumentBuilder({
  vatNumber: '12345678901',
  businessName: 'My Company',
  pemId: 'PEM001',
});

const document = builder
  .setNumber('0001-0001')
  .setDateTime(new Date().toISOString())
  .addLine('Prodotto', 10.0, 22, 1)
  .addPayment('CASH', 10.0)
  .build();
```

## Generazione PDF

Genera PDF con Data Matrix:

```typescript
import { generateCommercialDocumentPDF } from '@openade/pem';

const pdfBuffer = await generateCommercialDocumentPDF(document, {
  includeDataMatrix: true,
  dataMatrixSize: 200,
});
```

## Gestione Registro

Accedi al registro hash-chain:

```typescript
const journal = pem.getJournal();
const entries = journal.getEntries();
const lastHash = journal.getLastHash();
```

## Codici Lotteria

Genera codici lotteria:

```typescript
import { LotteryGenerator } from '@openade/pem';

const generator = new LotteryGenerator({
  vatNumber: '12345678901',
  deviceId: 'PEM001',
});

// Lotteria istantanea
const instantCode = generator.generateInstantLottery();

// Lotteria differita (per il giorno successivo)
const deferredCode = generator.generateDeferredLottery();
```

## Interfaccia Storage

Implementa `IPEMStorage` per storage personalizzato:

```typescript
import { IPEMStorage } from '@openade/pem';

class MyStorage implements IPEMStorage {
  async saveDocument(number: string, document: DocumentoCommerciale): Promise<void> {
    // Salva documento
  }

  async loadDocument(number: string): Promise<DocumentoCommerciale | null> {
    // Carica documento
  }

  async saveJournal(entries: JournalEntry[]): Promise<void> {
    // Salva registro
  }

  async loadJournal(): Promise<JournalEntry[]> {
    // Carica registro
  }
}
```

## Client PEL

Connetti al server PEL per sincronizzazione in tempo reale:

```typescript
import { PELClient } from '@openade/pem';

const pelClient = new PELClient({
  pelBaseUrl: 'https://pel.example.com',
});

// Ottieni seed sessione
const { seed } = await pelClient.getSessionSeed();

// Invia documento
const result = await pelClient.sendDocument(document);
```

## Tipi Dispositivo

- **SOFTWARE_SOLUTION**: Soluzione software
- **HARDWARE_DEVICE**: Dispositivo hardware
- **MOBILE_APP**: Applicazione mobile
- **WEB_APP**: Applicazione web

## Riferimento API

### PEMManager

```typescript
class PEMManager {
  constructor(config: PEMConfig, storage: IPEMStorage);
  openSession(): Promise<void>;
  closeSession(): Promise<void>;
  emitReceipt(
    lines: DocumentLine[]
  ): Promise<{ document: DocumentoCommerciale; hash: string; synced: boolean }>;
  getJournal(): JournalManager;
  syncWithPEL(): Promise<void>;
}
```

### DocumentBuilder

```typescript
class DocumentBuilder {
  constructor(config: DocumentBuilderConfig);
  setNumber(number: string): DocumentBuilder;
  setDateTime(dateTime: string): DocumentBuilder;
  addLine(
    description: string,
    unitPrice: number,
    vatRate: number,
    quantity?: number
  ): DocumentBuilder;
  addPayment(method: string, amount: number): DocumentBuilder;
  build(): DocumentoCommerciale;
}
```

### JournalManager

```typescript
class JournalManager {
  openCash(): void;
  closeCash(): void;
  addDocument(document: DocumentoCommerciale): string;
  getEntries(): JournalEntry[];
  getLastHash(): string;
  validateChain(): boolean;
}
```

## Esempi

Vedi `examples/pem/` per esempi completi funzionanti.

## Specifiche

Basato su:

- Specifiche SSW (Soluzione Software) v1.1
- Regolamenti scontrini fiscali italiani
- Documentazione tecnica Agenzia delle Entrate

## Licenza

MIT

## Disclaimer

Questa libreria non è affiliata con l'Agenzia delle Entrate. Utilizzare a proprio rischio.
