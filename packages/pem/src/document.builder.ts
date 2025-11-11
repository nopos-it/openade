/**
 * Document Builder
 * Generates commercial documents (receipts) with proper structure
 */

import type { DocumentoCommerciale } from '@openade/common';

export interface DocumentLine {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total?: number;
}

export class DocumentBuilder {
  private vatNumber: string;
  private businessName: string;
  private pemId: string;

  constructor(config: { vatNumber: string; businessName: string; pemId: string }) {
    this.vatNumber = config.vatNumber;
    this.businessName = config.businessName;
    this.pemId = config.pemId;
  }

  build(lines: DocumentLine[], documentNumber: string): DocumentoCommerciale {
    const now = new Date();
    const dataOra = now.toISOString();

    // Build line items
    const dettaglioLinee = lines.map((line, index) => ({
      numeroLinea: index + 1,
      descrizione: line.description,
      quantita: line.quantity,
      prezzoUnitario: line.unitPrice,
      prezzoTotale: line.quantity * line.unitPrice,
      aliquotaIVA: line.vatRate,
    }));

    // Group by VAT rate for summary
    const vatGroups = new Map<number, { imponibile: number; imposta: number }>();
    lines.forEach((line) => {
      const total = line.quantity * line.unitPrice;
      const taxable = total / (1 + line.vatRate / 100);
      const tax = total - taxable;

      const existing = vatGroups.get(line.vatRate) || { imponibile: 0, imposta: 0 };
      existing.imponibile += taxable;
      existing.imposta += tax;
      vatGroups.set(line.vatRate, existing);
    });

    const datiRiepilogo = Array.from(vatGroups.entries()).map(([rate, amounts]) => ({
      aliquotaIVA: rate,
      imponibile: Math.round(amounts.imponibile * 100) / 100,
      imposta: Math.round(amounts.imposta * 100) / 100,
    }));

    const totalAmount = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);

    return {
      versione: '1.0',
      contribuente: {
        partitaIVA: this.vatNumber,
        denominazione: this.businessName,
        regimeFiscale: 'RF01',
      },
      identificativoPEM: this.pemId,
      datiGenerali: {
        tipoDocumento: 'TD01' as any,
        numero: documentNumber,
        dataOra,
      },
      dettaglioLinee,
      datiRiepilogo,
      importoTotale: Math.round(totalAmount * 100) / 100,
    };
  }
}
