# @openade/fe

Libreria per Fatturazione Elettronica per SDI (Sistema di Interscambio) italiano.

## Funzionalità

- 📄 Generazione XML FatturaPA (formati FPR12/FPA12)
- 🧾 Costruttore fatture con calcolo IVA automatico
- 📤 Trasmissione SDI via SDICOOP/SDIFTP
- 📨 Gestore ricevute (RC, NS, MC, NE, MT, DT)
- 🏢 Supporto fatture B2B e B2C
- 📋 Tipi documento multipli (TD01-TD28)
- ✅ Conforme alle specifiche FatturaPA v1.9

## Installazione

```bash
npm install @openade/fe @openade/common
```

## Guida Rapida

### 1. Crea Costruttore Fatture

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

### 2. Costruisci Fattura

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
      description: 'Servizio professionale',
      quantity: 1,
      unitPrice: 1000.0,
      vatRate: 22,
    },
  ],
  paymentMethod: 'MP05', // Bonifico bancario
});
```

### 3. Genera XML

```typescript
import { buildInvoiceXML } from '@openade/fe';

const xml = buildInvoiceXML(invoice);
const filename = builder.generateFilename(); // IT12345678901_00001.xml
```

### 4. Trasmetti a SDI

#### SDICOOP (Web Service) - Consigliato

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

#### SDIFTP (SFTP) - Per Volumi Elevati

```typescript
const sdiClient = new SDIClient({
  endpoint: 'https://testservizi.fatturapa.it/services/ricezioneFatture',
  sftp: {
    host: 'sdi.gov.it',
    port: 22,
    username: 'your-username',
    privateKey: 'your-private-key', // oppure password: 'your-password'
    uploadDir: '/in',
    downloadDir: '/out',
  },
});

const result = await sdiClient.sendInvoice(filename, xml, 'SDIFTP');

if (result.success) {
  console.log('Fattura caricata con successo!');

  // Controlla ricevute in seguito
  const receipts = await sdiClient.listReceipts();
  const allReceipts = await sdiClient.downloadAllReceipts();
}
```

### 5. Gestisci Ricevute

```typescript
import { ReceiptHandler } from '@openade/fe';

const receiptHandler = new ReceiptHandler();
const receipt = receiptHandler.parseReceipt(receiptXml);

if (receiptHandler.isSuccessReceipt(receipt)) {
  console.log('Fattura consegnata!');
} else {
  const errors = receiptHandler.getErrors(receipt);
  console.error('Errori:', errors);
}
```

## Tipi Fattura (TipoDocumento)

- **TD01**: Fattura standard
- **TD04**: Nota di credito
- **TD05**: Nota di debito
- **TD06**: Parcella
- **TD16-TD28**: Vari tipi documento speciali

## Canali di Trasmissione

- **SDICOOP**: Web service (SOAP) - consigliato per la maggior parte dei casi
  - Comunicazione in tempo reale con risposta immediata
  - Ideale per volumi moderati (fino a ~1000 fatture/giorno)
  - Risposta immediata `IdentificativoSdI`
  - Gestione errori più semplice

- **SDIFTP**: Trasmissione SFTP - per scenari ad alto volume
  - Elaborazione batch asincrona
  - Ideale per volumi elevati (1000+ fatture/giorno)
  - Richiede configurazione server SFTP
  - Ricevute scaricate separatamente

## Tipi Ricevuta

- **RC**: Ricevuta di Consegna
- **NS**: Notifica di Scarto
- **MC**: Notifica di Mancata Consegna
- **NE**: Notifica Esito (EC01/EC02)
- **MT**: Metadati Fattura
- **DT**: Attestazione trasmissione con mancata consegna

## Interfaccia Storage

Implementa `IFEStorage` per storage personalizzato:

```typescript
import { IFEStorage } from '@openade/fe';

class MyStorage implements IFEStorage {
  async saveInvoice(filename: string, xml: string): Promise<void> {
    // Salva XML fattura
  }

  async loadInvoice(filename: string): Promise<string | null> {
    // Carica XML fattura
  }

  async saveReceipt(filename: string, xml: string): Promise<void> {
    // Salva XML ricevuta
  }

  async loadReceipt(filename: string): Promise<string | null> {
    // Carica XML ricevuta
  }

  async listInvoices(): Promise<string[]> {
    // Elenca tutte le fatture
  }

  async listReceipts(): Promise<string[]> {
    // Elenca tutte le ricevute
  }
}
```

## Metodi di Pagamento (ModalitaPagamento)

- **MP01**: Contanti
- **MP02**: Assegno
- **MP03**: Assegno circolare
- **MP04**: Contanti presso Tesoreria
- **MP05**: Bonifico bancario
- **MP08**: Carta di pagamento
- **MP12**: RIBA
- ... e altri

## Riferimento API

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
  listReceipts(): Promise<string[]>; // Solo SFTP
  downloadAllReceipts(): Promise<Array<{ filename: string; content: string }>>; // Solo SFTP
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

## Esempi

Vedi `examples/fe/` per esempi completi funzionanti.

## Specifiche

Basato su:

- Specifiche FatturaPA v1.9
- Documentazione Sistema di Interscambio (SDI)
- Regolamenti fiscali italiani (DPR 633/72)

## Licenza

MIT

## Disclaimer

Questa libreria non è affiliata con l'Agenzia delle Entrate. Utilizzare a proprio rischio.
