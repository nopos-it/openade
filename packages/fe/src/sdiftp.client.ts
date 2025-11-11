/**
 * SDIFTP Client
 * SFTP client for SDI transmission
 */

import type { InvoiceTransmissionResult } from '@openade/common';
import { Client } from 'ssh2';

export interface SDIFTPConfig {
  /** SFTP host */
  host: string;
  /** SFTP port */
  port?: number;
  /** SFTP username */
  username: string;
  /** SFTP private key */
  privateKey?: string;
  /** SFTP password */
  password?: string;
  /** Remote directory for invoice uploads */
  uploadDir?: string;
  /** Remote directory for receipt downloads */
  downloadDir?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * SDIFTP Client for SFTP transmission
 */
export class SDIFTPClient {
  private config: SDIFTPConfig;

  constructor(config: SDIFTPConfig) {
    this.config = {
      port: 22,
      uploadDir: '/in',
      downloadDir: '/out',
      timeout: 30000,
      debug: false,
      ...config,
    };
  }

  /**
   * Send invoice via SDIFTP
   */
  async sendInvoice(filename: string, xmlContent: string): Promise<InvoiceTransmissionResult> {
    if (this.config.debug) {
      console.log(`[SDIFTP] Sending invoice: ${filename}`);
    }

    try {
      const result = await this.sendViaSdiFtp(filename, xmlContent);

      return {
        success: true,
        identifcativoSdI: result.identificativoSdI || 'PENDING',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download receipts from SFTP
   */
  async downloadReceipts(): Promise<Array<{ filename: string; content: string }>> {
    if (this.config.debug) {
      console.log(`[SDIFTP] Downloading receipts from ${this.config.downloadDir}`);
    }

    try {
      return new Promise((resolve, reject) => {
        const conn = new Client();

        conn.on('ready', () => {
          if (this.config.debug) {
            console.log('[SDIFTP] SFTP connection established');
          }

          conn.sftp((err: any, sftp: any) => {
            if (err) {
              reject(err);
              return;
            }

            sftp.readdir(this.config.downloadDir!, (err: any, list: any[]) => {
              if (err) {
                reject(err);
                return;
              }

              if (this.config.debug) {
                console.log(`[SDIFTP] Found ${list.length} receipt files`);
              }

              const receipts: Array<{ filename: string; content: string }> = [];
              let processed = 0;

              if (list.length === 0) {
                conn.end();
                resolve(receipts);
                return;
              }

              list.forEach((file: any) => {
                const filePath = `${this.config.downloadDir}/${file.filename}`;

                sftp.readFile(filePath, (err: any, data: Buffer) => {
                  if (err) {
                    console.error(`[SDIFTP] Error reading file ${file.filename}:`, err);
                  } else {
                    receipts.push({
                      filename: file.filename,
                      content: data.toString('utf8'),
                    });

                    if (this.config.debug) {
                      console.log(`[SDIFTP] Receipt downloaded: ${file.filename}`);
                    }
                  }

                  processed++;
                  if (processed === list.length) {
                    conn.end();
                    resolve(receipts);
                  }
                });
              });
            });
          });
        });

        conn.on('error', (err) => {
          reject(err);
        });

        // Connect to SFTP server
        const connectOptions: any = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
        };

        if (this.config.privateKey) {
          connectOptions.privateKey = this.config.privateKey;
        } else if (this.config.password) {
          connectOptions.password = this.config.password;
        } else {
          reject(new Error('Either privateKey or password must be provided'));
          return;
        }

        conn.connect(connectOptions);
      });
    } catch (error) {
      throw new Error(
        `SFTP operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send invoice via SFTP
   */
  private async sendViaSdiFtp(
    filename: string,
    xmlContent: string
  ): Promise<{ identificativoSdI?: string }> {
    if (this.config.debug) {
      console.log(`[SDIFTP] Uploading via SFTP: ${filename}`);
    }

    return new Promise((resolve, reject) => {
      const conn = new Client();

      conn.on('ready', () => {
        if (this.config.debug) {
          console.log('[SDIFTP] SFTP connection established');
        }

        conn.sftp((err: any, sftp: any) => {
          if (err) {
            reject(err);
            return;
          }

          const remotePath = `${this.config.uploadDir}/${filename}`;
          const buffer = Buffer.from(xmlContent, 'utf8');

          sftp.writeFile(remotePath, buffer, (err: any) => {
            if (err) {
              reject(err);
              return;
            }

            if (this.config.debug) {
              console.log(`[SDIFTP] File uploaded successfully: ${remotePath}`);
            }

            // For SDIFTP, we don't get immediate IdentificativoSdI
            // It will be provided in the receipt
            resolve({});
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      // Connect to SFTP server
      const connectOptions: any = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
      };

      if (this.config.privateKey) {
        connectOptions.privateKey = this.config.privateKey;
      } else if (this.config.password) {
        connectOptions.password = this.config.password;
      } else {
        reject(new Error('Either privateKey or password must be provided'));
        return;
      }

      conn.connect(connectOptions);
    });
  }
}
