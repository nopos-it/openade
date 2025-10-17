/**
 * Invoice Builder
 * Builds FatturaPA XML invoices
 */

import type {
  CedentePrestatore,
  CessionarioCommittente,
  DatiRiepilogoFE,
  DettaglioLinee,
  FatturaElettronica,
  FatturaElettronicaBody,
  FatturaElettronicaHeader,
} from '@nopos-ade/common';

export interface InvoiceBuilderConfig {
  /** Supplier VAT number */
  supplierVatNumber: string;
  /** Supplier business name */
  supplierBusinessName: string;
  /** Supplier address */
  supplierAddress: {
    indirizzo: string;
    cap: string;
    comune: string;
    provincia?: string;
    nazione: string;
  };
  /** Tax regime code */
  taxRegime?: string;
  /** Transmission ID country (default: IT) */
  transmissionCountry?: string;
  /** Transmission ID code (fiscal code or VAT) */
  transmissionCode?: string;
}

export interface InvoiceLine {
  description: string;
  quantity?: number;
  unitPrice: number;
  vatRate: number;
  vatNature?: 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7'; // For exempt/non-taxable
}

export interface InvoiceData {
  /** Customer data */
  customer: {
    vatNumber?: string;
    fiscalCode?: string;
    businessName?: string;
    firstName?: string;
    lastName?: string;
    address: {
      indirizzo: string;
      cap: string;
      comune: string;
      provincia?: string;
      nazione: string;
    };
    /** SDI code (7 chars) or '0000000' for PEC or 'XXXXXXX' for foreign */
    sdiCode?: string;
    /** PEC email if sdiCode is '0000000' */
    pec?: string;
  };
  /** Invoice number */
  invoiceNumber: string;
  /** Invoice date (YYYY-MM-DD) */
  invoiceDate: string;
  /** Document type (default: TD01) */
  documentType?:
    | 'TD01'
    | 'TD02'
    | 'TD03'
    | 'TD04'
    | 'TD05'
    | 'TD06'
    | 'TD16'
    | 'TD17'
    | 'TD18'
    | 'TD19'
    | 'TD20'
    | 'TD21'
    | 'TD22'
    | 'TD23'
    | 'TD24'
    | 'TD25'
    | 'TD26'
    | 'TD27'
    | 'TD28';
  /** Invoice lines */
  lines: InvoiceLine[];
  /** Payment method */
  paymentMethod?:
    | 'MP01'
    | 'MP02'
    | 'MP03'
    | 'MP04'
    | 'MP05'
    | 'MP08'
    | 'MP12'
    | 'MP13'
    | 'MP14'
    | 'MP15'
    | 'MP16'
    | 'MP17'
    | 'MP18'
    | 'MP19'
    | 'MP20'
    | 'MP21'
    | 'MP22'
    | 'MP23';
  /** Payment amount (if different from total) */
  paymentAmount?: number;
  /** Notes/reason */
  notes?: string[];
}

export class InvoiceBuilder {
  private config: InvoiceBuilderConfig;
  private progressiveCounter: number = 0;

  constructor(config: InvoiceBuilderConfig) {
    this.config = config;
  }

  /**
   * Build invoice XML structure
   */
  build(data: InvoiceData): FatturaElettronica {
    this.progressiveCounter++;

    // Build header
    const header = this.buildHeader(data);

    // Build body
    const body = this.buildBody(data);

    return {
      '@_versione': 'FPR12',
      fatturaElettronicaHeader: header,
      fatturaElettronicaBody: body,
    };
  }

