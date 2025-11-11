/**
 * Attachment Support
 * Handles attachments for FatturaPA invoices
 */

import { createHash } from 'crypto';
import { basename, extname } from 'path';
import { CompressionService } from './compression.service';
import { EncryptionService } from './encryption.service';
import type { IStorage } from './storage.interface';

export interface AttachmentConfig {
  /** File storage service */
  fileStorage: IStorage;
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** Allowed file extensions */
  allowedExtensions?: string[];
  /** Storage directory for attachments */
  storageDir?: string;
  /** Compression enabled */
  compression?: boolean;
  /** Encryption enabled */
  encryption?: boolean;
}

export interface Attachment {
  /** Attachment ID */
  id: string;
  /** Original filename */
  filename: string;
  /** File content (base64 encoded) */
  content: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** File hash (SHA-256) */
  hash: string;
  /** Attachment description */
  description?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Compression applied */
  compressed?: boolean;
  /** Encryption applied */
  encrypted?: boolean;
}

export interface AttachmentResult {
  /** Attachment ID */
  id: string;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Attachment metadata */
  attachment?: Attachment;
}

/**
 * Attachment manager for FatturaPA invoices
 */
export class AttachmentManager {
  private config: AttachmentConfig;
  private compressionService: CompressionService;
  private encryptionService: EncryptionService;

  constructor(config: AttachmentConfig) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedExtensions: [
        '.pdf',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.txt',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
      ],
      storageDir: './attachments',
      compression: false,
      encryption: false,
      ...config,
    };

    // Create service instances
    this.compressionService = new CompressionService();
    this.encryptionService = new EncryptionService();
  }

  /**
   * Add attachment from file path
   */
  async addAttachmentFromFile(filePath: string, description?: string): Promise<AttachmentResult> {
    try {
      const content = await this.config.fileStorage.retrieve(filePath);
      if (!content) {
        return {
          id: '',
          success: false,
          error: 'File not found',
        };
      }

      const filename = basename(filePath);
      const mimeType = this.getMimeType(filename);

      return await this.addAttachment(Buffer.from(content), filename, mimeType, description);
    } catch (error) {
      return {
        id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add attachment from buffer
   */
  async addAttachment(
    content: Buffer,
    filename: string,
    mimeType: string,
    description?: string
  ): Promise<AttachmentResult> {
    try {
      // Validate file
      const validation = this.validateAttachment(content, filename);
      if (!validation.valid) {
        return {
          id: '',
          success: false,
          error: validation.error,
        };
      }

      // Generate attachment ID
      const id = this.generateAttachmentId(filename, content);

      // Process content (compress/encrypt if enabled)
      let processedContent = content;
      let compressed = false;
      let encrypted = false;

      if (this.config.compression) {
        processedContent = await this.compressionService.compress(content);
        compressed = true;
      }

      if (this.config.encryption) {
        const encryptionKey = await this.encryptionService.generateKey();
        processedContent = await this.encryptionService.encrypt(processedContent, encryptionKey);
        encrypted = true;
      }

      // Create attachment object
      const attachment: Attachment = {
        id,
        filename,
        content: processedContent.toString('base64'),
        mimeType,
        size: content.length,
        hash: this.calculateHash(content),
        description,
        createdAt: new Date().toISOString(),
        compressed,
        encrypted,
      };

      // Store attachment
      await this.storeAttachment(attachment);

      return {
        id,
        success: true,
        attachment,
      };
    } catch (error) {
      return {
        id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(id: string): Promise<Attachment | null> {
    try {
      return await this.loadAttachment(id);
    } catch {
      return null;
    }
  }

  /**
   * Remove attachment
   */
  async removeAttachment(id: string): Promise<boolean> {
    try {
      return await this.deleteAttachment(id);
    } catch {
      return false;
    }
  }

  /**
   * List all attachments
   */
  async listAttachments(): Promise<Attachment[]> {
    try {
      return await this.listStoredAttachments();
    } catch {
      return [];
    }
  }

  /**
   * Validate attachment
   */
  private validateAttachment(
    content: Buffer,
    filename: string
  ): {
    valid: boolean;
    error?: string;
  } {
    // Check file size
    if (content.length > this.config.maxFileSize!) {
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`,
      };
    }

    // Check file extension
    const extension = extname(filename).toLowerCase();
    if (!this.config.allowedExtensions!.includes(extension)) {
      return {
        valid: false,
        error: `File extension ${extension} is not allowed`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate attachment ID
   */
  private generateAttachmentId(filename: string, content: Buffer): string {
    const hash = this.calculateHash(content);
    const timestamp = Date.now();
    return `${hash.substring(0, 8)}_${timestamp}`;
  }

  /**
   * Calculate file hash
   */
  private calculateHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }

  // Compression and encryption are now handled by services

  /**
   * Store attachment to storage
   */
  private async storeAttachment(attachment: Attachment): Promise<void> {
    const filePath = `${this.config.storageDir || 'attachments'}/${attachment.id}.json`;
    await this.config.fileStorage.store(filePath, JSON.stringify(attachment, null, 2));
  }

  /**
   * Load attachment from storage
   */
  private async loadAttachment(id: string): Promise<Attachment | null> {
    try {
      const filePath = `${this.config.storageDir || 'attachments'}/${id}.json`;
      const content = await this.config.fileStorage.retrieve(filePath);
      if (!content) {
        return null;
      }

      return JSON.parse(Buffer.from(content).toString('utf8')) as Attachment;
    } catch {
      return null;
    }
  }

  /**
   * Delete attachment from storage
   */
  private async deleteAttachment(id: string): Promise<boolean> {
    try {
      const filePath = `${this.config.storageDir || 'attachments'}/${id}.json`;
      await this.config.fileStorage.delete(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List stored attachments
   */
  private async listStoredAttachments(): Promise<Attachment[]> {
    try {
      const storageDir = this.config.storageDir || 'attachments';
      const files = await this.config.fileStorage.list(storageDir);
      const jsonFiles = files.filter((file) => file.endsWith('.json'));
      const attachments: Attachment[] = [];

      for (const file of jsonFiles) {
        const id = file.replace('.json', '');
        const attachment = await this.loadAttachment(id);
        if (attachment) {
          attachments.push(attachment);
        }
      }

      return attachments;
    } catch {
      return [];
    }
  }
}

/**
 * Create an attachment manager
 */
export function createAttachmentManager(config: AttachmentConfig): AttachmentManager {
  return new AttachmentManager(config);
}

/**
 * Add attachment to invoice
 */
export async function addInvoiceAttachment(
  filePath: string,
  description: string | undefined,
  config: AttachmentConfig
): Promise<AttachmentResult> {
  const manager = createAttachmentManager(config);
  return await manager.addAttachmentFromFile(filePath, description);
}

/**
 * Get invoice attachment
 */
export async function getInvoiceAttachment(
  id: string,
  config: AttachmentConfig
): Promise<Attachment | null> {
  const manager = createAttachmentManager(config);
  return await manager.getAttachment(id);
}
