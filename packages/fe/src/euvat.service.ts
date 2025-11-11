/**
 * EU VAT Validation Service Implementation
 * Validates EU VAT numbers using VIES service
 */

import { HttpService } from './http.service';

export interface VATValidationResult {
  valid: boolean;
  companyName?: string;
  companyAddress?: string;
  validationDate: string;
  error?: string;
}

export class EUVATService {
  private httpService: HttpService;
  private viesEndpoint = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms/';

  constructor() {
    this.httpService = new HttpService();
  }

  /**
   * Validate EU VAT number using VIES service
   */
  async validateVATNumber(vatNumber: string, countryCode: string): Promise<VATValidationResult> {
    try {
      // Clean VAT number
      const cleanVatNumber = vatNumber.replace(/\s/g, '').toUpperCase();

      // Validate format
      if (!this.isValidVATFormat(cleanVatNumber, countryCode)) {
        return {
          valid: false,
          validationDate: new Date().toISOString(),
          error: 'Invalid VAT number format',
        };
      }

      // Call VIES service
      const response = await this.httpService.get(
        `${this.viesEndpoint}${countryCode}/vat/${cleanVatNumber}`
      );

      if (response.valid) {
        return {
          valid: true,
          companyName: response.name,
          companyAddress: response.address,
          validationDate: new Date().toISOString(),
        };
      } else {
        return {
          valid: false,
          validationDate: new Date().toISOString(),
          error: 'VAT number not found in VIES database',
        };
      }
    } catch (error) {
      return {
        valid: false,
        validationDate: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Validation service error',
      };
    }
  }

  /**
   * Validate VAT number format
   */
  private isValidVATFormat(vatNumber: string, countryCode: string): boolean {
    const patterns: Record<string, RegExp> = {
      AT: /^ATU\d{8}$/,
      BE: /^BE[0-1]\d{9}$/,
      BG: /^BG\d{9,10}$/,
      CY: /^CY\d{8}[A-Z]$/,
      CZ: /^CZ\d{8,10}$/,
      DE: /^DE\d{9}$/,
      DK: /^DK\d{8}$/,
      EE: /^EE\d{9}$/,
      EL: /^EL\d{9}$/,
      ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      FI: /^FI\d{8}$/,
      FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
      HR: /^HR\d{11}$/,
      HU: /^HU\d{8}$/,
      IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]$/,
      IT: /^IT\d{11}$/,
      LT: /^LT(\d{9}|\d{12})$/,
      LU: /^LU\d{8}$/,
      LV: /^LV\d{11}$/,
      MT: /^MT\d{8}$/,
      NL: /^NL\d{9}B\d{2}$/,
      PL: /^PL\d{10}$/,
      PT: /^PT\d{9}$/,
      RO: /^RO\d{2,10}$/,
      SE: /^SE\d{12}$/,
      SI: /^SI\d{8}$/,
      SK: /^SK\d{10}$/,
    };

    const pattern = patterns[countryCode.toUpperCase()];
    return pattern ? pattern.test(vatNumber) : false;
  }

  /**
   * Extract country code from VAT number
   */
  extractCountryCode(vatNumber: string): string | null {
    const match = vatNumber.match(/^([A-Z]{2})/);
    return match ? match[1] : null;
  }

  /**
   * Format VAT number for display
   */
  formatVATNumber(vatNumber: string): string {
    const cleanVatNumber = vatNumber.replace(/\s/g, '').toUpperCase();
    const countryCode = this.extractCountryCode(cleanVatNumber);

    if (!countryCode) {
      return vatNumber;
    }

    const numberPart = cleanVatNumber.substring(2);

    // Add spaces for better readability
    if (numberPart.length > 4) {
      return `${countryCode} ${numberPart.substring(0, 4)} ${numberPart.substring(4)}`;
    }

    return `${countryCode} ${numberPart}`;
  }
}
