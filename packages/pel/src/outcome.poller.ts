/**
 * Outcome Poller for ADE
 * Polls ADE for daily receipts transmission outcomes
 */

import type { CorrispettiviEsito } from '@nopos-ade/common';
import type { ADEClient } from './ade.client';
import type { IDatabase } from './database.interface';

export interface OutcomePollerConfig {
  /** Database instance */
  database: IDatabase;
  /** ADE client instance */
  adeClient: ADEClient;
  /** Polling interval in milliseconds (default: 5 minutes) */
  pollingInterval?: number;
  /** Maximum retries for failed polls */
  maxRetries?: number;
}

export interface PendingTransmission {
  vatNumber: string;
  emissionPointId: string;
  referenceDate: string;
  transmittedAt: Date;
  retries: number;
}

/**
 * Outcome Poller
 * Automatically polls ADE for transmission outcomes and saves them to database
 */
export class OutcomePoller {
  private config: OutcomePollerConfig;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private pendingTransmissions: Map<string, PendingTransmission> = new Map();

  constructor(config: OutcomePollerConfig) {
    this.config = {
      pollingInterval: 5 * 60 * 1000, // 5 minutes
      maxRetries: 288, // 24 hours with 5 min intervals
      ...config,
    };
  }

  /**
   * Start polling for outcomes
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Outcome poller already running');
      return;
    }

    console.log(`Starting outcome poller (interval: ${this.config.pollingInterval}ms)`);
    this.isRunning = true;

    // Initial poll
    this.poll().catch(console.error);

    // Schedule periodic polls
    this.intervalId = setInterval(() => {
      this.poll().catch(console.error);
    }, this.config.pollingInterval);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping outcome poller');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Register a transmission to poll for outcome
   */
  registerTransmission(transmission: Omit<PendingTransmission, 'retries'>): void {
    const key = this.getTransmissionKey(
      transmission.vatNumber,
      transmission.emissionPointId,
      transmission.referenceDate
    );

    this.pendingTransmissions.set(key, {
      ...transmission,
      retries: 0,
    });

    console.log(`Registered transmission for polling: ${key}`);
  }

  /**
   * Perform polling cycle
   */
  private async poll(): Promise<void> {
    if (this.pendingTransmissions.size === 0) {
      return;
    }

    console.log(`Polling ${this.pendingTransmissions.size} pending transmissions...`);

    const toRemove: string[] = [];

    for (const [key, transmission] of this.pendingTransmissions.entries()) {
      try {
        // Check if outcome is available from ADE
        const outcome = await this.checkOutcome(transmission);

        if (outcome) {
          // Save outcome to database
          await this.config.database.saveDailyReceiptsOutcome(outcome);

          console.log(
            `✓ Outcome received for ${key}: ${outcome.codiceEsito} - ${outcome.descrizioneEsito}`
          );

          // Mark for removal
          toRemove.push(key);
        } else {
          // Increment retry count
          transmission.retries++;

          if (transmission.retries >= (this.config.maxRetries || 288)) {
            console.warn(`Max retries reached for ${key}, removing from poll queue`);
            toRemove.push(key);
          }
        }
      } catch (error) {
        console.error(`Error polling outcome for ${key}:`, error);
        transmission.retries++;

        if (transmission.retries >= (this.config.maxRetries || 288)) {
          toRemove.push(key);
        }
      }
    }

    // Remove completed/expired transmissions
    for (const key of toRemove) {
      this.pendingTransmissions.delete(key);
    }

    if (toRemove.length > 0) {
      console.log(`Removed ${toRemove.length} transmissions from poll queue`);
    }
  }

  /**
   * Check outcome from ADE
   * Returns outcome if available, null otherwise
   */
  private async checkOutcome(
    transmission: PendingTransmission
  ): Promise<CorrispettiviEsito | null> {
    try {
      // Query ADE for outcome
      // In a real implementation, you would call the appropriate ADE endpoint
      // For now, we check the database to see if it's been manually updated
      const existing = await this.config.database.getDailyReceiptsOutcome(
        transmission.vatNumber,
        transmission.emissionPointId,
        transmission.referenceDate
      );

      return existing;
    } catch (error) {
      console.error('Error checking outcome from ADE:', error);
      return null;
    }
  }

  /**
   * Generate unique key for transmission
   */
  private getTransmissionKey(
    vatNumber: string,
    emissionPointId: string,
    referenceDate: string
  ): string {
    return `${vatNumber}_${emissionPointId}_${referenceDate}`;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.pendingTransmissions.size;
  }

  /**
   * Get pending transmissions
   */
  getPendingTransmissions(): PendingTransmission[] {
    return Array.from(this.pendingTransmissions.values());
  }
}
