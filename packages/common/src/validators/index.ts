/**
 * Validators for ensuring data compliance with Agenzia delle Entrate specifications
 */

import { CodiceFiscale, PartitaIVA } from '../types/common';
import type { CorrispettiviGiornalieri } from '../types/corrispettivi';
import type { DocumentoCommerciale } from '../types/dc';

/**
 * Validate Italian VAT number (Partita IVA)
 * Format: IT + 11 digits
 */
export function validatePartitaIVA(partitaIVA: PartitaIVA): boolean {
  // Remove whitespace and convert to uppercase
  const cleaned = partitaIVA.replace(/\s/g, '').toUpperCase();

  // Check format: IT followed by 11 digits
  const regex = /^IT\d{11}$/;
  return regex.test(cleaned);

  // TODO: Implement full checksum validation for production use
}

/**
 * Validate Italian fiscal code (Codice Fiscale)
 * Format: 16 alphanumeric characters
 */
export function validateCodiceFiscale(codiceFiscale: CodiceFiscale): boolean {
  // Remove whitespace and convert to uppercase
  const cleaned = codiceFiscale.replace(/\s/g, '').toUpperCase();

  // Check length
  if (cleaned.length !== 16) {
    return false;
  }

  // Check format: 6 letters, 2 digits, 1 letter, 2 digits, 1 letter, 3 digits, 1 letter
  const regex = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/;
  return regex.test(cleaned);

  // TODO: Implement full checksum validation for production use
}

/**
 * Validate amount format (2 decimal places, positive)
 */
export function validateAmount(amount: number): boolean {
  if (amount < 0) {
    return false;
  }

  // Check maximum 2 decimal places
  const decimals = (amount.toString().split('.')[1] || '').length;
  return decimals <= 2;
}

/**
 * Validate VAT rate (must be between 0 and 100)
 */
export function validateVATRate(rate: number): boolean {
  return rate >= 0 && rate <= 100;
}

/**
 * Validate ISO date format (YYYY-MM-DD)
 */
export function validateISODate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) {
    return false;
  }

  try {
    const date_obj = new Date(date);
    return !isNaN(date_obj.getTime());
  } catch {
    return false;
  }
}

/**
 * Validate ISO datetime format (YYYY-MM-DDTHH:MM:SSZ)
 */
