/**
 * Lottery Code Generator
 * Generates lottery codes for instant and deferred lottery
 */

import type { LotteryCode, LotteryType } from '@openade/common';
import { createHash, randomBytes } from 'crypto';

export interface LotteryGeneratorConfig {
  /** Enable instant lottery */
  enableInstant?: boolean;
  /** Enable deferred lottery */
  enableDeferred?: boolean;
  /** Minimum amount for lottery participation (default: 1.00 EUR) */
  minimumAmount?: number;
}

/**
 * Lottery Code Generator
 * Generates codes according to Agenzia delle Entrate specifications
 */
export class LotteryGenerator {
  private config: LotteryGeneratorConfig;
  private sequenceCounter: number = 0;

  constructor(config: LotteryGeneratorConfig = {}) {
    this.config = {
      enableInstant: true,
      enableDeferred: true,
      minimumAmount: 1.0,
      ...config,
    };
  }

  /**
   * Generate instant lottery code
   * Returns null if amount is below minimum or instant lottery is disabled
   */
  generateInstantCode(
    documentNumber: string,
    amount: number,
    timestamp?: Date
  ): LotteryCode | null {
    if (!this.config.enableInstant) {
      return null;
    }

    if (amount < (this.config.minimumAmount || 1.0)) {
      return null;
    }

    const code = this.generateCode('I', documentNumber);

    return {
      type: 'INSTANT',
      code,
      generatedAt: (timestamp || new Date()).toISOString(),
      documentNumber,
    };
  }

  /**
   * Generate deferred lottery code
   * Requires customer fiscal code
   * Returns null if amount is below minimum, no fiscal code, or deferred lottery is disabled
   */
  generateDeferredCode(
    documentNumber: string,
    amount: number,
    customerFiscalCode: string,
    timestamp?: Date
  ): LotteryCode | null {
    if (!this.config.enableDeferred) {
      return null;
    }

    if (amount < (this.config.minimumAmount || 1.0)) {
      return null;
    }

    if (!customerFiscalCode || customerFiscalCode.length === 0) {
      return null;
    }

    const code = this.generateCode('D', documentNumber, customerFiscalCode);

    return {
      type: 'DEFERRED',
      code,
      generatedAt: (timestamp || new Date()).toISOString(),
      documentNumber,
      customerFiscalCode,
    };
  }

  /**
   * Generate lottery code string
   * Format: PREFIX-XXXXXXXXXX (10 alphanumeric characters)
   */
  private generateCode(prefix: string, documentNumber: string, fiscalCode?: string): string {
    // Increment sequence
    this.sequenceCounter = (this.sequenceCounter + 1) % 1000000;

    // Create hash from multiple inputs for uniqueness
    const hash = createHash('sha256')
      .update(prefix)
      .update(documentNumber)
      .update(this.sequenceCounter.toString())
      .update(Date.now().toString())
      .update(randomBytes(8))
      .update(fiscalCode || '')
      .digest('hex');

    // Take first 10 characters and convert to uppercase alphanumeric
    const alphanumeric = hash
      .substring(0, 10)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    // Ensure exactly 10 characters by padding if needed
    const padded = (alphanumeric + '0000000000').substring(0, 10);

    return `${prefix}-${padded}`;
  }

  /**
   * Generate QR code data for lottery
   * Returns data string to be encoded in QR code
   */
  generateQRCodeData(lotteryCode: LotteryCode): string {
    // Format: TYPE|CODE|TIMESTAMP|DOCUMENT_NUMBER
    return [
      lotteryCode.type,
      lotteryCode.code,
      lotteryCode.generatedAt,
      lotteryCode.documentNumber,
    ].join('|');
  }

  /**
   * Validate lottery code format
   */
  static validateCode(code: string): boolean {
    // Format: I-XXXXXXXXXX or D-XXXXXXXXXX
    const regex = /^[ID]-[A-Z0-9]{10}$/;
    return regex.test(code);
  }

  /**
   * Get lottery type from code
   */
  static getTypeFromCode(code: string): LotteryType | null {
    if (code.startsWith('I-')) {
      return 'INSTANT';
    }
    if (code.startsWith('D-')) {
      return 'DEFERRED';
    }
    return null;
  }
}
