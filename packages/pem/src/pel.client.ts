/**
 * PEL Client
 * Used by PEM to communicate with PEL server
 */

import type { DocumentoCommerciale, Journal } from '@openade/common';

export interface PELClientConfig {
  pelBaseUrl: string;
  timeout?: number;
}

export interface SessionSeed {
  seed: string;
  sessionId: string;
}

export interface TransmissionResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Client for PEM to communicate with PEL
 * PEM sends documents and journals to PEL in real-time
 */
export class PELClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: PELClientConfig) {
    this.baseUrl = config.pelBaseUrl.replace(/\/$/, '');
    this.timeout = config.timeout || 30000;
  }

  /**
   * Get session seed from PEL
   * Called when PEM opens a new cash session
   */
  async getSessionSeed(): Promise<SessionSeed> {
    const response = await this.request<SessionSeed>('GET', '/api/session/seed');
    return response;
  }

  /**
   * Send document to PEL in real-time
   * Called after each transaction
   */
  async sendDocument(document: DocumentoCommerciale): Promise<TransmissionResult> {
    try {
      const response = await this.request<{ messageId: string }>('POST', '/api/document', document);
      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send journal to PEL
   * Called at cash session close
   */
  async sendJournal(journal: Journal): Promise<TransmissionResult> {
    try {
      const response = await this.request<{ messageId: string }>('POST', '/api/journal', journal);
      return {
        success: true,
        messageId: response.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Notify PEL of connection error
   * Used for monitoring and anomaly reporting
   */
  async reportConnectionError(error: {
    pemId: string;
    errorType: string;
    details: string;
    timestamp: string;
  }): Promise<void> {
    await this.request('POST', '/api/anomaly', error);
  }

  /**
   * Generic HTTP request handler
   */
  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`PEL request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PEL request timeout');
      }

      throw error;
    }
  }
}
