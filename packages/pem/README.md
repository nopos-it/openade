# @openade/pem

Point of Emission (Punto di Emissione) library for Italian fiscal receipts and commercial documents.

## Features

- 🧾 Commercial document emission with PDF generation
- 📊 Data Matrix barcode generation
- 📝 Hash-chained journal for immutability
- 🔄 Real-time PEM → PEL synchronization
- 🎲 Instant/deferred lottery codes
- 💾 Flexible storage interface
- 📱 Support for various device types

## Installation

```bash
npm install @openade/pem @openade/common
```

## Quick Start

### 1. Create PEM Manager

```typescript
import { PEMManager, EmissionPointType } from '@openade/pem';

const pem = new PEMManager(
  {
    deviceType: EmissionPointType.SOFTWARE_SOLUTION,
    serialNumber: 'PEM001',
    vatNumber: '12345678901',
    businessName: 'My Shop SRL',
    pelUrl: 'https://pel.example.com', // Optional: for real-time sync
  },
  myStorage
);
```

### 2. Open Sales Session

```typescript
await pem.openSession();
```

### 3. Emit Receipt

```typescript
const lines = [
  {
    description: 'Product 1',
    quantity: 2,
    unitPrice: 10.0,
    vatRate: 22,
  },
  {
    description: 'Product 2',
    quantity: 1,
    unitPrice: 25.0,
    vatRate: 22,
  },
];

const result = await pem.emitReceipt(lines);

console.log('Document:', result.document);
console.log('Hash:', result.hash);
console.log('Synced:', result.synced);
```

### 4. Close Session

```typescript
await pem.closeSession();
```

## Document Builder

Create documents manually:

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
  .addLine('Product', 10.0, 22, 1)
  .addPayment('CASH', 10.0)
  .build();
```

## PDF Generation

Generate PDF with Data Matrix:

```typescript
import { generateCommercialDocumentPDF } from '@openade/pem';

const pdfBuffer = await generateCommercialDocumentPDF(document, {
  includeDataMatrix: true,
  dataMatrixSize: 200,
});
```

## Journal Management

Access the hash-chained journal:

```typescript
const journal = pem.getJournal();
const entries = journal.getEntries();
const lastHash = journal.getLastHash();
```

## Lottery Codes

Generate lottery codes:

```typescript
import { LotteryGenerator } from '@openade/pem';

const generator = new LotteryGenerator({
  vatNumber: '12345678901',
  deviceId: 'PEM001',
});

// Instant lottery
const instantCode = generator.generateInstantLottery();

// Deferred lottery (for next day)
const deferredCode = generator.generateDeferredLottery();
```

## Storage Interface

Implement `IPEMStorage` for custom storage:

```typescript
import { IPEMStorage } from '@openade/pem';

class MyStorage implements IPEMStorage {
  async saveDocument(number: string, document: DocumentoCommerciale): Promise<void> {
    // Save document
  }

  async loadDocument(number: string): Promise<DocumentoCommerciale | null> {
    // Load document
  }

  async saveJournal(entries: JournalEntry[]): Promise<void> {
    // Save journal
  }

  async loadJournal(): Promise<JournalEntry[]> {
    // Load journal
  }
}
```

## PEL Client

Connect to PEL server for real-time synchronization:

```typescript
import { PELClient } from '@openade/pem';

const pelClient = new PELClient({
  pelBaseUrl: 'https://pel.example.com',
});

// Get session seed
const { seed } = await pelClient.getSessionSeed();

// Send document
const result = await pelClient.sendDocument(document);
```

## Device Types

- **SOFTWARE_SOLUTION**: Software-based solution
- **HARDWARE_DEVICE**: Hardware device
- **MOBILE_APP**: Mobile application
- **WEB_APP**: Web application

## API Reference

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

## Examples

See `examples/pem/` for complete working examples.

## Specifications

Based on:

- SSW (Soluzione Software) v1.1 specifications
- Italian fiscal receipt regulations
- Agenzia delle Entrate technical documentation

## License

MIT

## Disclaimer

This library is not affiliated with Agenzia delle Entrate. Use at your own risk.
