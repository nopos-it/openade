/**
 * XML Builders for ADE (Agenzia delle Entrate) documents
 * Generates XML compliant with SSW (Soluzione Software) specifications v1.1
 */

import { XMLBuilder } from 'fast-xml-parser';
import type { CorrispettiviGiornalieri } from '../types/corrispettivi';
import type { DocumentoCommerciale } from '../types/dc';
import type { Journal } from '../types/journal';
import type { EmissionPointCensus } from '../types/pem';

/**
 * Create configured XML builder
 */
function createXMLBuilder(): XMLBuilder {
  return new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    suppressEmptyNode: true,
  });
}

/**
 * Build XML for emission point census
 * @param census - Emission point census data
 * @returns XML string
 */
export function buildEmissionPointCensusXML(census: EmissionPointCensus): string {
  const builder = createXMLBuilder();

  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    CensimentoPEM: {
      '@_versione': census.version,
      Contribuente: {
        PartitaIVA: census.taxpayer.vatNumber,
        ...(census.taxpayer.fiscalCode && { CodiceFiscale: census.taxpayer.fiscalCode }),
        Denominazione: census.taxpayer.businessName,
        RegimeFiscale: census.taxpayer.taxRegimeCode,
      },
      IdentificativoPEM: census.emissionDevice.identifier,
      ...(census.emissionDevice.type && { Tipo: census.emissionDevice.type }),
      ...(census.location && {
        Indirizzo: {
          Via: census.location.indirizzo,
          NumeroCivico: census.location.numeroCivico,
          CAP: census.location.cap,
          Comune: census.location.comune,
          Provincia: census.location.provincia,
          Nazione: census.location.nazione,
        },
      }),
    },
  };

  return builder.build(xmlObject);
}

/**
 * Build XML for emission point activation
 * @param activationData - Activation data (same structure as census)
 * @returns XML string
 */
export function buildEmissionPointActivationXML(activationData: EmissionPointCensus): string {
  // Activation uses same XML structure as census
  return buildEmissionPointCensusXML(activationData);
}

/**
 * Build XML for daily receipts
 * @param receipts - Daily receipts data
 * @returns XML string
 */
export function buildDailyReceiptsXML(receipts: CorrispettiviGiornalieri): string {
  const builder = createXMLBuilder();

  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    CorrispettiviGiornalieri: {
      '@_versione': receipts.versione,
      Contribuente: {
        PartitaIVA: receipts.contribuente.partitaIVA,
        ...(receipts.contribuente.codiceFiscale && {
          CodiceFiscale: receipts.contribuente.codiceFiscale,
        }),
      },
      IdentificativoPEM: receipts.identificativoPEM,
      DataRiferimento: receipts.dataRiferimento,
      DataOraTrasmissione: receipts.dataOraTrasmissione,
      RiepilogoIVA: receipts.riepilogoIVA.map((riepilogo) => ({
        ...(riepilogo.aliquotaIVA !== undefined && {
          AliquotaIVA: riepilogo.aliquotaIVA.toFixed(2),
        }),
        ...(riepilogo.natura && { Natura: riepilogo.natura }),
        Imponibile: riepilogo.imponibile.toFixed(2),
        Imposta: riepilogo.imposta.toFixed(2),
      })),
      ImportoTotale: receipts.importoTotale.toFixed(2),
    },
  };

  return builder.build(xmlObject);
}

/**
 * Build XML for commercial document
 * @param document - Commercial document data
 * @returns XML string
 */
export function buildCommercialDocumentXML(document: DocumentoCommerciale): string {
  const builder = createXMLBuilder();

  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    DocumentoCommerciale: {
      '@_versione': document.versione,
      Contribuente: {
        PartitaIVA: document.contribuente.partitaIVA,
        ...(document.contribuente.codiceFiscale && {
          CodiceFiscale: document.contribuente.codiceFiscale,
        }),
        Denominazione: document.contribuente.denominazione,
        RegimeFiscale: document.contribuente.regimeFiscale,
      },
      IdentificativoPEM: document.identificativoPEM,
      DatiGenerali: {
        TipoDocumento: document.datiGenerali.tipoDocumento,
        Numero: document.datiGenerali.numero,
        DataOra: document.datiGenerali.dataOra,
      },
      ...(document.cliente && {
        Cliente: {
          ...(document.cliente.partitaIVA && { PartitaIVA: document.cliente.partitaIVA }),
          ...(document.cliente.codiceFiscale && {
            CodiceFiscale: document.cliente.codiceFiscale,
          }),
          Denominazione: document.cliente.denominazione,
        },
      }),
      ...(document.divisa && { Divisa: document.divisa }),
      DettaglioLinee: document.dettaglioLinee.map((linea) => ({
        NumeroLinea: linea.numeroLinea,
        Descrizione: linea.descrizione,
        ...(linea.quantita && { Quantita: linea.quantita }),
        PrezzoUnitario: linea.prezzoUnitario.toFixed(2),
        PrezzoTotale: linea.prezzoTotale.toFixed(2),
        ...(linea.aliquotaIVA !== undefined && { AliquotaIVA: linea.aliquotaIVA.toFixed(2) }),
        ...(linea.natura && { Natura: linea.natura }),
      })),
      DatiRiepilogo: document.datiRiepilogo.map((riepilogo) => ({
        ...(riepilogo.aliquotaIVA !== undefined && {
          AliquotaIVA: riepilogo.aliquotaIVA.toFixed(2),
        }),
        ...(riepilogo.natura && { Natura: riepilogo.natura }),
        Imponibile: riepilogo.imponibile.toFixed(2),
        Imposta: riepilogo.imposta.toFixed(2),
      })),
      ImportoTotale: document.importoTotale.toFixed(2),
      ...(document.datiPagamento && {
        DatiPagamento: document.datiPagamento.map((pag) => ({
          ModalitaPagamento: pag.modalitaPagamento,
          ...(pag.importo && { Importo: pag.importo.toFixed(2) }),
        })),
      }),
      ...(document.note && { Note: document.note }),
    },
  };

  return builder.build(xmlObject);
}