  /**
   * Build invoice header
   */
  private buildHeader(data: InvoiceData): FatturaElettronicaHeader {
    const transmissionCode = this.config.transmissionCode || this.config.supplierVatNumber;

    // Supplier data
    const cedente: CedentePrestatore = {
      datiAnagrafici: {
        idFiscaleIVA: {
          idPaese: this.config.transmissionCountry || 'IT',
          idCodice: this.config.supplierVatNumber,
        },
        anagrafica: {
          denominazione: this.config.supplierBusinessName,
        },
        ...(this.config.taxRegime && { regimeFiscale: this.config.taxRegime }),
      },
      sede: this.config.supplierAddress,
    };

    // Customer data
    const cessionario: CessionarioCommittente = {
      datiAnagrafici: {
        ...(data.customer.vatNumber && {
          idFiscaleIVA: {
            idPaese: data.customer.address.nazione,
            idCodice: data.customer.vatNumber,
          },
        }),
        ...(data.customer.fiscalCode && { codiceFiscale: data.customer.fiscalCode }),
        anagrafica: {
          ...(data.customer.businessName && { denominazione: data.customer.businessName }),
          ...(data.customer.firstName && { nome: data.customer.firstName }),
          ...(data.customer.lastName && { cognome: data.customer.lastName }),
        },
      },
      sede: data.customer.address,
    };

    // Determine destination code
    let codiceDestinatario = data.customer.sdiCode || '0000000';
    if (data.customer.address.nazione !== 'IT') {
      codiceDestinatario = 'XXXXXXX';
    }

    return {
      datiTrasmissione: {
        idTrasmittente: {
          idPaese: this.config.transmissionCountry || 'IT',
          idCodice: transmissionCode,
        },
        progressivoInvio: this.progressiveCounter.toString().padStart(5, '0'),
        formatoTrasmissione: 'FPR12',
        codiceDestinatario,
        ...(data.customer.pec &&
          codiceDestinatario === '0000000' && {
            pecDestinatario: data.customer.pec,
          }),
      },
      cedentePrestatore: cedente,
      cessionarioCommittente: cessionario,
    };
  }

  /**
   * Build invoice body
   */
  private buildBody(data: InvoiceData): FatturaElettronicaBody {
    // Build lines
    const lines: DettaglioLinee[] = data.lines.map((line, index) => ({
      numeroLinea: index + 1,
      descrizione: line.description,
      ...(line.quantity !== undefined && { quantita: line.quantity }),
      prezzoUnitario: line.unitPrice,
      prezzoTotale: (line.quantity || 1) * line.unitPrice,
      aliquotaIVA: line.vatRate,
      ...(line.vatNature && { natura: line.vatNature }),
    }));

    // Calculate VAT summary
    const vatSummary = this.calculateVatSummary(lines);

    // Calculate total
    const totalAmount = vatSummary.reduce(
      (sum, item) => sum + item.imponibileImporto + item.imposta,
      0
    );

    return {
      datiGenerali: {
        datiGeneraliDocumento: {
          tipoDocumento: data.documentType || 'TD01',
          divisa: 'EUR',
          data: data.invoiceDate,
          numero: data.invoiceNumber,
          ...(data.notes && { causale: data.notes }),
          importoTotaleDocumento: totalAmount,
        },
      },
      datiBeniServizi: {
        dettaglioLinee: lines,
        datiRiepilogo: vatSummary,
      },
      ...(data.paymentMethod && {
        datiPagamento: [
          {
            condizioniPagamento: 'TP01',
            dettaglioPagamento: [
              {
                modalitaPagamento: data.paymentMethod,
                importoPagamento: data.paymentAmount || totalAmount,
              },
            ],
          },
        ],
      }),
    };
  }

  /**
   * Calculate VAT summary from lines
   */
  private calculateVatSummary(lines: DettaglioLinee[]): DatiRiepilogoFE[] {
    const summary = new Map<string, DatiRiepilogoFE>();

    for (const line of lines) {
      const key = `${line.aliquotaIVA}-${line.natura || ''}`;

      if (!summary.has(key)) {
        summary.set(key, {
          aliquotaIVA: line.aliquotaIVA,
          ...(line.natura && { natura: line.natura }),
          imponibileImporto: 0,
          imposta: 0,
        });
      }

      const item = summary.get(key)!;
      item.imponibileImporto += line.prezzoTotale;
      item.imposta += (line.prezzoTotale * line.aliquotaIVA) / 100;

      // Round to 2 decimals
      item.imponibileImporto = Math.round(item.imponibileImporto * 100) / 100;
      item.imposta = Math.round(item.imposta * 100) / 100;
    }

    return Array.from(summary.values());
  }

  /**
   * Generate filename for invoice
   * Format: IT<IdPaese><IdCodice>_<ProgressivoInvio>.xml
   */
  generateFilename(): string {
    const country = this.config.transmissionCountry || 'IT';
    const code = this.config.transmissionCode || this.config.supplierVatNumber;
    const progressive = this.progressiveCounter.toString().padStart(5, '0');
    return `${country}${code}_${progressive}.xml`;
  }

  /**
   * Reset progressive counter
   */
  resetCounter(): void {
    this.progressiveCounter = 0;
  }

  /**
   * Get current progressive counter
   */
  getCurrentProgressive(): number {
    return this.progressiveCounter;
  }
}
