/**
 * Compression Service Implementation
 * Uses Node.js built-in zlib for compression operations
 */

import { promisify } from 'util';
import { brotliCompress, brotliDecompress, deflate, gunzip, gzip, inflate } from 'zlib';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

export class CompressionService {
  /**
   * Compress data using specified algorithm
   */
  async compress(data: Buffer, algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip'): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip':
        return gzipAsync(data) as Promise<Buffer>;
      case 'deflate':
        return deflateAsync(data) as Promise<Buffer>;
      case 'brotli':
        return brotliCompressAsync(data) as Promise<Buffer>;
      default:
        throw new Error(`Unsupported compression algorithm: ${algorithm}`);
    }
  }

  /**
   * Decompress data using specified algorithm
   */
  async decompress(
    data: Buffer,
    algorithm: 'gzip' | 'deflate' | 'brotli' = 'gzip'
  ): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip':
        return gunzipAsync(data) as Promise<Buffer>;
      case 'deflate':
        return inflateAsync(data) as Promise<Buffer>;
      case 'brotli':
        return brotliDecompressAsync(data) as Promise<Buffer>;
      default:
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
    }
  }

  /**
   * Get compression ratio
   */
  getCompressionRatio(original: Buffer, compressed: Buffer): number {
    return compressed.length / original.length;
  }
}