/**
 * Build XML for journal (Giornale)
 * @param journal - Journal data
 * @returns XML string
 */
export function buildJournalXML(journal: Journal): string {
  const builder = createXMLBuilder();

  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    Giornale: {
      '@_versione': journal.versione,
      Contribuente: {
        PartitaIVA: journal.contribuente.partitaIVA,
      },
      IdentificativoPEM: journal.identificativoPEM,
      DataRiferimento: journal.dataRiferimento,
      Righe: journal.voci.map((voce) => ({
        TipoRiga: voce.tipo,
        DataOra: voce.dataOra,
        ...(voce.numeroDocumento && {
          RiferimentoDocumento: voce.numeroDocumento,
        }),
        ...(voce.importo !== undefined && {
          ImportoTotale: voce.importo.toFixed(2),
        }),
        ...(voce.metodoPagamento && {
          MetodoPagamento: voce.metodoPagamento,
        }),
        ...(voce.note && { Note: voce.note }),
      })),
      NumeroVoci: journal.numeroVoci,
      ImportoTotaleGiornata: journal.importoTotaleGiornata.toFixed(2),
      DataOraGenerazione: journal.dataOraGenerazione,
    },
  };

  return builder.build(xmlObject);
}

/**
 * Anomaly report structure for XML generation
 */
export interface AnomalyReport {
  type: string;
  taxpayerFiscalCode: string;
  pemId: string;
  pemLocation?: string;
  details: string;
  timestamp: string;
  startedAt?: string;
  resolvedAt?: string;
  metadata?: {
    operationsWithoutNetwork?: number;
    networkRestoredAt?: string;
    expectedHash?: string;
    actualHash?: string;
    affectedDocuments?: number;
  };
}

/**
 * Build XML for anomalies transmission
 * Follows the schema defined in SSW specifications section 3.3.2
 * @param anomalies - Array of anomaly reports
 * @returns XML string
 */
export function buildAnomaliesXML(anomalies: AnomalyReport[]): string {
  const builder = createXMLBuilder();

  const xmlObject = {
    '?xml': {
      '@_version': '1.0',
      '@_encoding': 'UTF-8',
    },
    RichiestaAnomalie: {
      '@_xmlns': 'http://ivaservizi.agenziaentrate.gov.it/docs/xsd/anomalie/v1.0',
      Versione: '1.0',
      Anomalia: anomalies.map((anomaly) => ({
        Tipo: anomaly.type,
        CodiceFiscale: anomaly.taxpayerFiscalCode,
        IdentificativoPEM: anomaly.pemId,
        ...(anomaly.pemLocation && { IndirizzoPEM: anomaly.pemLocation }),
        Descrizione: anomaly.details,
        Timestamp: anomaly.timestamp,
        ...(anomaly.startedAt && { DataInizio: anomaly.startedAt }),
        ...(anomaly.resolvedAt && { DataRisoluzione: anomaly.resolvedAt }),
        ...(anomaly.metadata?.operationsWithoutNetwork && {
          OperazioniSenzaRete: anomaly.metadata.operationsWithoutNetwork,
        }),
        ...(anomaly.metadata?.networkRestoredAt && {
          DataRipristinoRete: anomaly.metadata.networkRestoredAt,
        }),
        ...(anomaly.metadata?.expectedHash && {
          HashAtteso: anomaly.metadata.expectedHash,
        }),
        ...(anomaly.metadata?.actualHash && {
          HashEffettivo: anomaly.metadata.actualHash,
        }),
        ...(anomaly.metadata?.affectedDocuments && {
          DocumentiCoinvolti: anomaly.metadata.affectedDocuments,
        }),
      })),
    },
  };

  return builder.build(xmlObject);
}
