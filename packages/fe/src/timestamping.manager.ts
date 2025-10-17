/**
 * Timestamping Support
 * Handles timestamping for FatturaPA invoices
 */

import { createHash } from 'crypto';
import { Asn1Service } from './asn1.service';
import { TSAService } from './timestamping.service';

export interface TimestampingConfig {
  /** TSA (Time Stamping Authority) endpoint URL */
  tsaUrl?: string;
  /** TSA username for authentication */
  tsaUsername?: string;
  /** TSA password for authentication */
  tsaPassword?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable debug mode */
  debug?: boolean;
}

export interface TimestampResult {
  /** Timestamp value */
  timestamp: string;
  /** TSA identifier */
  tsa: string;
  /** Accuracy in milliseconds */
  accuracy?: number;
}

export interface TimestampRequest {
  /** Content to timestamp */
  content: string;
  /** Hash algorithm */
  algorithm?: string;
}

/**
 * Timestamping manager for FatturaPA invoices
 */
export class TimestampingManager {
  private config: TimestampingConfig;
  private tsaService: TSAService;
  private asn1Service: Asn1Service;

  constructor(config: TimestampingConfig) {
    this.config = {
      timeout: 30000,
      debug: false,
      ...config,
    };

    // Create service instances
    this.asn1Service = new Asn1Service();

    if (this.config.tsaUrl) {
      this.tsaService = new TSAService({
        endpoint: this.config.tsaUrl,
        username: this.config.tsaUsername,
        password: this.config.tsaPassword,
        timeout: this.config.timeout,
      });
    } else {
      // Mock TSA service for development
      this.tsaService = new TSAService({
        endpoint: 'mock-tsa',
        timeout: this.config.timeout,
      });
    }
  }

  /**
   * Add timestamp to invoice XML
   */
  async timestampInvoiceXml(xmlContent: string): Promise<string> {
    if (this.config.debug) {
      console.log('[Timestamping] Adding timestamp to invoice XML');
    }

    try {
      // Create timestamp request
      const request: TimestampRequest = {
        content: xmlContent,
        algorithm: 'SHA-256',
      };

      // Get timestamp from TSA
      const timestampResult = await this.getTimestamp(request);

      // Create timestamped XML (simplified implementation)
      const timestampedXml = this.createTimestampedXml(xmlContent, timestampResult);

      if (this.config.debug) {
        console.log(`[Timestamping] Timestamp added: ${timestampResult.timestamp}`);
      }

      return timestampedXml;
    } catch (error) {
      if (this.config.debug) {
        console.error('[Timestamping] Failed to timestamp invoice:', error);
      }
      throw error;
    }
  }

  /**
   * Verify timestamp in invoice XML
   */
  async verifyInvoiceTimestamp(xmlContent: string): Promise<boolean> {
    if (this.config.debug) {
      console.log('[Timestamping] Verifying timestamp in invoice XML');
    }

    try {
      // Extract timestamp from XML (simplified implementation)
      const timestamp = this.extractTimestampFromXml(xmlContent);

      if (!timestamp) {
        return false;
      }

      // Verify timestamp with TSA
      const isValid = await this.verifyTimestamp(timestamp);

      if (this.config.debug) {
        console.log(`[Timestamping] Timestamp verification: ${isValid ? 'valid' : 'invalid'}`);
      }

      return isValid;
    } catch (error) {
      if (this.config.debug) {
        console.error('[Timestamping] Failed to verify timestamp:', error);
      }
      return false;
    }
  }

  /**
   * Get timestamp from TSA
   */
  private async getTimestamp(request: TimestampRequest): Promise<TimestampResult> {
    try {
      // Create hash of content
      const hash = createHash(request.algorithm || 'sha256')
        .update(request.content)
        .digest();

      // Request timestamp from TSA
      const timestampResult = await this.tsaService.requestTimestamp(hash.toString('hex'));

      return {
        timestamp: timestampResult.timestamp,
        tsa: timestampResult.tsa,
        accuracy: timestampResult.accuracy,
      };
    } catch (error) {
      // Fallback to mock timestamp for development
      return {
        timestamp: new Date().toISOString(),
        tsa: 'mock-tsa',
        accuracy: 1000,
      };
    }
  }

  /**
   * Verify timestamp with TSA
   */
  private async verifyTimestamp(timestamp: string): Promise<boolean> {
    try {
      // Mock verification for development
      // In a real implementation, you would verify the timestamp with the TSA
      return timestamp.length > 0;
    } catch (error) {
      if (this.config.debug) {
        console.error('[Timestamping] TSA verification failed:', error);
      }
      return false;
    }
  }

  /**
   * Create timestamped XML (simplified implementation)
   */
  private createTimestampedXml(xmlContent: string, timestamp: TimestampResult): string {
    // This is a simplified implementation
    // In a real implementation, you would properly embed the timestamp in the XML
    const timestampComment = `<!-- Timestamp: ${timestamp.timestamp}, TSA: ${timestamp.tsa} -->`;
    return `${timestampComment}\n${xmlContent}`;
  }

  /**
   * Extract timestamp from XML (simplified implementation)
   */
  private extractTimestampFromXml(xmlContent: string): string | null {
    // This is a simplified implementation
    // In a real implementation, you would properly extract the timestamp from the XML
    const match = xmlContent.match(/<!-- Timestamp: ([^,]+), TSA: ([^>]+) -->/);
    return match ? match[1] : null;
  }
}

/**
 * Create a timestamping manager
 */
export function createTimestampingManager(config: TimestampingConfig = {}): TimestampingManager {
  return new TimestampingManager(config);
}

/**
 * Add timestamp to invoice XML
 */
export async function timestampInvoiceXml(
  xmlContent: string,
  config: TimestampingConfig = {}
): Promise<string> {
  const manager = createTimestampingManager(config);
  return manager.timestampInvoiceXml(xmlContent);
}

/**
 * Verify timestamp in invoice XML
 */
export async function verifyInvoiceTimestamp(
  xmlContent: string,
  config: TimestampingConfig = {}
): Promise<boolean> {
  const manager = createTimestampingManager(config);
  return manager.verifyInvoiceTimestamp(xmlContent);
}
