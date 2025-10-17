/**
 * Encryption Service Implementation
 * Uses Node.js built-in crypto for encryption operations
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
} from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class EncryptionService {
  /**
   * Encrypt data using AES-256-CBC
   */
  async encrypt(data: Buffer, key: string): Promise<Buffer> {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = await this.deriveKey(key);
    const iv = randomBytes(16);

    const cipher = createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Prepend IV to encrypted data
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt data using AES-256-CBC
   */
  async decrypt(encryptedData: Buffer, key: string): Promise<Buffer> {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = await this.deriveKey(key);

    // Extract IV from the beginning of encrypted data
    const iv = encryptedData.slice(0, 16);
    const encrypted = encryptedData.slice(16);

    const decipher = createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
  }

  /**
   * Generate a random encryption key
   */
  async generateKey(): Promise<string> {
    return randomBytes(32).toString('hex');
  }

  /**
   * Hash data using specified algorithm
   */
  async hash(data: Buffer, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
    return createHash(algorithm).update(data).digest('hex');
  }

  /**
   * Create HMAC hash
   */
  async hmac(
    data: Buffer,
    key: string,
    algorithm: 'sha256' | 'sha512' = 'sha256'
  ): Promise<string> {
    return createHmac(algorithm, key).update(data).digest('hex');
  }

  /**
   * Derive key from password using scrypt
   */
  private async deriveKey(password: string): Promise<Buffer> {
    return scryptAsync(password, 'salt', 32) as Promise<Buffer>;
  }
}
