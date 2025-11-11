# 📦 openade

[![CI](https://github.com/yourusername/openade/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/openade/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/%40openade%2Fcommon.svg)](https://www.npmjs.com/package/@openade/common)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-blue.svg)](https://hub.docker.com/)

Libreria TypeScript per documenti fiscali elettronici dell'Agenzia delle Entrate (SSW v1.1, FatturaPA v1.9).

## 🚧 Stato

**Versione 0.1.0** - In sviluppo attivo, non ancora pronto per la produzione.

## 📦 Pacchetti

- **@openade/common** - Tipi condivisi, validatori, costruttori XML
- **@openade/pem** - Punto di Emissione (libreria per dispositivi/POS)
- **@openade/pel** - Punto di Elaborazione (libreria server)
- **@openade/fe** - Fatturazione Elettronica (per SDI)

## 🚀 Guida Rapida

### PEM (Punto di Emissione)

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

// Emetti scontrino
const receipt = new DocumentBuilder()
  .setNumber('0001-0001')
  .setDateTime(new Date().toISOString())
  .addLine('Prodotto 1', 10.0, 22, 1)
  .addPayment('CASH', 10.0)
  .build();

await pem.emitReceipt(receipt);
```

### PEL (Punto di Elaborazione)

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
  lines: [{ description: 'Servizio', quantity: 1, unitPrice: 1000.0, vatRate: 22 }],
  paymentMethod: 'MP05',
});

const xml = buildInvoiceXML(invoice);

// Trasmetti a SDI
const sdiClient = new SDIClient({
  endpoint: 'https://testservizi.fatturapa.it/services/ricezioneFatture',
  certPath: './certs/client.crt',
  keyPath: './certs/client.key',
});

const result = await sdiClient.sendInvoice(builder.generateFilename(), xml, 'SDICOOP');
```

## ✨ Funzionalità

### Scontrini Elettronici (PEM/PEL)

- ✅ Emissione documenti commerciali con PDF + codice a barre Data Matrix
- ✅ Registro hash-chain per immutabilità
- ✅ Sincronizzazione PEM → PEL in tempo reale
- ✅ Client trasmissione ADE (API REST)
- ✅ Server audit (pattern asincrono)
- ✅ Aggregazione scontrini giornalieri
- ✅ Polling esiti da ADE
- ✅ Gestione e segnalazione anomalie
- ✅ Generazione metadati per archivi
- ✅ Codici lotteria istantanei/differiti
- ✅ Interfaccia conservazione digitale (astratta)

### Fatturazione Elettronica (FE)

- ✅ Generazione XML FatturaPA (formati FPR12/FPA12)
- ✅ Costruttore fatture con calcolo IVA automatico
- ✅ Trasmissione SDI via SDICOOP/SDIFTP
- ✅ Gestore ricevute (RC, NS, MC, NE, MT, DT)
- ✅ Supporto fatture B2B e B2C
- ✅ Tipi documento multipli (TD01-TD28)
- ✅ Conforme alle specifiche FatturaPA v1.9

## 📚 Documentazione

Vedi `docs/md/` per le specifiche tecniche (in italiano).

## 🐳 Docker

Esegui il server PEL completo con Docker:

```bash
# Build e avvio
docker-compose up -d

# Con PostgreSQL
docker-compose --profile postgres up -d

# Con MinIO (storage compatibile S3)
docker-compose --profile s3 up -d

# Visualizza log
docker-compose logs -f pel-server

# Stop
docker-compose down
```

### Variabili d'Ambiente

Copia `.env.example` in `.env` e configura:

```bash
ADE_BASE_URL=https://test.agenziaentrate.gov.it/api
ADE_AUTH_TOKEN=your_token_here
```

## 📦 Installazione

```bash
# Installa dipendenze root + tutti i pacchetti
npm install

# Installa tutto incluso gli esempi
npm run install:all

# Installa solo gli esempi
npm run install:examples
```

## 🏗️ Build

```bash
# Build tutti i pacchetti
npm run build

# Build pacchetti individuali
npm run build:common
npm run build:pem
npm run build:pel
npm run build:fe

# Pulisci artefatti di build
npm run clean
```

## 🧪 Testing

```bash
# Esegui tutti i test
npm test

# Modalità watch
npm run test:watch

# Report coverage
npm run test:coverage
```

## 🚀 Esegui Esempi

```bash
# Avvia esempio PEM (Punto Vendita)
npm run start:pem

# Avvia esempio PEL (Server con tutte le funzionalità)
npm run start:pel

# Avvia esempio FE (Fatturazione Elettronica)
npm run start:fe

# Modalità sviluppo con auto-reload
npm run dev:pem
npm run dev:pel
npm run dev:fe
```

## 🎨 Qualità del Codice

```bash
# Formatta codice
npm run format

# Controlla formattazione
npm run format:check

# Lint codice
npm run lint
```

## 📄 Licenza

MIT

## ⚠️ Disclaimer

Questa libreria non è affiliata con l'Agenzia delle Entrate. Utilizzare a proprio rischio.
