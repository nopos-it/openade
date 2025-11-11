/**
 * Invoice Builder Tests
 */

import { InvoiceBuilder } from '../src/invoice.builder';
import { buildInvoiceXML } from '../src/invoice.xml';

describe('InvoiceBuilder', () => {
  const config = {
    supplierVatNumber: '12345678901',
    supplierBusinessName: 'Azienda Test S.r.l.',
    supplierAddress: {
      indirizzo: 'Via Roma 1',
      cap: '00100',
      comune: 'Roma',
      provincia: 'RM',
      nazione: 'IT',
    },
    taxRegime: 'RF01',
  };

  let builder: InvoiceBuilder;

  beforeEach(() => {
    builder = new InvoiceBuilder(config);
  });

  test('should build a simple invoice', () => {
    const invoiceData = {
      customer: {
        vatNumber: '98765432109',
        businessName: 'Cliente Test S.r.l.',
        address: {
          indirizzo: 'Via Milano 10',
          cap: '20100',
          comune: 'Milano',
          provincia: 'MI',
          nazione: 'IT',
        },
        sdiCode: '0000000',
        pec: 'cliente@pec.it',
      },
      invoiceNumber: 'FT001',
      invoiceDate: '2024-01-15',
      lines: [
        {
          description: 'Consulenza',
          quantity: 1,
          unitPrice: 100.0,
          vatRate: 22,
        },
      ],
      paymentMethod: 'MP05' as const,
    };

    const invoice = builder.build(invoiceData);

    expect(invoice).toBeDefined();
    expect(invoice['@_versione']).toBe('FPR12');
    expect(invoice.fatturaElettronicaHeader).toBeDefined();
    expect(invoice.fatturaElettronicaBody).toBeDefined();

    // Check header
    const header = invoice.fatturaElettronicaHeader;
    expect(header.datiTrasmissione.formatoTrasmissione).toBe('FPR12');
    expect(header.cedentePrestatore.datiAnagrafici.idFiscaleIVA.idCodice).toBe('12345678901');
    expect(header.cessionarioCommittente.datiAnagrafici.anagrafica.denominazione).toBe(
      'Cliente Test S.r.l.'
    );

    // Check body
    const body = Array.isArray(invoice.fatturaElettronicaBody)
      ? invoice.fatturaElettronicaBody[0]
      : invoice.fatturaElettronicaBody;
    expect(body.datiGenerali.datiGeneraliDocumento.tipoDocumento).toBe('TD01');
    expect(body.datiGenerali.datiGeneraliDocumento.numero).toBe('FT001');
    expect(body.datiBeniServizi.dettaglioLinee).toHaveLength(1);
    expect(body.datiBeniServizi.datiRiepilogo).toHaveLength(1);
    expect(body.datiBeniServizi.datiRiepilogo[0].imponibileImporto).toBe(100);
    expect(body.datiBeniServizi.datiRiepilogo[0].imposta).toBe(22);
  });

  test('should generate valid XML', () => {
    const invoiceData = {
      customer: {
        fiscalCode: 'RSSMRA85M01H501U',
        firstName: 'Mario',
        lastName: 'Rossi',
        address: {
          indirizzo: 'Via Verdi 5',
          cap: '50100',
          comune: 'Firenze',
          provincia: 'FI',
          nazione: 'IT',
        },
        sdiCode: '0000000',
      },
      invoiceNumber: 'FT002',
      invoiceDate: '2024-01-16',
      lines: [
        {
          description: 'Servizio professionale',
          unitPrice: 500.0,
          vatRate: 22,
        },
      ],
    };

    const invoice = builder.build(invoiceData);
    const xml = buildInvoiceXML(invoice);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('FatturaElettronica');
    expect(xml).toContain('FatturaElettronicaHeader');
    expect(xml).toContain('FatturaElettronicaBody');
    expect(xml).toContain('RSSMRA85M01H501U');
    expect(xml).toContain('FT002');
  });

  test('should calculate VAT summary correctly for multiple lines', () => {
    const invoiceData = {
      customer: {
        vatNumber: '11111111111',
        businessName: 'Test Cliente',
        address: {
          indirizzo: 'Via Test',
          cap: '00100',
          comune: 'Roma',
          nazione: 'IT',
        },
      },
      invoiceNumber: 'FT003',
      invoiceDate: '2024-01-17',
      lines: [
        { description: 'Item 1', quantity: 2, unitPrice: 50.0, vatRate: 22 },
        { description: 'Item 2', quantity: 1, unitPrice: 100.0, vatRate: 22 },
        { description: 'Item 3', quantity: 1, unitPrice: 200.0, vatRate: 10 },
      ],
    };

    const invoice = builder.build(invoiceData);
    const body = Array.isArray(invoice.fatturaElettronicaBody)
      ? invoice.fatturaElettronicaBody[0]
      : invoice.fatturaElettronicaBody;

    const vat22 = body.datiBeniServizi.datiRiepilogo.find((r) => r.aliquotaIVA === 22);
    const vat10 = body.datiBeniServizi.datiRiepilogo.find((r) => r.aliquotaIVA === 10);

    expect(vat22).toBeDefined();
    expect(vat22?.imponibileImporto).toBe(200); // 100 + 100
    expect(vat22?.imposta).toBe(44); // 200 * 0.22

    expect(vat10).toBeDefined();
    expect(vat10?.imponibileImporto).toBe(200);
    expect(vat10?.imposta).toBe(20); // 200 * 0.10
  });

  test('should generate filename correctly', () => {
    const filename = builder.generateFilename();
    expect(filename).toMatch(/^IT12345678901_\d{5}\.xml$/);
  });

  test('should increment progressive counter', () => {
    expect(builder.getCurrentProgressive()).toBe(0);

    builder.build({
      customer: {
        vatNumber: '11111111111',
        businessName: 'Test',
        address: { indirizzo: 'Test', cap: '00100', comune: 'Roma', nazione: 'IT' },
      },
      invoiceNumber: 'FT001',
      invoiceDate: '2024-01-01',
      lines: [{ description: 'Test', unitPrice: 100, vatRate: 22 }],
    });

    expect(builder.getCurrentProgressive()).toBe(1);

    builder.build({
      customer: {
        vatNumber: '11111111111',
        businessName: 'Test',
        address: { indirizzo: 'Test', cap: '00100', comune: 'Roma', nazione: 'IT' },
      },
      invoiceNumber: 'FT002',
      invoiceDate: '2024-01-02',
      lines: [{ description: 'Test', unitPrice: 100, vatRate: 22 }],
    });

    expect(builder.getCurrentProgressive()).toBe(2);
  });
});
