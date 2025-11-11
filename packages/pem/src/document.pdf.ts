/**
 * PDF Generator for Commercial Documents
 * Generates PDF with Data Matrix barcode according to SSW specifications
 *
 * NOTE: This is a placeholder implementation.
 * For a production-ready PDF generator, you'll need to:
 * 1. Install PDF library: npm install jspdf @types/jspdf
 * 2. Install barcode library: npm install bwip-js @types/bwip-js
 * 3. Implement actual PDF rendering with proper layout per Allegato_SSW-LayoutDC
 */

import type { DocumentoCommerciale } from '@openade/common';

export interface PDFGeneratorConfig {
  /** CAU - Codice Autorizzativo Univoco del PEL (4 characters) */
  cau: string;
  /** Device serial number/matricola */
  deviceSerial: string;
  /** Hash of the document (from journal) */
  documentHash: string;
}

export interface DataMatrixContent {
  /** CAU del PEL (4 caratteri) */
  Cau: string;
  /** Hash del documento commerciale */
  Hash: string;
  /** Numero progressivo (es: "0001-0001") */
  Numero: string;
  /** Data ISO 8601 (es: "2025-03-26T10:37:25Z") */
  Data: string;
  /** Importo totale (es: "129.67") */
  Importo: string;
}

/**
 * Generate Data Matrix barcode content (JSON)
 * According to Allegato-SSW-CB specifications
 */
export function generateDataMatrixContent(
  document: DocumentoCommerciale,
  config: PDFGeneratorConfig
): string {
  const content: DataMatrixContent = {
    Cau: config.cau,
    Hash: config.documentHash,
    Numero: document.datiGenerali.numero,
    Data: document.datiGenerali.dataOra,
    Importo: document.importoTotale.toFixed(2),
  };

  return JSON.stringify(content);
}

/**
 * Generate commercial document PDF
 * Returns PDF as Uint8Array (browser compatible)
 *
 * This is a TEXT-BASED placeholder. For actual PDF generation:
 *
 * Example with jsPDF:
 * ```typescript
 * import jsPDF from 'jspdf';
 * import bwipjs from 'bwip-js';
 *
 * const doc = new jsPDF({ unit: 'mm', format: [80, 297] }); // 80mm thermal
 * doc.text(document.contribuente.denominazione, 40, 10, { align: 'center' });
 * // ... add items, totals, etc.
 *
 * // Generate Data Matrix
 * const canvas = document.createElement('canvas');
 * await bwipjs.toCanvas(canvas, {
 *   bcid: 'datamatrix',
 *   text: generateDataMatrixContent(document, config),
 *   scale: 3,
 * });
 * doc.addImage(canvas.toDataURL(), 'PNG', 25, 200, 30, 30);
 *
 * return new Uint8Array(doc.output('arraybuffer'));
 * ```
 */
export async function generateCommercialDocumentPDF(
  document: DocumentoCommerciale,
  config: PDFGeneratorConfig
): Promise<Uint8Array> {
  // Generate Data Matrix content
  const dataMatrixJSON = generateDataMatrixContent(document, config);

  // Generate text-based receipt (for placeholder/testing)
  const pdfContent = createTextReceipt(document, config, dataMatrixJSON);

  // Return as Uint8Array (text encoded for now)
  // In production, this would be actual PDF bytes
  return new TextEncoder().encode(pdfContent);
}

/**
 * Create text-based receipt (placeholder for actual PDF)
 */
function createTextReceipt(
  document: DocumentoCommerciale,
  config: PDFGeneratorConfig,
  dataMatrixJSON: string
): string {
  const lines: string[] = [];
  const width = 50;

  // Header
  lines.push('═'.repeat(width));
  lines.push(centerText(document.contribuente.denominazione.toUpperCase(), width));
  lines.push(centerText(`P.IVA ${document.contribuente.partitaIVA}`, width));
  lines.push('');
  lines.push(centerText('DOCUMENTO COMMERCIALE', width));
  lines.push(centerText('di vendita o prestazione', width));
  lines.push('═'.repeat(width));
  lines.push('');

  // Document info
  const dateTime = new Date(document.datiGenerali.dataOra).toLocaleString('it-IT');
  lines.push(`Data: ${dateTime}`);
  lines.push(`Doc. N.: ${document.datiGenerali.numero}`);
  lines.push(`PEM: ${document.identificativoPEM}`);
  lines.push('');

  // Items
  lines.push('DESCRIZIONE'.padEnd(30) + 'IVA'.padEnd(8) + 'PREZZO');
  lines.push('─'.repeat(width));

  for (const line of document.dettaglioLinee) {
    const desc = truncate(line.descrizione, 30);
    const vat = line.aliquotaIVA ? `${line.aliquotaIVA}%`.padEnd(8) : (line.natura || '').padEnd(8);
    const price = `€${line.prezzoTotale.toFixed(2)}`.padStart(10);
    lines.push(desc.padEnd(30) + vat + price);

    if (line.quantita && line.quantita > 1) {
      lines.push(`  ${line.quantita} x €${line.prezzoUnitario.toFixed(2)}`);
    }
  }

  lines.push('');
  lines.push('─'.repeat(width));

  // VAT summary
  for (const riepilogo of document.datiRiepilogo) {
    const label = riepilogo.aliquotaIVA
      ? `IVA ${riepilogo.aliquotaIVA}%`
      : `Esente (${riepilogo.natura})`;
    lines.push(
      label.padEnd(28) +
        `€${riepilogo.imponibile.toFixed(2)}`.padStart(10) +
        `€${riepilogo.imposta.toFixed(2)}`.padStart(10)
    );
  }

  lines.push('');

  // Total
  lines.push('═'.repeat(width));
  lines.push('TOTALE'.padEnd(38) + `€${document.importoTotale.toFixed(2)}`.padStart(12));
  lines.push('═'.repeat(width));
  lines.push('');

  // Payment
  if (document.datiPagamento && document.datiPagamento.length > 0) {
    for (const payment of document.datiPagamento) {
      lines.push(`Pagamento: ${payment.modalitaPagamento}`);
      if (payment.importo) {
        lines.push(`Importo: €${payment.importo.toFixed(2)}`);
      }
    }
    lines.push('');
  }

  // Footer
  lines.push(`Matricola: ${config.deviceSerial}`);
  lines.push(`Hash: ${config.documentHash.substring(0, 16)}...`);
  lines.push('');
  lines.push('Codice Bidimensionale (Data Matrix):');
  lines.push(dataMatrixJSON);
  lines.push('');
  lines.push('═'.repeat(width));
  lines.push(centerText('Arrivederci e Grazie!', width));
  lines.push('═'.repeat(width));

  return lines.join('\n');
}

/**
 * Utility: Center text within a given width
 */
function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Utility: Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}
