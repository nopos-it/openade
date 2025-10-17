/**
 * Cross-Border Invoice Support
 * Enhanced support for international operations and EU VAT
 */

import type { FatturaElettronica, Indirizzo } from '@nopos-ade/common';
import { EUVATService } from './euvat.service';

export interface CrossBorderConfig {
  /** Enable EU VAT validation */
  enableEUVATValidation?: boolean;
  /** Enable country code validation */
  enableCountryValidation?: boolean;
  /** Enable currency validation */
  enableCurrencyValidation?: boolean;
  /** Default currency for international invoices */
  defaultCurrency?: string;
  /** EU countries list */
  euCountries?: string[];
  /** VAT rates by country */
  vatRates?: Record<string, number>;
}

export interface CrossBorderInvoiceData {
  /** Supplier country */
  supplierCountry: string;
  /** Customer country */
  customerCountry: string;
  /** Transaction type */
  transactionType: 'B2B' | 'B2C' | 'B2G';
  /** VAT treatment */
  vatTreatment: 'DOMESTIC' | 'EU_B2B' | 'EU_B2C' | 'EXPORT' | 'IMPORT';
  /** Currency code */
  currency: string;
  /** Exchange rate */
  exchangeRate?: number;
  /** VAT number validation */
  vatNumberValid?: boolean;
  /** Special regimes */
  specialRegimes?: string[];
}

export interface CrossBorderValidationResult {
  /** Validation success */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Cross-border data */
  crossBorderData?: CrossBorderInvoiceData;
  /** Recommendations */
  recommendations?: string[];
}

export interface EUVATValidationResult {
  /** VAT number validity */
  valid: boolean;
  /** Company name */
  companyName?: string;
  /** Company address */
  companyAddress?: string;
  /** Validation date */
  validationDate: string;
  /** Error message if invalid */
  error?: string;
}

/**
 * Cross-border invoice manager
 */
export class CrossBorderManager {
  private config: CrossBorderConfig;
  private euVatService: EUVATService;

  constructor(config: CrossBorderConfig = {}) {
    this.config = {
      enableEUVATValidation: true,
      enableCountryValidation: true,
      enableCurrencyValidation: true,
      defaultCurrency: 'EUR',
      euCountries: [
        'AT',
        'BE',
        'BG',
        'HR',
        'CY',
        'CZ',
        'DK',
        'EE',
        'FI',
        'FR',
        'DE',
        'GR',
        'HU',
        'IE',
        'IT',
        'LV',
        'LT',
        'LU',
        'MT',
        'NL',
        'PL',
        'PT',
        'RO',
        'SK',
        'SI',
        'ES',
        'SE',
      ],
      vatRates: {
        IT: 22,
        DE: 19,
        FR: 20,
        ES: 21,
        NL: 21,
        BE: 21,
        AT: 20,
        PT: 23,
        FI: 24,
        IE: 23,
        GR: 24,
        LU: 17,
        MT: 18,
        CY: 19,
        EE: 20,
        LV: 21,
        LT: 21,
        PL: 23,
        CZ: 21,
        SK: 20,
        HU: 27,
        SI: 22,
        HR: 25,
        RO: 19,
        BG: 20,
        DK: 25,
        SE: 25,
      },
      ...config,
    };

    // Create service instance
    this.euVatService = new EUVATService();
  }

  /**
   * Validate cross-border invoice
   */
  async validateCrossBorderInvoice(
    invoice: FatturaElettronica
  ): Promise<CrossBorderValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Extract supplier and customer data
      const supplier = invoice.fatturaElettronicaHeader.cedentePrestatore;
      const customer = invoice.fatturaElettronicaHeader.cessionarioCommittente;

      const supplierCountry = this.extractCountry(supplier);
      const customerCountry = this.extractCountry(customer);

      // Validate countries
      if (this.config.enableCountryValidation) {
        const countryValidation = this.validateCountries(supplierCountry, customerCountry);
        errors.push(...countryValidation.errors);
        warnings.push(...countryValidation.warnings);
      }

      // Determine transaction type and VAT treatment
      const crossBorderData = this.determineCrossBorderData(
        supplier,
        customer,
        supplierCountry,
        customerCountry
      );

