/**
 * Batch Processing Support
 * Handles batch processing for high-volume invoice scenarios
 */

import type { FatturaElettronica, InvoiceTransmissionResult } from '@openade/common';
import { buildInvoiceXML } from './invoice.xml';
import { SDICOOPClient, type SDICOOPConfig } from './sdicoop.client';

export interface BatchConfig {
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Delay between batches in milliseconds */
  batchDelay?: number;
  /** Maximum concurrent batches */
  maxConcurrentBatches?: number;
  /** Retry configuration */
  retry?: {
    maxRetries?: number;
    retryDelay?: number;
    backoffMultiplier?: number;
  };
  /** Progress callback */
  onProgress?: (progress: BatchProgress) => void;
  /** Error callback */
  onError?: (error: BatchError) => void;
}

export interface BatchItem {
  /** Unique identifier for the batch item */
  id: string;
  /** Invoice data */
  invoice: FatturaElettronica;
  /** Filename for the invoice */
  filename: string;
  /** Transmission channel */
  channel: 'SDICOOP' | 'SDIFTP';
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface BatchProgress {
  /** Total items in batch */
  total: number;
  /** Completed items */
  completed: number;
  /** Failed items */
  failed: number;
  /** Pending items */
  pending: number;
  /** Current batch number */
  currentBatch: number;
  /** Total batches */
  totalBatches: number;
  /** Progress percentage */
  percentage: number;
  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;
}

export interface BatchError {
  /** Item ID that failed */
  itemId: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: any;
  /** Retry count */
  retryCount: number;
  /** Timestamp */
  timestamp: string;
}

export interface BatchResult {
  /** Total items processed */
  total: number;
  /** Successfully processed items */
  successful: number;
  /** Failed items */
  failed: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Results for each item */
  results: Array<{
    id: string;
    success: boolean;
    result?: InvoiceTransmissionResult;
    error?: string;
    retryCount: number;
  }>;
  /** Summary statistics */
  summary: {
    successRate: number;
    averageProcessingTime: number;
    errors: BatchError[];
  };
}

/**
 * Batch processor for high-volume invoice transmission
 */
export class BatchProcessor {
  private sdiClient: SDICOOPClient;
  private config: BatchConfig;

  constructor(sdiConfig: SDICOOPConfig, batchConfig: BatchConfig = {}) {
    this.sdiClient = new SDICOOPClient(sdiConfig);
    this.config = {
      maxBatchSize: 100,
      batchDelay: 1000,
      maxConcurrentBatches: 3,
      retry: {
        maxRetries: 3,
        retryDelay: 5000,
        backoffMultiplier: 2,
      },
      ...batchConfig,
    };
  }

  /**
   * Process a batch of invoices
   */
  async processBatch(items: BatchItem[]): Promise<BatchResult> {
    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    const errors: BatchError[] = [];
    let completed = 0;
    let failed = 0;

    // Split items into batches
    const batches = this.splitIntoBatches(items);
    const totalBatches = batches.length;

    if (this.config.onProgress) {
      this.config.onProgress({
        total: items.length,
        completed: 0,
        failed: 0,
        pending: items.length,
        currentBatch: 0,
        totalBatches,
        percentage: 0,
      });
    }

    // Process batches with concurrency control
    const batchPromises: Promise<void>[] = [];
    const semaphore = new Semaphore(this.config.maxConcurrentBatches!);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNumber = i + 1;

      const batchPromise = semaphore.acquire().then(async (release) => {
        try {
          const batchResults = await this.processSingleBatch(batch, batchNumber, totalBatches);
          results.push(...batchResults);

          // Update counters
          for (const result of batchResults) {
            if (result.success) {
              completed++;
            } else {
              failed++;
              errors.push({
                itemId: result.id,
                message: result.error || 'Unknown error',
                retryCount: result.retryCount,
                timestamp: new Date().toISOString(),
              });
            }
          }

          // Report progress
          if (this.config.onProgress) {
            this.config.onProgress({
              total: items.length,
              completed,
              failed,
              pending: items.length - completed - failed,
              currentBatch: batchNumber,
              totalBatches,
              percentage: Math.round(((completed + failed) / items.length) * 100),
              estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(
                startTime,
                completed + failed,
                items.length
              ),
            });
          }

          // Delay between batches
          if (batchNumber < totalBatches && this.config.batchDelay! > 0) {
            await this.delay(this.config.batchDelay!);
          }
        } finally {
          release();
        }
      });

      batchPromises.push(batchPromise);
    }

    // Wait for all batches to complete
    await Promise.all(batchPromises);

    const processingTime = Date.now() - startTime;
    const successful = results.filter((r) => r.success).length;

    return {
      total: items.length,
      successful,
      failed,
      processingTime,
      results,
      summary: {
        successRate: items.length > 0 ? (successful / items.length) * 100 : 0,
        averageProcessingTime: results.length > 0 ? processingTime / results.length : 0,
        errors,
      },
    };
  }

  /**
   * Process a single batch of items
   */
  private async processSingleBatch(
    items: BatchItem[],
    batchNumber: number,
    totalBatches: number
  ): Promise<BatchResult['results']> {
    const results: BatchResult['results'] = [];

    for (const item of items) {
      let retryCount = 0;
      let success = false;
      let result: InvoiceTransmissionResult | undefined;
      let error: string | undefined;

      while (retryCount <= this.config.retry!.maxRetries! && !success) {
        try {
          // Generate XML for invoice
          const xml = buildInvoiceXML(item.invoice);

          // Transmit to SDI
          result = await this.sdiClient.sendInvoice(item.filename, xml);
          success = result.success;

          if (!success) {
            error = result.error;
          }
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
        }

        if (!success && retryCount < this.config.retry!.maxRetries!) {
          retryCount++;
          const delay =
            this.config.retry!.retryDelay! *
            Math.pow(this.config.retry!.backoffMultiplier!, retryCount - 1);
          await this.delay(delay);
        } else {
          break;
        }
      }

      results.push({
        id: item.id,
        success,
        result,
        error,
        retryCount,
      });

      // Report error if failed
      if (!success && this.config.onError) {
        this.config.onError({
          itemId: item.id,
          message: error || 'Unknown error',
          retryCount,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Split items into batches
   */
  private splitIntoBatches(items: BatchItem[]): BatchItem[][] {
    const batches: BatchItem[][] = [];
    const batchSize = this.config.maxBatchSize!;

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateEstimatedTimeRemaining(
    startTime: number,
    completed: number,
    total: number
  ): number {
    if (completed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const rate = completed / elapsed;
    const remaining = total - completed;

    return Math.round(remaining / rate);
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next) next();
    }
  }
}

/**
 * Create a batch processor
 */
export function createBatchProcessor(
  sdiConfig: SDICOOPConfig,
  batchConfig: BatchConfig = {}
): BatchProcessor {
  return new BatchProcessor(sdiConfig, batchConfig);
}

/**
 * Process invoices in batch
 */
export async function processInvoiceBatch(
  invoices: Array<{
    invoice: FatturaElettronica;
    filename: string;
    channel: 'SDICOOP' | 'SDIFTP';
    metadata?: Record<string, any>;
  }>,
  sdiConfig: SDICOOPConfig,
  batchConfig: BatchConfig = {}
): Promise<BatchResult> {
  const processor = createBatchProcessor(sdiConfig, batchConfig);

  const items: BatchItem[] = invoices.map((inv, index) => ({
    id: `invoice_${index}_${Date.now()}`,
    invoice: inv.invoice,
    filename: inv.filename,
    channel: inv.channel,
    metadata: inv.metadata,
  }));

  return await processor.processBatch(items);
}
