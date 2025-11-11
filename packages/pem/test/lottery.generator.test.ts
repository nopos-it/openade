/**
 * Lottery Generator Tests
 */

import { LotteryGenerator } from '../src/lottery.generator';

describe('LotteryGenerator', () => {
  let generator: LotteryGenerator;

  beforeEach(() => {
    generator = new LotteryGenerator({
      enableInstant: true,
      enableDeferred: true,
      minimumAmount: 1.0,
    });
  });

  describe('Instant Lottery', () => {
    test('should generate instant code for valid amount', () => {
      const code = generator.generateInstantCode('0001-0001', 10.0);

      expect(code).not.toBeNull();
      expect(code?.type).toBe('INSTANT');
      expect(code?.documentNumber).toBe('0001-0001');
      expect(code?.code).toMatch(/^I-[A-Z0-9]{10}$/);
    });

    test('should not generate code below minimum amount', () => {
      const code = generator.generateInstantCode('0001-0001', 0.5);

      expect(code).toBeNull();
    });

    test('should not generate code if instant disabled', () => {
      const gen = new LotteryGenerator({ enableInstant: false });
      const code = gen.generateInstantCode('0001-0001', 10.0);

      expect(code).toBeNull();
    });

    test('should generate unique codes', () => {
      const code1 = generator.generateInstantCode('0001-0001', 10.0);
      const code2 = generator.generateInstantCode('0001-0002', 10.0);

      expect(code1?.code).not.toBe(code2?.code);
    });
  });

  describe('Deferred Lottery', () => {
    test('should generate deferred code with fiscal code', () => {
      const code = generator.generateDeferredCode('0001-0001', 10.0, 'RSSMRA80A01H501U');

      expect(code).not.toBeNull();
      expect(code?.type).toBe('DEFERRED');
      expect(code?.documentNumber).toBe('0001-0001');
      expect(code?.customerFiscalCode).toBe('RSSMRA80A01H501U');
      expect(code?.code).toMatch(/^D-[A-Z0-9]{10}$/);
    });

    test('should not generate code without fiscal code', () => {
      const code = generator.generateDeferredCode('0001-0001', 10.0, '');

      expect(code).toBeNull();
    });

    test('should not generate code below minimum amount', () => {
      const code = generator.generateDeferredCode('0001-0001', 0.5, 'RSSMRA80A01H501U');

      expect(code).toBeNull();
    });

    test('should not generate code if deferred disabled', () => {
      const gen = new LotteryGenerator({ enableDeferred: false });
      const code = gen.generateDeferredCode('0001-0001', 10.0, 'RSSMRA80A01H501U');

      expect(code).toBeNull();
    });
  });

  describe('QR Code Generation', () => {
    test('should generate QR code data', () => {
      const code = generator.generateInstantCode('0001-0001', 10.0);
      expect(code).not.toBeNull();

      const qrData = generator.generateQRCodeData(code!);

      expect(qrData).toContain('INSTANT');
      expect(qrData).toContain(code!.code);
      expect(qrData).toContain('0001-0001');
    });
  });

  describe('Code Validation', () => {
    test('should validate correct instant code format', () => {
      expect(LotteryGenerator.validateCode('I-ABC12345678')).toBe(false); // Too long (11 chars)
      expect(LotteryGenerator.validateCode('I-ABC1234567')).toBe(true); // Correct (10 chars)
      expect(LotteryGenerator.validateCode('I-1234567890')).toBe(true);
    });

    test('should validate correct deferred code format', () => {
      expect(LotteryGenerator.validateCode('D-XYZ98765432')).toBe(false); // Too long (11 chars)
      expect(LotteryGenerator.validateCode('D-XYZ9876543')).toBe(true); // Correct (10 chars)
    });

    test('should reject invalid formats', () => {
      expect(LotteryGenerator.validateCode('X-ABC1234567')).toBe(false);
      expect(LotteryGenerator.validateCode('I-abc1234567')).toBe(false); // lowercase
      expect(LotteryGenerator.validateCode('IABC1234567')).toBe(false); // no dash
    });
  });

  describe('Type Extraction', () => {
    test('should extract type from instant code', () => {
      expect(LotteryGenerator.getTypeFromCode('I-ABC1234567')).toBe('INSTANT');
    });

    test('should extract type from deferred code', () => {
      expect(LotteryGenerator.getTypeFromCode('D-XYZ9876543')).toBe('DEFERRED');
    });

    test('should return null for invalid code', () => {
      expect(LotteryGenerator.getTypeFromCode('X-ABC1234567')).toBeNull();
    });
  });
});
