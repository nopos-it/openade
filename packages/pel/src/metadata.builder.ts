/**
 * Metadata Builder for Audit Archives
 * Generates metadata XML file according to Allegato-SSW-Metadati specifications
 */

import type { DocumentoCommerciale, Journal } from '@nopos-ade/common';

export interface MetadataConfig {
  matricolaPEM: string;
  cau: string;
  esercentePIva: string;
}

export interface JournalMetadata {
  nome: string;
  progrAperturaCassa: number;
  hash: string;
  dataChiusuraCassa: string;
  totaleDC: number;
  hashApertura: string;
}

export interface DocumentMetadata {
  nome: string;
  hash: string;
  dataEmissione: string;
  numero: string;
  hashJournal: string;
}

export interface ArchiveMetadata {
  config: MetadataConfig;
  journals: JournalMetadata[];
  documents: DocumentMetadata[];
}

/**
 * Generate metadata XML for audit archive
 * According to Allegato-SSW-Metadati.md specifications
 */
export function generateMetadataXML(metadata: ArchiveMetadata): string {
  const { config, journals, documents } = metadata;

  const xml: string[] = [];
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<Metadati versione="1.0">');

  // Intestazione
  xml.push('  <Intestazione>');
  xml.push(`    <MatricolaPEM>${escapeXML(config.matricolaPEM)}</MatricolaPEM>`);
  xml.push(`    <CAU>${escapeXML(config.cau)}</CAU>`);
  xml.push(`    <EsercentePIva>${escapeXML(config.esercentePIva)}</EsercentePIva>`);
  xml.push('    <TotaliDocumenti>');
  xml.push(`      <NJournal>${journals.length}</NJournal>`);
  xml.push(`      <NDC>${documents.length}</NDC>`);
  xml.push('    </TotaliDocumenti>');
  xml.push('  </Intestazione>');

  // Blocchi Journal
  for (const journal of journals) {
    xml.push('  <BloccoJournal>');
    xml.push(`    <Nome>${escapeXML(journal.nome)}</Nome>`);
    xml.push(`    <ProgrAperturaCassa>${journal.progrAperturaCassa}</ProgrAperturaCassa>`);
    xml.push(`    <Hash>${escapeXML(journal.hash)}</Hash>`);
    xml.push(`    <DataChiusuraCassa>${escapeXML(journal.dataChiusuraCassa)}</DataChiusuraCassa>`);
    xml.push(`    <TotaleDC>${journal.totaleDC}</TotaleDC>`);
    xml.push(`    <HashApertura>${escapeXML(journal.hashApertura)}</HashApertura>`);
    xml.push('  </BloccoJournal>');
  }

  // Blocchi Documenti Commerciali
  for (const doc of documents) {
    xml.push('  <BloccoDC>');
    xml.push(`    <Nome>${escapeXML(doc.nome)}</Nome>`);
    xml.push(`    <Hash>${escapeXML(doc.hash)}</Hash>`);
    xml.push(`    <DataEmissione>${escapeXML(doc.dataEmissione)}</DataEmissione>`);
    xml.push(`    <Numero>${escapeXML(doc.numero)}</Numero>`);
    xml.push(`    <HashJournal>${escapeXML(doc.hashJournal)}</HashJournal>`);
    xml.push('  </BloccoDC>');
  }

  xml.push('</Metadati>');

  return xml.join('\n');
}

/**
 * Create metadata from journals and documents
 */
export function createArchiveMetadata(
  config: MetadataConfig,
  journals: Array<{ journal: Journal; hash: string; hashApertura: string }>,
  documents: Array<{ document: DocumentoCommerciale; hash: string; journalHash: string }>
): ArchiveMetadata {
  const journalMetadata: JournalMetadata[] = journals.map((j, index) => {
    // Count documents in this journal
    const docsInJournal = documents.filter((d) => d.journalHash === j.hash).length;

    // Format date: aaaa-mm-dd-hh24-mi-ss
    const dateStr = formatDateForFilename(j.journal.dataOraGenerazione);

    return {
      nome: `J_${index + 1}_${config.matricolaPEM}_${dateStr}.xml`,
      progrAperturaCassa: index + 1,
      hash: j.hash,
      dataChiusuraCassa: j.journal.dataOraGenerazione,
      totaleDC: docsInJournal,
      hashApertura: j.hashApertura,
    };
  });

  const documentMetadata: DocumentMetadata[] = documents.map((d) => {
    const dateStr = formatDateForFilename(d.document.datiGenerali.dataOra);

    return {
      nome: `DC_${d.document.datiGenerali.numero}_${config.matricolaPEM}_${dateStr}.xml`,
      hash: d.hash,
      dataEmissione: d.document.datiGenerali.dataOra,
      numero: d.document.datiGenerali.numero,
      hashJournal: d.journalHash,
    };
  });

  return {
    config,
    journals: journalMetadata,
    documents: documentMetadata,
  };
}

/**
 * Format date for filename: aaaa-mm-dd-hh24-mi-ss
 */
function formatDateForFilename(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Escape XML special characters
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
