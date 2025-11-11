/**
 * Filesystem Storage Implementation for FatturaPA
 */

import type { IStorage } from '@openade/fe';
import { promises as fs } from 'fs';
import { dirname, join } from 'path';

export class FilesystemStorage implements IStorage {
  constructor(private basePath: string) {}

  private getFullPath(path: string): string {
    return join(this.basePath, path);
  }

  async store(
    path: string,
    data: string | Uint8Array,
    metadata?: Record<string, string>
  ): Promise<void> {
    const fullPath = this.getFullPath(path);
    await fs.mkdir(dirname(fullPath), { recursive: true });

    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    await fs.writeFile(fullPath, bytes);

    if (metadata) {
      await fs.writeFile(`${fullPath}.meta.json`, JSON.stringify(metadata, null, 2));
    }
  }

  async retrieve(path: string): Promise<Uint8Array | null> {
    try {
      const fullPath = this.getFullPath(path);
      const buffer = await fs.readFile(fullPath);
      return new Uint8Array(buffer);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(this.getFullPath(path));
      return true;
    } catch {
      return false;
    }
  }

  async delete(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);
    await fs.unlink(fullPath);
    try {
      await fs.unlink(`${fullPath}.meta.json`);
    } catch {
      // Ignore if meta file doesn't exist
    }
  }

  async list(prefix: string): Promise<string[]> {
    const fullPrefix = this.getFullPath(prefix);
    const dir = dirname(fullPrefix);

    try {
      const files = await fs.readdir(dir);
      return files.filter((f) => !f.endsWith('.meta.json')).map((f) => join(prefix, f));
    } catch {
      return [];
    }
  }

  async getMetadata(path: string): Promise<Record<string, string> | null> {
    try {
      const fullPath = this.getFullPath(path);
      const metaData = await fs.readFile(`${fullPath}.meta.json`, 'utf-8');
      return JSON.parse(metaData);
    } catch {
      return null;
    }
  }

  async createDirectory(path: string): Promise<void> {
    const fullPath = this.getFullPath(path);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async directoryExists(path: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(path);
      const stat = await fs.stat(fullPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
