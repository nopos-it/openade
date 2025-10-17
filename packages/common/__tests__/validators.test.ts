/**
 * Validator Tests
 */

import { validateCodiceFiscale, validatePartitaIVA } from '../src/validators';

describe('Validators', () => {
  describe('validatePartitaIVA', () => {
    test('should validate correct Italian VAT numbers format', () => {
      expect(validatePartitaIVA('IT00743110157')).toBe(true);
      expect(validatePartitaIVA('IT01234567892')).toBe(true);
      expect(validatePartitaIVA('IT12345678901')).toBe(true);
    });

    test('should reject invalid VAT numbers', () => {
      expect(validatePartitaIVA('IT123456789')).toBe(false); // Too short
      expect(validatePartitaIVA('IT1234567890123')).toBe(false); // Too long
      expect(validatePartitaIVA('ITABC12345678')).toBe(false); // Letters in number
      expect(validatePartitaIVA('12345678901')).toBe(false); // Missing IT prefix
      expect(validatePartitaIVA('')).toBe(false); // Empty
    });
  });

  describe('validateCodiceFiscale', () => {
    test('should validate correct fiscal code format', () => {
      expect(validateCodiceFiscale('RSSMRA85T10A562S')).toBe(true);
      expect(validateCodiceFiscale('BNCGNN80A01H501X')).toBe(true);
      expect(validateCodiceFiscale('RSSMRA80A01H501U')).toBe(true);
    });

    test('should reject invalid fiscal codes', () => {
      expect(validateCodiceFiscale('RSSMRA80A01H501')).toBe(false); // Too short
      expect(validateCodiceFiscale('RSSMRA80A01H501UX')).toBe(false); // Too long
      expect(validateCodiceFiscale('1234567890123456')).toBe(false); // All numbers
      expect(validateCodiceFiscale('')).toBe(false); // Empty
    });

    test('should normalize to uppercase', () => {
      // The validator normalizes to uppercase internally
      expect(validateCodiceFiscale('rssmra85t10a562s')).toBe(
        validateCodiceFiscale('RSSMRA85T10A562S')
      );
    });
  });
});
