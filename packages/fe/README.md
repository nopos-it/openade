# @openade/fe

Electronic Invoicing (Fatturazione Elettronica) library for Italian SDI (Sistema di Interscambio).

## Features

- 📄 FatturaPA XML generation (FPR12/FPA12 formats)
- 🧾 Invoice builder with automatic VAT calculation
- 📤 SDI transmission via SDICOOP/SDIFTP
- 📨 Receipt handler (RC, NS, MC, NE, MT, DT)
- 🏢 Support for B2B and B2C invoices
- 📋 Multiple document types (TD01-TD28)
- ✅ Compliant with FatturaPA v1.9 specifications

## Installation

```bash
npm install @openade/fe @openade/common
```

## Quick Start

### 1. Create Invoice Builder

```typescript
import { InvoiceBuilder } from '@openade/fe';

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
```

### 2. Build Invoice

```typescript
const invoice = builder.build({
  customer: {
    vatNumber: '98765432109',
    businessName: 'Client S.r.l.',
    address: {
      indirizzo: 'Via Milano 1',
      cap: '20100',
      comune: 'Milano',
      nazione: 'IT',
    },
    sdiCode: '0000000',
    pec: 'client@pec.it',
  },
  invoiceNumber: '2024/001',
  invoiceDate: '2024-01-15',
  lines: [
    {
      description: 'Professional service',
      quantity: 1,
      unitPrice: 1000.0,
      vatRate: 22,
    },
  ],
  paymentMethod: 'MP05', // Bank transfer
});
```

### 3. Generate XML

```typescript
import { buildInvoiceXML } from '@openade/fe';

const xml = buildInvoiceXML(invoice);
const filename = builder.generateFilename(); // IT12345678901_00001.xml
```

### 4. Transmit to SDI

#### SDICOOP (Web Service) - Recommended

```typescript
import { SDIClient } from '@openade/fe';

const sdiClient = new SDIClient({
  endpoint: 'https://testservizi.fatturapa.it/services/ricezioneFatture',
  certPath: './certs/client.crt',
  keyPath: './certs/client.key',
});

const result = await sdiClient.sendInvoice(filename, xml, 'SDICOOP');

if (result.success) {
  console.log('IdentificativoSdI:', result.identifcativoSdI);
}
```

#### SDIFTP (SFTP) - For High Volume

```typescript
const sdiClient = new SDIClient({
  endpoint: 'https://testservizi.fatturapa.it/services/ricezioneFatture',
  sftp: {
    host: 'sdi.gov.it',
    port: 22,
    username: 'your-username',
    privateKey: 'your-private-key', // or password: 'your-password'
    uploadDir: '/in',
    downloadDir: '/out',
  },
});

const result = await sdiClient.sendInvoice(filename, xml, 'SDIFTP');

if (result.success) {
  console.log('Invoice uploaded successfully!');

  // Check for receipts later
  const receipts = await sdiClient.listReceipts();
  const allReceipts = await sdiClient.downloadAllReceipts();
}
```

### 5. Handle Receipts

```typescript
import { ReceiptHandler } from '@openade/fe';

const receiptHandler = new ReceiptHandler();
const receipt = receiptHandler.parseReceipt(receiptXml);

if (receiptHandler.isSuccessReceipt(receipt)) {
  console.log('Invoice delivered!');
} else {
  const errors = receiptHandler.getErrors(receipt);
  console.error('Errors:', errors);
}
```

## Invoice Types (TipoDocumento)

- **TD01**: Standard invoice
- **TD04**: Credit note
- **TD05**: Debit note
- **TD06**: Fee
- **TD16-TD28**: Various special document types

## Transmission Channels

- **SDICOOP**: Web service (SOAP) - recommended for most cases
  - Real-time communication with immediate response
  - Best for moderate volumes (up to ~1000 invoices/day)
  - Immediate `IdentificativoSdI` response
  - Simpler error handling

- **SDIFTP**: SFTP transmission - for high-volume scenarios
  - Asynchronous batch processing
  - Best for high volumes (1000+ invoices/day)
  - Requires SFTP server configuration
  - Receipts downloaded separately

## Receipt Types

- **RC**: Delivery receipt (Ricevuta di Consegna)
- **NS**: Rejection notice (Notifica di Scarto)
- **MC**: Undelivered notice (Notifica di Mancata Consegna)
- **NE**: Outcome notice (Notifica Esito - EC01/EC02)
- **MT**: Invoice metadata (Metadati Fattura)
- **DT**: Transmission attestation with delivery failure

## Storage Interface

Implement `IFEStorage` for custom storage:

```typescript
import { IFEStorage } from '@openade/fe';

class MyStorage implements IFEStorage {
  async saveInvoice(filename: string, xml: string): Promise<void> {
    // Save invoice XML
  }

  async loadInvoice(filename: string): Promise<string | null> {
    // Load invoice XML
  }

  async saveReceipt(filename: string, xml: string): Promise<void> {
    // Save receipt XML
  }

  async loadReceipt(filename: string): Promise<string | null> {
    // Load receipt XML
  }

  async listInvoices(): Promise<string[]> {
    // List all invoices
  }

  async listReceipts(): Promise<string[]> {
    // List all receipts
  }
}
```

## Payment Methods (ModalitaPagamento)

- **MP01**: Cash
- **MP02**: Check
- **MP03**: Banker's draft
- **MP04**: Cash at treasury
- **MP05**: Bank transfer
- **MP08**: Payment card
- **MP12**: RIBA
- ... and more

## API Reference

### InvoiceBuilder

```typescript
class InvoiceBuilder {
  constructor(config: InvoiceBuilderConfig);
  build(data: InvoiceData): FatturaElettronica;
  generateFilename(): string;
  resetCounter(): void;
  getCurrentProgressive(): number;
}
```

### SDIClient

```typescript
class SDIClient {
  constructor(config: SDIClientConfig);
  sendInvoice(
    filename: string,
    xml: string,
    channel: TransmissionChannel
  ): Promise<InvoiceTransmissionResult>;
  queryInvoiceStatus(identifcativoSdI: string): Promise<{ status: string; details?: string }>;
  downloadReceipt(identifcativoSdI: string): Promise<string | null>;
  listReceipts(): Promise<string[]>; // SFTP only
  downloadAllReceipts(): Promise<Array<{ filename: string; content: string }>>; // SFTP only
}
```

### ReceiptHandler

```typescript
class ReceiptHandler {
  parseReceipt(xml: string, type?: ReceiptType): RicevutaConsegna | NotificaScarto | ... | null;
  isSuccessReceipt(receipt: any): boolean;
  getErrors(receipt: any): string[];
}
```

## Examples

See `examples/fe/` for complete working examples.

## Specifications

Based on:

- FatturaPA v1.9 specifications
- Sistema di Interscambio (SDI) documentation
- Italian tax regulations (DPR 633/72)

## License

MIT

## Disclaimer

This library is not affiliated with Agenzia delle Entrate. Use at your own risk.
