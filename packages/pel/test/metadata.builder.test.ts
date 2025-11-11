/**
 * Metadata Builder Tests
 */

import type { DocumentoCommerciale, Journal } from '@openade/common';
import { createArchiveMetadata, generateMetadataXML } from '../src/metadata.builder';

describe('MetadataBuilder', () => {
  const mockJournal: Journal = {
    versione: '1.0',
    contribuente: { partitaIVA: '12345678901' },
    identificativoPEM: 'PEM001',
    dataRiferimento: '2025-03-26',
    voci: [],
    numeroVoci: 0,
    importoTotaleGiornata: 0,
    dataOraGenerazione: '2025-03-26T18:30:00Z',
  };

  const mockDocument: DocumentoCommerciale = {
    versione: '1.0',
    identificativoPEM: 'PEM001',
    contribuente: {
      partitaIVA: '12345678901',
      denominazione: 'Test SRL',
      regimeFiscale: 'RF01',
    },
    datiGenerali: {
      numero: '0001-0001',
      dataOra: '2025-03-26T12:30:00Z',
      tipoDocumento: 'TD01' as any,
    },
    dettaglioLinee: [],
    datiRiepilogo: [],
    importoTotale: 100.0,
  };

  describe('createArchiveMetadata', () => {
    test('should create metadata with journals and documents', () => {
      const metadata = createArchiveMetadata(
        {
          matricolaPEM: 'PEM001',
          cau: 'Y6ET',
          esercentePIva: '12345678901',
        },
        [{ journal: mockJournal, hash: 'jhash123', hashApertura: 'seed123' }],
        [{ document: mockDocument, hash: 'dhash456', journalHash: 'jhash123' }]
      );

      expect(metadata.config.matricolaPEM).toBe('PEM001');
      expect(metadata.config.cau).toBe('Y6ET');
      expect(metadata.journals).toHaveLength(1);
      expect(metadata.documents).toHaveLength(1);
    });

    test('should format journal filename correctly', () => {
      const metadata = createArchiveMetadata(
        {
          matricolaPEM: 'PEM001',
          cau: 'Y6ET',
          esercentePIva: '12345678901',
        },
        [{ journal: mockJournal, hash: 'jhash123', hashApertura: 'seed123' }],
        []
      );

      expect(metadata.journals[0].nome).toMatch(
        /^J_\d+_PEM001_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.xml$/
      );
    });

    test('should format document filename correctly', () => {
      const metadata = createArchiveMetadata(
        {
          matricolaPEM: 'PEM001',
          cau: 'Y6ET',
          esercentePIva: '12345678901',
        },
        [],
        [{ document: mockDocument, hash: 'dhash456', journalHash: 'jhash123' }]
      );

      expect(metadata.documents[0].nome).toMatch(
        /^DC_0001-0001_PEM001_\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.xml$/
      );
    });
  });

  describe('generateMetadataXML', () => {
    test('should generate valid XML structure', () => {
      const metadata = createArchiveMetadata(
        {
          matricolaPEM: 'PEM001',
          cau: 'Y6ET',
          esercentePIva: '12345678901',
        },
        [{ journal: mockJournal, hash: 'jhash123', hashApertura: 'seed123' }],
        [{ document: mockDocument, hash: 'dhash456', journalHash: 'jhash123' }]
      );

      const xml = generateMetadataXML(metadata);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<Metadati versione="1.0">');
      expect(xml).toContain('<Intestazione>');
      expect(xml).toContain('<MatricolaPEM>PEM001</MatricolaPEM>');
      expect(xml).toContain('<CAU>Y6ET</CAU>');
      expect(xml).toContain('<EsercentePIva>12345678901</EsercentePIva>');
      expect(xml).toContain('<NJournal>1</NJournal>');
      expect(xml).toContain('<NDC>1</NDC>');
      expect(xml).toContain('<BloccoJournal>');
      expect(xml).toContain('<BloccoDC>');
      expect(xml).toContain('</Metadati>');
    });

    test('should escape XML special characters', () => {
      const metadata = createArchiveMetadata(
        {
          matricolaPEM: 'PEM<001>',
          cau: 'Y&ET',
          esercentePIva: '12345678901',
        },
        [],
        []
      );

      const xml = generateMetadataXML(metadata);

      expect(xml).toContain('PEM&lt;001&gt;');
      expect(xml).toContain('Y&amp;ET');
    });
  });
});
