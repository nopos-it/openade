/**
 * REST API client for communication with Agenzia delle Entrate
 * Implements the SSW (Soluzione Software) REST API specifications
 */

import type {
  CorrispettiviEsito,
  CorrispettiviGiornalieri,
  DocumentoCommerciale,
  EmissionPointActivationResult,
  EmissionPointCensus,
  EmissionPointStatusInfo,
  Journal,
  TransmissionOutcome,
} from '@openade/common';
import type { AnomalyReport } from './anomaly.manager';

import {
  buildAnomaliesXML,
  buildCommercialDocumentXML,
  buildDailyReceiptsXML,
  buildEmissionPointCensusXML,
  buildJournalXML,
} from '@openade/common';

/**
 * Configuration for API client
 */
export interface APIClientConfig {
  /** Base URL for Agenzia delle Entrate API */
  baseURL: string;
  /** Authentication token or certificate */
  authToken?: string;
  /** Path to client certificate (for mutual TLS) */
  certPath?: string;
  /** Path to client private key (for mutual TLS) */
  keyPath?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<APIClientConfig> = {
  // Production URL (example - actual URL from Agenzia delle Entrate documentation)
  baseURL: 'https://corrispettivi.agenziaentrate.gov.it/api/v1',
  timeout: 30000,
  debug: false,
};

/**
 * API Client for Agenzia delle Entrate electronic receipts system
 */
export class ADEClient {
  private config: APIClientConfig;

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as APIClientConfig;
  }

  /**
   * Make HTTP request to Agenzia delle Entrate API
   * @private
   */
  private async request<T>(
    endpoint: string,
    method: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/xml',
      Accept: 'application/xml',
      ...headers,
    };

    // Add authentication if provided
    if (this.config.authToken) {
      requestHeaders['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    // Debug logging
    if (this.config.debug) {
      console.log(`[ADE API] ${method} ${url}`);
      if (body) {
        console.log('[ADE API] Request body:', body);
      }
    }

    try {
      // Use fetch API (available in Node.js 18+)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();

      if (this.config.debug) {
        console.log(`[ADE API] Response status: ${response.status}`);
        console.log('[ADE API] Response body:', responseText);
      }

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}\n${responseText}`
        );
      }

      // Parse XML response (simplified - in production, use XML parser)
      // For now, return the text response
      return responseText as any;
    } catch (error) {
      if (this.config.debug) {
        console.error('[ADE API] Request error:', error);
      }
      throw error;
    }
  }

  /**
   * Census a new PEM (Emission Point) device
   * @param census - PEM census data
   * @returns Activation outcome
   */
  async censusEmissionPoint(census: EmissionPointCensus): Promise<EmissionPointActivationResult> {
    const xml = buildEmissionPointCensusXML(census);

    return await this.request<EmissionPointActivationResult>('/pem/censimento', 'POST', xml);
  }

  /**
   * Get PEM status
   * @param vatNumber - Taxpayer VAT number
   * @param emissionPointId - PEM identifier
   * @returns PEM status information
   */
  async getEmissionPointStatus(
    vatNumber: string,
    emissionPointId: string
  ): Promise<EmissionPointStatusInfo> {
    return await this.request<EmissionPointStatusInfo>(
      `/pem/${vatNumber}/${emissionPointId}`,
      'GET'
    );
  }

  /**
   * Deactivate a PEM device
   * @param vatNumber - Taxpayer VAT number
   * @param emissionPointId - PEM identifier
   * @returns Deactivation outcome
   */
  async deactivateEmissionPoint(
    vatNumber: string,
    emissionPointId: string
  ): Promise<TransmissionOutcome> {
    return await this.request<TransmissionOutcome>(
      `/pem/${vatNumber}/${emissionPointId}`,
      'DELETE'
    );
  }

  /**
   * Transmit daily receipts (corrispettivi giornalieri)
   * @param corrispettivi - Daily receipts data
   * @returns Transmission outcome
   */
  async trasmissioneCorrispettivi(
    corrispettivi: CorrispettiviGiornalieri
  ): Promise<CorrispettiviEsito> {
    const xml = buildDailyReceiptsXML(corrispettivi);

    return await this.request<CorrispettiviEsito>('/corrispettivi', 'POST', xml);
  }

  /**
   * Get transmission status for daily receipts
   * @param partitaIVA - Taxpayer VAT number
   * @param identificativoPEM - PEM identifier
   * @param dataRiferimento - Reference date (YYYY-MM-DD)
   * @returns Transmission outcome
   */
  async getEsitoCorrispettivi(
    partitaIVA: string,
    identificativoPEM: string,
    dataRiferimento: string
  ): Promise<CorrispettiviEsito> {
    return await this.request<CorrispettiviEsito>(
      `/corrispettivi/${partitaIVA}/${identificativoPEM}/${dataRiferimento}`,
      'GET'
    );
  }

  /**
   * Transmit a commercial document (receipt/invoice)
   * @param documento - Commercial document data
   * @returns Transmission outcome
   */
  async trasmissioneDocumento(documento: DocumentoCommerciale): Promise<TransmissionOutcome> {
    const xml = buildCommercialDocumentXML(documento);

    return await this.request<TransmissionOutcome>('/documenti', 'POST', xml);
  }

  /**
   * Transmit journal data
   * @param journal - Journal data
   * @returns Transmission outcome
   */
  async trasmissioneJournal(journal: Journal): Promise<TransmissionOutcome> {
    const xml = buildJournalXML(journal);

    return await this.request<TransmissionOutcome>('/journal', 'POST', xml);
  }

  /**
   * Query journal data for audit purposes
   * @param partitaIVA - Taxpayer VAT number
   * @param identificativoPEM - PEM identifier
   * @param dataDa - Start date (YYYY-MM-DD)
   * @param dataA - End date (YYYY-MM-DD)
   * @returns Journal data
   */
  async richiestaJournal(
    partitaIVA: string,
    identificativoPEM: string,
    dataDa: string,
    dataA: string
  ): Promise<Journal[]> {
    return await this.request<Journal[]>(
      `/journal/${partitaIVA}/${identificativoPEM}?dataDa=${dataDa}&dataA=${dataA}`,
      'GET'
    );
  }

  /**
   * Query commercial documents for audit purposes
   * @param partitaIVA - Taxpayer VAT number
   * @param identificativoPEM - PEM identifier
   * @param dataDa - Start date (YYYY-MM-DD)
   * @param dataA - End date (YYYY-MM-DD)
   * @returns Commercial documents
   */
  async richiestaDocumenti(
    partitaIVA: string,
    identificativoPEM: string,
    dataDa: string,
    dataA: string
  ): Promise<DocumentoCommerciale[]> {
    return await this.request<DocumentoCommerciale[]>(
      `/documenti/${partitaIVA}/${identificativoPEM}?dataDa=${dataDa}&dataA=${dataA}`,
      'GET'
    );
  }

  /**
   * Transmit anomalies to ADE
   * Implements the anomaly transmission endpoint as per SSW specifications 3.3.2
   * @param anomalies - Array of anomaly reports
   * @returns Transmission outcome
   */
  async trasmissioneAnomalie(anomalies: AnomalyReport[]): Promise<{
    success: boolean;
    message?: string;
  }> {
    // Build XML using common builder
    const xml = buildAnomaliesXML(anomalies);

    return await this.request<{ success: boolean; message?: string }>('/anomalie', 'POST', xml);
  }
}