export function validateISODateTime(dateTime: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/;
  if (!regex.test(dateTime)) {
    return false;
  }

  try {
    const date = new Date(dateTime);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate CorrispettiviGiornalieri object
 */
export function validateCorrispettivi(corrispettivi: CorrispettiviGiornalieri): ValidationResult {
  const errors: string[] = [];

  // Validate version
  if (!corrispettivi.versione) {
    errors.push('Version is required');
  }

  // Validate taxpayer
  if (!corrispettivi.contribuente?.partitaIVA) {
    errors.push('Taxpayer VAT number is required');
  } else if (!validatePartitaIVA(corrispettivi.contribuente.partitaIVA)) {
    errors.push('Invalid taxpayer VAT number');
  }

  // Validate emission point ID
  if (!corrispettivi.identificativoPEM) {
    errors.push('Emission point ID is required');
  }

  // Validate reference date
  if (!corrispettivi.dataRiferimento) {
    errors.push('Reference date is required');
  } else if (!validateISODate(corrispettivi.dataRiferimento)) {
    errors.push('Invalid reference date format');
  }

  // Validate VAT summary
  if (!corrispettivi.riepilogoIVA || corrispettivi.riepilogoIVA.length === 0) {
    errors.push('VAT summary is required');
  } else {
    corrispettivi.riepilogoIVA.forEach((riepilogo, index) => {
      if (riepilogo.aliquotaIVA === undefined && !riepilogo.natura) {
        errors.push(`VAT summary ${index}: Either VAT rate or nature code is required`);
      }

      if (riepilogo.imponibile === undefined || riepilogo.imponibile < 0) {
        errors.push(`VAT summary ${index}: Invalid amount`);
      }

      if (riepilogo.aliquotaIVA !== undefined && !validateVATRate(riepilogo.aliquotaIVA)) {
        errors.push(`VAT summary ${index}: Invalid VAT rate`);
      }
    });
  }

  // Validate total amount
  if (corrispettivi.importoTotale === undefined || !validateAmount(corrispettivi.importoTotale)) {
    errors.push('Invalid total amount');
  }

  // Validate daily total matches VAT summary
  const vatSumTotal = corrispettivi.riepilogoIVA.reduce(
    (sum, riepilogo) => sum + (riepilogo.imponibile || 0) + (riepilogo.imposta || 0),
    0
  );
  const roundedVatSum = Math.round(vatSumTotal * 100) / 100;
  const roundedTotal = Math.round(corrispettivi.importoTotale * 100) / 100;

  if (Math.abs(roundedVatSum - roundedTotal) > 0.01) {
    errors.push(`Total amount mismatch: expected ${roundedVatSum}, got ${roundedTotal}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate DocumentoCommerciale object
 */
export function validateDocumentoCommerciale(documento: DocumentoCommerciale): ValidationResult {
  const errors: string[] = [];

  // Validate version
  if (!documento.versione) {
    errors.push('Version is required');
  }

  // Validate taxpayer
  if (!documento.contribuente?.partitaIVA) {
    errors.push('Taxpayer VAT number is required');
  } else if (!validatePartitaIVA(documento.contribuente.partitaIVA)) {
    errors.push('Invalid taxpayer VAT number');
  }

  // Validate emission point ID
  if (!documento.identificativoPEM) {
    errors.push('Emission point ID is required');
  }

  // Validate general data
  if (!documento.datiGenerali) {
    errors.push('General data is required');
  } else {
    if (!documento.datiGenerali.numero) {
      errors.push('Document number is required');
    }

    if (!documento.datiGenerali.dataOra) {
      errors.push('Date and time are required');
    } else if (!validateISODateTime(documento.datiGenerali.dataOra)) {
      errors.push('Invalid date/time format');
    }

    if (!documento.datiGenerali.tipoDocumento) {
      errors.push('Document type is required');
    }
  }

  // Validate line items
  if (!documento.dettaglioLinee || documento.dettaglioLinee.length === 0) {
    errors.push('At least one line item is required');
  } else {
    documento.dettaglioLinee.forEach((linea, index) => {
      if (!linea.descrizione) {
        errors.push(`Line ${index + 1}: Description is required`);
      }

      if (linea.quantita === undefined || linea.quantita <= 0) {
        errors.push(`Line ${index + 1}: Invalid quantity`);
      }

      if (linea.prezzoUnitario === undefined || !validateAmount(linea.prezzoUnitario)) {
        errors.push(`Line ${index + 1}: Invalid unit price`);
      }

      if (linea.aliquotaIVA === undefined && !linea.natura) {
        errors.push(`Line ${index + 1}: Either VAT rate or nature code is required`);
      }

      if (linea.aliquotaIVA !== undefined && !validateVATRate(linea.aliquotaIVA)) {
        errors.push(`Line ${index + 1}: Invalid VAT rate`);
      }
    });
  }

  // Validate VAT summary
  if (!documento.datiRiepilogo || documento.datiRiepilogo.length === 0) {
    errors.push('VAT summary is required');
  } else {
    documento.datiRiepilogo.forEach((riepilogo, index) => {
      if (riepilogo.aliquotaIVA === undefined && !riepilogo.natura) {
        errors.push(`VAT summary ${index}: Either VAT rate or nature code is required`);
      }

      if (riepilogo.imponibile === undefined || riepilogo.imponibile < 0) {
        errors.push(`VAT summary ${index}: Invalid taxable amount`);
      }

      if (riepilogo.imposta === undefined || riepilogo.imposta < 0) {
        errors.push(`VAT summary ${index}: Invalid tax amount`);
      }

      if (riepilogo.aliquotaIVA !== undefined && !validateVATRate(riepilogo.aliquotaIVA)) {
        errors.push(`VAT summary ${index}: Invalid VAT rate`);
      }
    });
  }

  // Validate total amount
  if (documento.importoTotale === undefined || !validateAmount(documento.importoTotale)) {
    errors.push('Invalid total amount');
  }

  // Validate total amount matches VAT summary
  const vatSumTotal = documento.datiRiepilogo.reduce(
    (sum, riepilogo) => sum + (riepilogo.imponibile || 0) + (riepilogo.imposta || 0),
    0
  );
  const roundedVatSum = Math.round(vatSumTotal * 100) / 100;
  const roundedTotal = Math.round(documento.importoTotale * 100) / 100;

  if (Math.abs(roundedVatSum - roundedTotal) > 0.01) {
    errors.push(`Total amount mismatch: expected ${roundedVatSum}, got ${roundedTotal}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
