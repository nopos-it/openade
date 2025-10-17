/**
 * SDICOOP Client
 * Web service client for SDI transmission via SOAP
 */

import type { InvoiceTransmissionResult } from '@nopos-ade/common';
import { HttpService } from './http.service';
import { XmlService } from './xml.service';

export interface SDICOOPConfig {
  /** SDI endpoint URL */
  endpoint: string;
  /** Authentication certificate path (for mutual TLS) */
  certPath?: string;
  /** Authentication key path (for mutual TLS) */
  keyPath?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * SDICOOP Client for web service transmission
 */
export class SDICOOPClient {
  private config: SDICOOPConfig;
  private xmlService: XmlService;
  private httpService: HttpService;

  constructor(config: SDICOOPConfig) {
    this.config = {
      timeout: 30000,
      debug: false,
      ...config,
    };

    // Create service instances
    this.xmlService = new XmlService();
    this.httpService = new HttpService();
  }

  /**
   * Send invoice via SDICOOP web service
   */
  async sendInvoice(filename: string, xmlContent: string): Promise<InvoiceTransmissionResult> {
    if (this.config.debug) {
      console.log(`[SDICOOP] Sending invoice: ${filename}`);
    }

    try {
      const result = await this.sendViaSdiCoop(filename, xmlContent);

      if (this.config.debug) {
        console.log(`[SDICOOP] Response: IdentificativoSdI=${result.identificativoSdI}`);
      }

      return {
        success: true,
        identifcativoSdI: result.identificativoSdI,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Query invoice status
   */
  async queryInvoiceStatus(identificativoSdI: string): Promise<{
    status: 'pending' | 'delivered' | 'rejected' | 'error';
    details?: string;
  }> {
    if (this.config.debug) {
      console.log(`[SDICOOP] Querying status for: ${identificativoSdI}`);
    }

    try {
      // Create SOAP request for status query
      const soapRequest = this.createStatusQueryRequest(identificativoSdI);

      const response = await this.httpService.request({
        url: this.config.endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://www.fatturapa.gov.it/sdi/ws/trasmissione/v1.0/richiestaStatoFattura',
        },
        body: soapRequest,
        timeout: this.config.timeout,
      });

      if (response.status !== 200) {
        throw new Error(`SDI request failed with status ${response.status}`);
      }

      const parsed = await this.xmlService.parse(response.data);
      return this.parseStatusResponse(parsed);
    } catch (error) {
      return {
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send invoice via SDICOOP
   */
  private async sendViaSdiCoop(
    filename: string,
    xmlContent: string
  ): Promise<{ identificativoSdI: string }> {
    // Create SOAP request
    const soapRequest = this.createInvoiceRequest(filename, xmlContent);

    const response = await this.httpService.request({
      url: this.config.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://www.fatturapa.gov.it/sdi/ws/trasmissione/v1.0/riceviFatture',
      },
      body: soapRequest,
      timeout: this.config.timeout,
    });

    if (response.status !== 200) {
      throw new Error(`SDI request failed with status ${response.status}`);
    }

    // Parse SOAP response
    const parsed = await this.xmlService.parse(response.data);
    return this.parseInvoiceResponse(parsed);
  }

  /**
   * Create SOAP request for invoice transmission
   */
  private createInvoiceRequest(filename: string, xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.fatturapa.gov.it/sdi/ws/trasmissione/v1.0">
  <soap:Header/>
  <soap:Body>
    <ns:riceviFatture>
      <ns:fileSdI>
        <ns:nomeFile>${filename}</ns:nomeFile>
        <ns:contenuto>${Buffer.from(xmlContent).toString('base64')}</ns:contenuto>
      </ns:fileSdI>
    </ns:riceviFatture>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Create SOAP request for status query
   */
  private createStatusQueryRequest(identificativoSdI: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns="http://www.fatturapa.gov.it/sdi/ws/trasmissione/v1.0">
  <soap:Header/>
  <soap:Body>
    <ns:richiestaStatoFattura>
      <ns:identificativoSdI>${identificativoSdI}</ns:identificativoSdI>
    </ns:richiestaStatoFattura>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Parse invoice response
   */
  private parseInvoiceResponse(parsed: any): { identificativoSdI: string } {
    const soapBody = parsed['soap:Envelope']?.['soap:Body'];
    const response = soapBody?.['ns:riceviFattureResponse'];

    if (!response) {
      throw new Error('Invalid SOAP response format');
    }

    const identificativoSdI = response['ns:identificativoSdI'];
    if (!identificativoSdI) {
      throw new Error('Missing IdentificativoSdI in response');
    }

    return { identificativoSdI };
  }

  /**
   * Parse status response
   */
  private parseStatusResponse(parsed: any): {
    status: 'pending' | 'delivered' | 'rejected' | 'error';
    details?: string;
  } {
    const soapBody = parsed['soap:Envelope']?.['soap:Body'];
    const response = soapBody?.['ns:richiestaStatoFatturaResponse'];

    if (!response) {
      return { status: 'error', details: 'Invalid response format' };
    }

    const stato = response['ns:stato'];
    const descrizione = response['ns:descrizione'];

    // Map SDI status to our status
    switch (stato) {
      case 'INVIATA':
        return { status: 'pending', details: descrizione };
      case 'CONSEGNATA':
        return { status: 'delivered', details: descrizione };
      case 'SCARTATA':
        return { status: 'rejected', details: descrizione };
      default:
        return { status: 'pending', details: descrizione };
    }
  }
}
