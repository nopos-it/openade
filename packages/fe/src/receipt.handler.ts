/**
 * Receipt Handler
 * Handles SDI receipts and notifications
 */

import type {
  NotificaEsito,
  NotificaMancataConsegna,
  NotificaScarto,
  ReceiptType,
  RicevutaConsegna,
} from '@openade/common';
import { XMLParser } from 'fast-xml-parser';

/**
 * Parse receipt type from filename
 * Format: <IdPaese><IdCodice>_<ProgressivoInvio>_<TipoFile>_<IdentificativoSdI>.xml
 * TipoFile: RC, NS, MC, NE, MT, DT
 */
export function parseReceiptType(filename: string): ReceiptType | null {
  const match = filename.match(/_([A-Z]{2})_/);
  if (!match) return null;

  const type = match[1];
  if (['RC', 'NS', 'MC', 'NE', 'MT', 'DT'].includes(type)) {
    return type as ReceiptType;
  }

  return null;
}

/**
 * Parse receipt filename to extract metadata
 */
export function parseReceiptFilename(filename: string): {
  idPaese?: string;
  idCodice?: string;
  progressivoInvio?: string;
  tipoFile?: ReceiptType;
  identificativoSdI?: string;
} {
  // Format: <IdPaese><IdCodice>_<ProgressivoInvio>_<TipoFile>_<IdentificativoSdI>.xml
  const pattern = /^([A-Z]{2})([^_]+)_([^_]+)_([A-Z]{2})_(\d+)\.xml$/;
  const match = filename.match(pattern);

  if (!match) {
    return {};
  }

  return {
    idPaese: match[1],
    idCodice: match[2],
    progressivoInvio: match[3],
    tipoFile: match[4] as ReceiptType,
    identificativoSdI: match[5],
  };
}

/**
 * Receipt Handler
 */
export class ReceiptHandler {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  /**
   * Parse receipt XML
   */
  parseReceipt(
    xml: string,
    type?: ReceiptType
  ): RicevutaConsegna | NotificaScarto | NotificaMancataConsegna | NotificaEsito | null {
    try {
      const parsed = this.parser.parse(xml);

      // Auto-detect type from XML root element if not provided
      if (!type) {
        if (parsed.RicevutaConsegna) type = 'RC';
        else if (parsed.NotificaScarto) type = 'NS';
        else if (parsed.NotificaMancataConsegna) type = 'MC';
        else if (parsed.NotificaEsito) type = 'NE';
        else return null;
      }

      switch (type) {
        case 'RC':
          return this.parseDeliveryReceipt(parsed);
        case 'NS':
          return this.parseRejectionNotice(parsed);
        case 'MC':
          return this.parseUndeliveredNotice(parsed);
        case 'NE':
          return this.parseOutcomeNotice(parsed);
        default:
          return null;
      }
    } catch (error) {
      console.error('Failed to parse receipt:', error);
      return null;
    }
  }

  /**
   * Parse delivery receipt (Ricevuta di Consegna)
   */
  private parseDeliveryReceipt(parsed: any): RicevutaConsegna | null {
    const data = parsed.RicevutaConsegna || parsed['ns2:RicevutaConsegna'];
    if (!data) return null;

    return {
      identifcativoSdI: data.IdentificativoSdI,
      nomeFile: data.NomeFile,
      hash: data.Hash,
      dataOraRicezione: data.DataOraRicezione,
      dataOraConsegna: data.DataOraConsegna,
      destinatario: {
        codice: data.Destinatario?.Codice,
        descrizione: data.Destinatario?.Descrizione,
      },
      ...(data.MessageIdCommittente && {
        messaggioPEC: { identificativo: data.MessageIdCommittente },
      }),
    };
  }

  /**
   * Parse rejection notice (Notifica di Scarto)
   */
  private parseRejectionNotice(parsed: any): NotificaScarto | null {
    const data = parsed.NotificaScarto || parsed['ns2:NotificaScarto'];
    if (!data) return null;

    const listaErrori = Array.isArray(data.ListaErrori?.Errore)
      ? data.ListaErrori.Errore
      : data.ListaErrori?.Errore
        ? [data.ListaErrori.Errore]
        : [];

    return {
      identifcativoSdI: data.IdentificativoSdI,
      nomeFile: data.NomeFile,
      hash: data.Hash,
      dataOraRicezione: data.DataOraRicezione,
      ...(data.RiferimentoFattura && {
        riferimentoFattura: {
          numeroFattura: data.RiferimentoFattura.NumeroFattura,
          annoFattura: data.RiferimentoFattura.AnnoFattura,
          posizione: data.RiferimentoFattura.PosizioneFattura,
        },
      }),
      listaErrori: listaErrori.map((err: any) => ({
        errore: {
          codice: err.Codice,
          descrizione: err.Descrizione,
          suggerimento: err.Suggerimento,
        },
      })),
      ...(data.MessageIdCommittente && {
        messaggioPEC: { identificativo: data.MessageIdCommittente },
      }),
    };
  }

  /**
   * Parse undelivered notice (Notifica di Mancata Consegna)
   */
  private parseUndeliveredNotice(parsed: any): NotificaMancataConsegna | null {
    const data = parsed.NotificaMancataConsegna || parsed['ns2:NotificaMancataConsegna'];
    if (!data) return null;

    return {
      identifcativoSdI: data.IdentificativoSdI,
      nomeFile: data.NomeFile,
      hash: data.Hash,
      dataOraRicezione: data.DataOraRicezione,
      descrizione: data.Descrizione,
      ...(data.MessageIdCommittente && {
        messaggioPEC: { identificativo: data.MessageIdCommittente },
      }),
    };
  }

  /**
   * Parse outcome notice (Notifica Esito)
   */
  private parseOutcomeNotice(parsed: any): NotificaEsito | null {
    const data = parsed.NotificaEsito || parsed['ns2:NotificaEsito'];
    if (!data) return null;

    return {
      identifcativoSdI: data.IdentificativoSdI,
      riferimentoFattura: {
        numeroFattura: data.RiferimentoFattura.NumeroFattura,
        annoFattura: data.RiferimentoFattura.AnnoFattura,
        posizione: data.RiferimentoFattura.PosizioneFattura,
      },
      esito: data.Esito,
      descrizione: data.Descrizione,
      messageIdCommittente: data.MessageIdCommittente,
      pecCommittente: data.PecCommittente,
      dataOraRicezione: data.DataOraRicezione,
    };
  }

  /**
   * Check if receipt indicates success
   */
  isSuccessReceipt(
    receipt: RicevutaConsegna | NotificaScarto | NotificaMancataConsegna | NotificaEsito
  ): boolean {
    if ('dataOraConsegna' in receipt) {
      return true; // Delivery receipt
    }
    if ('esito' in receipt) {
      return receipt.esito === 'EC01'; // Accepted
    }
    return false;
  }

  /**
   * Get error messages from receipt
   */
  getErrors(
    receipt: RicevutaConsegna | NotificaScarto | NotificaMancataConsegna | NotificaEsito
  ): string[] {
    if ('listaErrori' in receipt) {
      return receipt.listaErrori.map((e) => `${e.errore.codice}: ${e.errore.descrizione}`);
    }
    if ('descrizione' in receipt && typeof receipt.descrizione === 'string') {
      return [receipt.descrizione];
    }
    if ('esito' in receipt && receipt.esito === 'EC02') {
      return [receipt.descrizione || 'Invoice rejected by customer'];
    }
    return [];
  }
}
