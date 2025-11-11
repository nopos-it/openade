# 📦 openade

[![CI](https://github.com/yourusername/openade/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/openade/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40openade%2Fcommon.svg)](https://www.npmjs.com/package/@openade/common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://hub.docker.com/)

TypeScript library for Italian Agenzia delle Entrate electronic fiscal documents (SSW v1.1, FatturaPA v1.9).

## 🚧 Status

**Version 0.1.0** - In active development, not yet production ready.

## 📦 Packages

- **@openade/common** - Shared types, validators, XML builders
- **@openade/pem** - Point of Emission (device/POS library)
- **@openade/pel** - Elaboration Point (server library)
- **@openade/fe** - Fatturazione Elettronica (Electronic Invoicing for SDI)

## 🚀 Quick Start

### PEM (Point of Emission)

```typescript
import { PEMManager, DocumentBuilder, LotteryGenerator } from '@openade/pem';
import { EmissionPointType } from '@openade/common';

const pem = new PEMManager({
  emissionPointId: 'PEM001',
  taxpayer: {
    vatNumber: '12345678901',
    denomination: 'My Shop SRL',
  },
  emissionPointType: EmissionPointType.SOFTWARE_SOLUTION,
  storage: myStorage,
  pelClient: myPELClient,
});

// Emit receipt
const receipt = new DocumentBuilder()
  .setNumber('0001-0001')
  .setDateTime(new Date().toISOString())
  .addLine('Product 1', 10.0, 22, 1)
  .addPayment('CASH', 10.0)
  .build();

await pem.emitReceipt(receipt);
```

### PEL (Point of Elaboration)

```typescript
import { PELServer, AuditServer, ADEClient } from '@openade/pel';

const pelServer = new PELServer({
  port: 4000,
  storage: myStorage,
  database: myDatabase,
});

const auditServer = new AuditServer({
  port: 3000,
  storage: myStorage,
  database: myDatabase,
});

await pelServer.start();
await auditServer.start();
```

### FE (Fatturazione Elettronica)

```typescript
import { InvoiceBuilder, buildInvoiceXML, SDIClient } from '@openade/fe';

const builder = new InvoiceBuilder({
  supplierVatNumber: '12345678901',
  supplierBusinessName: 'My Company S.r.l.',
  supplierAddress: {
    indirizzo: 'Via Roma 123',
    cap: '00100',
    comune: 'Roma',
    provincia: 'RM',
    nazione: 'IT',
  },
  taxRegime: 'RF01',
});

const invoice = builder.build({
  customer: {
    vatNumber: '98765432109',
    businessName: 'Client S.r.l.',
    address: { indirizzo: 'Via Milano 1', cap: '20100', comune: 'Milano', nazione: 'IT' },
    sdiCode: '0000000',
    pec: 'client@pec.it',
  },
  invoiceNumber: '2024/001',
  invoiceDate: '2024-01-15',
  lines: [{ description: 'Service', quantity: 1, unitPrice: 1000.0, vatRate: 22 }],
  paymentMethod: 'MP05',
});

const xml = buildInvoiceXML(invoice);

// Transmit to SDI
const sdiClient = new SDIClient({
  endpoint: 'https://testservizi.fatturapa.it/services/ricezioneFatture',
  certPath: './certs/client.crt',
  keyPath: './certs/client.key',
});

const result = await sdiClient.sendInvoice(builder.generateFilename(), xml, 'SDICOOP');
```

## ✨ Features

### Electronic Receipts (PEM/PEL)

- ✅ Commercial document emission with PDF + Data Matrix barcode
- ✅ Hash-chained journal for immutability
- ✅ Real-time PEM → PEL synchronization
- ✅ ADE transmission client (REST API)
- ✅ Audit server (asynchronous pattern)
- ✅ Daily receipts aggregation
- ✅ Outcome polling from ADE
- ✅ Anomaly management and reporting
- ✅ Metadata generation for archives
- ✅ Instant/deferred lottery codes
- ✅ Digital conservation interface (abstract)

### Electronic Invoicing (FE)

- ✅ FatturaPA XML generation (FPR12/FPA12 formats)
- ✅ Invoice builder with automatic VAT calculation
- ✅ SDI transmission via SDICOOP/SDIFTP
- ✅ Receipt handler (RC, NS, MC, NE, MT, DT)
- ✅ Support for B2B and B2C invoices
- ✅ Multiple document types (TD01-TD28)
- ✅ Compliant with FatturaPA v1.9 specifications

## 📚 Documentation

See `docs/md/` for technical specifications (Italian).

## 🐳 Docker

Run the complete PEL server with Docker:

```bash
# Build and start
docker-compose up -d

# With PostgreSQL
docker-compose --profile postgres up -d

# With MinIO (S3-compatible storage)
docker-compose --profile s3 up -d

# View logs
docker-compose logs -f pel-server

# Stop
docker-compose down
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
ADE_BASE_URL=https://test.agenziaentrate.gov.it/api
ADE_AUTH_TOKEN=your_token_here
```

## 📦 Installation

```bash
# Install root dependencies + all packages
npm install

# Install everything including examples
npm run install:all

# Install only examples
npm run install:examples
```

## 🏗️ Build

```bash
# Build all packages
npm run build

# Build individual packages
npm run build:common
npm run build:pem
npm run build:pel
npm run build:fe

# Clean build artifacts
npm run clean
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🚀 Run Examples

```bash
# Start PEM example (Point of Sale)
npm run start:pem

# Start PEL example (Server with all features)
npm run start:pel

# Start FE example (Electronic Invoicing)
npm run start:fe

# Development mode with auto-reload
npm run dev:pem
npm run dev:pel
npm run dev:fe
```

## 🎨 Code Quality

```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint code
npm run lint
```

## 📄 License

MIT

## ⚠️ Disclaimer

This library is not affiliated with Agenzia delle Entrate. Use at your own risk.
