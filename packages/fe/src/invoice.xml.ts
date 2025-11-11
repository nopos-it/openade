/**
 * Invoice XML Builder
 * Generates FatturaPA XML from invoice data
 */

import type { FatturaElettronica } from '@openade/common';
import { XMLBuilder } from 'fast-xml-parser';

/**
 * Create configured XML builder for FatturaPA
 */
function createFatturaXMLBuilder(): XMLBuilder {
  return new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
    attributeNamePrefix: '@_',
  });
}

/**
 * Build FatturaPA XML from invoice data
 */
export function buildInvoiceXML(invoice: FatturaElettronica): string {
  const builder = createFatturaXMLBuilder();

  // Prepare XML object with proper namespace
  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    'p:FatturaElettronica': {
      '@_versione': invoice['@_versione'],
      '@_xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
      '@_xmlns:p': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2',
      '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@_xsi:schemaLocation':
        'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd',
      FatturaElettronicaHeader: invoice.fatturaElettronicaHeader,
      FatturaElettronicaBody: Array.isArray(invoice.fatturaElettronicaBody)
        ? invoice.fatturaElettronicaBody
        : [invoice.fatturaElettronicaBody],
    },
  };

  return builder.build(xmlObject);
}

/**
 * Validate invoice XML structure (basic validation)
 */
export function validateInvoiceXML(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Basic checks
  if (!xml.includes('FatturaElettronica')) {
    errors.push('Missing FatturaElettronica root element');
  }

  if (!xml.includes('FatturaElettronicaHeader')) {
    errors.push('Missing FatturaElettronicaHeader');
  }

  if (!xml.includes('FatturaElettronicaBody')) {
    errors.push('Missing FatturaElettronicaBody');
  }

  if (!xml.includes('DatiTrasmissione')) {
    errors.push('Missing DatiTrasmissione');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