      // Validate VAT numbers for EU countries
      if (this.config.enableEUVATValidation && this.isEUCountry(customerCountry)) {
        const vatValidation = await this.validateEUVATNumber(customer);
        if (!vatValidation.valid) {
          errors.push(`Invalid EU VAT number: ${vatValidation.error}`);
        } else {
          crossBorderData.vatNumberValid = true;
        }
      }

      // Validate currency
      if (this.config.enableCurrencyValidation) {
        const currencyValidation = this.validateCurrency(invoice, crossBorderData);
        errors.push(...currencyValidation.errors);
        warnings.push(...currencyValidation.warnings);
      }

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(crossBorderData));

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        crossBorderData,
        recommendations,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings,
        recommendations,
      };
    }
  }

  /**
   * Validate EU VAT number
   */
  async validateEUVATNumber(customer: any): Promise<EUVATValidationResult> {
    try {
      const vatNumber = customer.datiAnagrafici.idFiscaleIVA?.idCodice;
      const countryCode = customer.datiAnagrafici.idFiscaleIVA?.idPaese;

      if (!vatNumber || !countryCode) {
        return {
          valid: false,
          validationDate: new Date().toISOString(),
          error: 'VAT number or country code missing',
        };
      }

      return await this.euVatService.validateVATNumber(vatNumber, countryCode);
    } catch (error) {
      return {
        valid: false,
        validationDate: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get VAT rate for country
   */
  getVATRate(countryCode: string): number | null {
    return this.config.vatRates?.[countryCode] || null;
  }

  /**
   * Check if country is in EU
   */
  isEUCountry(countryCode: string): boolean {
    return this.config.euCountries?.includes(countryCode) || false;
  }

  /**
   * Extract country from taxpayer data
   */
  private extractCountry(taxpayer: any): string {
    return taxpayer.sede?.nazione || 'IT';
  }

  /**
   * Validate countries
   */
  private validateCountries(
    supplierCountry: string,
    customerCountry: string
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!supplierCountry) {
      errors.push('Supplier country is required');
    }

    if (!customerCountry) {
      errors.push('Customer country is required');
    }

    if (supplierCountry && customerCountry) {
      if (supplierCountry === customerCountry) {
        warnings.push('Domestic transaction detected');
      }

      if (supplierCountry !== 'IT' && customerCountry !== 'IT') {
        warnings.push('Third-country transaction detected');
      }
    }

    return { errors, warnings };
  }

  /**
   * Determine cross-border data
   */
  private determineCrossBorderData(
    supplier: any,
    customer: any,
    supplierCountry: string,
    customerCountry: string
  ): CrossBorderInvoiceData {
    const hasVATNumber = !!customer.DatiAnagrafici.idFiscaleIVA?.idCodice;
    const isSupplierIT = supplierCountry === 'IT';
    const isCustomerIT = customerCountry === 'IT';
    const isCustomerEU = this.isEUCountry(customerCountry);

    let transactionType: 'B2B' | 'B2C' | 'B2G' = 'B2C';
    let vatTreatment: 'DOMESTIC' | 'EU_B2B' | 'EU_B2C' | 'EXPORT' | 'IMPORT';

    // Determine transaction type
    if (hasVATNumber) {
      transactionType = 'B2B';
    }

    // Determine VAT treatment
    if (isSupplierIT && isCustomerIT) {
      vatTreatment = 'DOMESTIC';
    } else if (isSupplierIT && isCustomerEU && hasVATNumber) {
      vatTreatment = 'EU_B2B';
    } else if (isSupplierIT && isCustomerEU && !hasVATNumber) {
      vatTreatment = 'EU_B2C';
    } else if (isSupplierIT && !isCustomerEU) {
      vatTreatment = 'EXPORT';
    } else if (!isSupplierIT && isCustomerIT) {
      vatTreatment = 'IMPORT';
    } else {
      vatTreatment = 'EXPORT';
    }

    return {
      supplierCountry,
      customerCountry,
      transactionType,
      vatTreatment,
      currency: this.config.defaultCurrency!,
      vatNumberValid: hasVATNumber,
    };
  }

  /**
   * Validate currency
   */
  private validateCurrency(
    invoice: FatturaElettronica,
    crossBorderData: CrossBorderInvoiceData
  ): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if currency is specified in invoice
    const invoiceCurrency = this.extractCurrency(invoice);

    if (!invoiceCurrency) {
      if (crossBorderData.vatTreatment !== 'DOMESTIC') {
        warnings.push('Currency not specified for international transaction');
      }
    } else {
      if (crossBorderData.vatTreatment === 'DOMESTIC' && invoiceCurrency !== 'EUR') {
        warnings.push('Non-EUR currency for domestic transaction');
      }
    }

    return { errors, warnings };
  }

  /**
   * Extract currency from invoice
   */
  private extractCurrency(invoice: FatturaElettronica): string | null {
    // Extract from DatiPagamento if available
    const body = Array.isArray(invoice.fatturaElettronicaBody)
      ? invoice.fatturaElettronicaBody[0]
      : invoice.fatturaElettronicaBody;

    if (body.datiPagamento && body.datiPagamento.length > 0) {
      return body.datiPagamento[0].condizioniPagamento || null;
    }

    return null;
  }

  /**
   * Validate VAT number format
   */
  private validateVATNumberFormat(vatNumber: string, countryCode: string): boolean {
    // Simplified VAT number validation - would use proper country-specific validation
    const patterns: Record<string, RegExp> = {
      IT: /^IT\d{11}$/,
      DE: /^DE\d{9}$/,
      FR: /^FR[A-Z0-9]{2}\d{9}$/,
      ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      NL: /^NL\d{9}B\d{2}$/,
      BE: /^BE\d{10}$/,
      AT: /^ATU\d{8}$/,
      PT: /^PT\d{9}$/,
      FI: /^FI\d{8}$/,
      IE: /^IE\d[A-Z0-9\+\*]\d{5}[A-Z]$/,
      GR: /^GR\d{9}$/,
      LU: /^LU\d{8}$/,
      MT: /^MT\d{8}$/,
      CY: /^CY\d{8}[A-Z]$/,
      EE: /^EE\d{9}$/,
      LV: /^LV\d{11}$/,
      LT: /^LT(\d{9}|\d{12})$/,
      PL: /^PL\d{10}$/,
      CZ: /^CZ\d{8,10}$/,
      SK: /^SK\d{10}$/,
      HU: /^HU\d{8}$/,
      SI: /^SI\d{8}$/,
      HR: /^HR\d{11}$/,
      RO: /^RO\d{2,10}$/,
      BG: /^BG\d{9,10}$/,
      DK: /^DK\d{8}$/,
      SE: /^SE\d{12}$/,
    };

    const pattern = patterns[countryCode];
    return pattern ? pattern.test(vatNumber) : false;
  }

  /**
   * Format address
   */
  private formatAddress(address: Indirizzo): string {
    return `${address.indirizzo}, ${address.cap} ${address.comune}, ${address.nazione}`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(crossBorderData: CrossBorderInvoiceData): string[] {
    const recommendations: string[] = [];

    if (crossBorderData.vatTreatment === 'EU_B2B') {
      recommendations.push('Consider using reverse charge mechanism for EU B2B transactions');
    }

    if (crossBorderData.vatTreatment === 'EXPORT') {
      recommendations.push('Verify export documentation requirements');
    }

    if (crossBorderData.vatTreatment === 'IMPORT') {
      recommendations.push('Check import VAT obligations');
    }

    if (crossBorderData.currency !== 'EUR') {
      recommendations.push('Consider currency exchange rate documentation');
    }

    return recommendations;
  }
}

/**
 * Create a cross-border manager
 */
export function createCrossBorderManager(config: CrossBorderConfig = {}): CrossBorderManager {
  return new CrossBorderManager(config);
}

/**
 * Validate cross-border invoice
 */
export async function validateCrossBorderInvoice(
  invoice: FatturaElettronica,
  config: CrossBorderConfig = {}
): Promise<CrossBorderValidationResult> {
  const manager = createCrossBorderManager(config);
  return await manager.validateCrossBorderInvoice(invoice);
}

/**
 * Validate EU VAT number
 */
export async function validateEUVATNumber(
  vatNumber: string,
  countryCode: string,
  config: CrossBorderConfig = {}
): Promise<EUVATValidationResult> {
  const manager = createCrossBorderManager(config);

  // Create mock customer data for validation
  const customer = {
    DatiAnagrafici: {
      idFiscaleIVA: {
        idPaese: countryCode,
        idCodice: vatNumber,
      },
      anagrafica: {
        denominazione: 'Unknown',
      },
    },
    sede: {
      indirizzo: 'Unknown',
      cap: '00000',
      comune: 'Unknown',
      nazione: countryCode,
    },
  };

  return await manager.validateEUVATNumber(customer);
}
