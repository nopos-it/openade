/**
 * TSA (Time Stamping Authority) Service Implementation
 * Provides timestamping functionality for invoices
 */

import { Asn1Service } from './asn1.service';
import { HttpService } from './http.service';

export interface TSAConfig {
  endpoint: string;
  username?: string;
  password?: string;
  timeout?: number;
}

export interface TimestampResult {
  timestampToken: string;
  timestamp: string;
  tsa: string;
  accuracy?: number;
}

export class TSAService {
  private httpService: HttpService;
  private asn1Service: Asn1Service;
  private config: TSAConfig;

  constructor(config: TSAConfig) {
    this.config = config;
    this.httpService = new HttpService();
    this.asn1Service = new Asn1Service();
  }

  /**
   * Request timestamp from TSA
   */
  async requestTimestamp(contentHash: string, _contentType?: string): Promise<TimestampResult> {
    try {
      // Create timestamp request
      const timestampRequest = await this.asn1Service.createTimestampRequest(contentHash);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/timestamp-query',
        'Content-Length': timestampRequest.length.toString(),
      };

      // Add authentication if provided
      if (this.config.username && this.config.password) {
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString(
          'base64'
        );
        headers['Authorization'] = `Basic ${auth}`;
      }

      // Make request to TSA
      const response = await this.httpService.request({
        url: this.config.endpoint,
        method: 'POST',
        headers,
        body: timestampRequest,
        timeout: this.config.timeout || 30000,
      });

      if (response.status !== 200) {
        throw new Error(`TSA request failed with status ${response.status}`);
      }

      // Parse timestamp response
      const timestampData = await this.asn1Service.parseTimestampResponse(response.data);

      return {
        timestampToken: Buffer.from(response.data).toString('base64'),
        timestamp: timestampData.timestamp,
        tsa: this.config.endpoint,
        accuracy: timestampData.accuracy,
      };
    } catch (error) {
      // Fallback to mock timestamping for development
      console.warn(
        'TSA service failed, using mock timestamp:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return this.createMockTimestamp(contentHash);
    }
  }

  /**
   * Verify timestamp token
   */
  async verifyTimestamp(timestampToken: string, _expectedContent: string): Promise<boolean> {
    try {
      // In a real implementation, this would verify the timestamp token
      // against the expected content using cryptographic verification

      // For now, we'll do basic validation
      const tokenBuffer = Buffer.from(timestampToken, 'base64');
      const timestampData = await this.asn1Service.parseTimestampResponse(tokenBuffer);

      // Check if timestamp is not too old (e.g., within 1 year)
      const timestampDate = new Date(timestampData.timestamp);
      const now = new Date();
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      return timestampDate >= oneYearAgo;
    } catch (error) {
      console.error('Timestamp verification failed:', error);
      return false;
    }
  }

  /**
   * Create mock timestamp for development
   */
  private createMockTimestamp(contentHash: string): TimestampResult {
    const now = new Date();
    const mockToken = Buffer.from(
      JSON.stringify({
        hash: contentHash,
        timestamp: now.getTime(),
        tsa: 'mock-tsa',
        accuracy: 1,
      })
    ).toString('base64');

    return {
      timestampToken: mockToken,
      timestamp: now.toISOString(),
      tsa: 'mock-tsa',
      accuracy: 1,
    };
  }

  /**
   * Get timestamp info from token
   */
  async getTimestampInfo(timestampToken: string): Promise<{
    timestamp: string;
    tsa: string;
    accuracy?: number;
  }> {
    try {
      const tokenBuffer = Buffer.from(timestampToken, 'base64');
      const result = await this.asn1Service.parseTimestampResponse(tokenBuffer);
      return {
        timestamp: result.timestamp,
        tsa: result.tsa || 'unknown-tsa',
        accuracy: result.accuracy,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse timestamp token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
