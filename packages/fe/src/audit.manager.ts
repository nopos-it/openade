/**
 * Audit Trail Support
 * Comprehensive audit trails for FatturaPA invoice operations
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

export interface AuditConfig {
  /** Audit log directory */
  logDir: string;
  /** Log file rotation size in bytes */
  maxLogSize?: number;
  /** Log retention days */
  retentionDays?: number;
  /** Enable detailed logging */
  detailedLogging?: boolean;
  /** Include sensitive data in logs */
  includeSensitiveData?: boolean;
  /** Log format (json, text) */
  format?: 'json' | 'text';
  /** Compression enabled */
  compression?: boolean;
}

export interface AuditEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: AuditEventType;
  /** Event timestamp */
  timestamp: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** IP address */
  ipAddress?: string;
  /** User agent */
  userAgent?: string;
  /** Event description */
  description: string;
  /** Event details */
  details: Record<string, any>;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Related invoice ID */
  invoiceId?: string;
  /** Related archive ID */
  archiveId?: string;
  /** Related batch ID */
  batchId?: string;
}

export type AuditEventType =
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_DELETED'
  | 'INVOICE_SIGNED'
  | 'INVOICE_TIMESTAMPED'
  | 'INVOICE_TRANSMITTED'
  | 'INVOICE_RECEIVED'
  | 'INVOICE_ARCHIVED'
  | 'INVOICE_EXTRACTED'
  | 'BATCH_STARTED'
  | 'BATCH_COMPLETED'
  | 'BATCH_FAILED'
  | 'ARCHIVE_CREATED'
  | 'ARCHIVE_DELETED'
  | 'ARCHIVE_EXTRACTED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'CONFIGURATION_CHANGED'
  | 'ERROR_OCCURRED'
  | 'SYSTEM_STARTUP'
  | 'SYSTEM_SHUTDOWN';

export interface AuditQuery {
  /** Event types to filter */
  types?: AuditEventType[];
  /** Date range start */
  startDate?: string;
  /** Date range end */
  endDate?: string;
  /** User ID filter */
  userId?: string;
  /** Success status filter */
  success?: boolean;
  /** Invoice ID filter */
  invoiceId?: string;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface AuditStats {
  /** Total events */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<AuditEventType, number>;
  /** Events by user */
  eventsByUser: Record<string, number>;
  /** Success rate */
  successRate: number;
  /** Average duration */
  averageDuration: number;
  /** Most common errors */
  commonErrors: Array<{ error: string; count: number }>;
  /** Time range */
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Audit trail manager
 */
export class AuditTrailManager {
  private config: AuditConfig;
  private currentLogFile: string | null = null;

  constructor(config: AuditConfig) {
    this.config = {
      maxLogSize: 10 * 1024 * 1024, // 10MB
      retentionDays: 2555, // 7 years
      detailedLogging: true,
      includeSensitiveData: false,
      format: 'json',
      compression: true,
      ...config,
    };

    this.ensureLogDirectory();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      ...event,
    };

    // Sanitize sensitive data if needed
    if (!this.config.includeSensitiveData) {
      auditEvent.details = this.sanitizeSensitiveData(auditEvent.details);
    }

    // Write to log file
    await this.writeToLog(auditEvent);

    // Rotate log file if needed
    await this.rotateLogIfNeeded();
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditQuery = {}): Promise<AuditEvent[]> {
    try {
      const logFiles = this.getLogFiles();
      const events: AuditEvent[] = [];

      for (const logFile of logFiles) {
        const fileEvents = await this.readLogFile(logFile);
        events.push(...fileEvents);
      }

      return this.filterEvents(events, query);
    } catch {
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(query: AuditQuery = {}): Promise<AuditStats> {
    const events = await this.queryEvents(query);
    return this.calculateStats(events);
  }

  /**
   * Export audit events
   */
  async exportEvents(query: AuditQuery = {}, format: 'json' | 'csv' = 'json'): Promise<string> {
    const events = await this.queryEvents(query);

    if (format === 'csv') {
      return this.exportToCSV(events);
    } else {
      return JSON.stringify(events, null, 2);
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(): Promise<number> {
    try {
      const logFiles = this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays!);

      let deletedCount = 0;

      for (const logFile of logFiles) {
        const filePath = join(this.config.logDir, logFile);
        const stats = statSync(filePath);

        if (stats.mtime < cutoffDate) {
          unlinkSync(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch {
      return 0;
    }
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `EVT_${timestamp}_${random}`;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  /**
   * Get current log file path
   */
  private getCurrentLogFile(): string {
    if (!this.currentLogFile) {
      const date = new Date().toISOString().split('T')[0];
      this.currentLogFile = join(this.config.logDir, `audit_${date}.log`);
    }
    return this.currentLogFile;
  }

  /**
   * Write event to log file
   */
  private async writeToLog(event: AuditEvent): Promise<void> {
    const logFile = this.getCurrentLogFile();
    const logEntry = this.formatLogEntry(event);

    writeFileSync(logFile, logEntry + '\n', { flag: 'a' });
  }

  /**
   * Format log entry
   */
  private formatLogEntry(event: AuditEvent): string {
    if (this.config.format === 'json') {
      return JSON.stringify(event);
    } else {
      return `${event.timestamp} [${event.type}] ${event.description} - ${event.success ? 'SUCCESS' : 'FAILED'}`;
    }
  }

  /**
   * Rotate log file if needed
   */
  private async rotateLogIfNeeded(): Promise<void> {
    const logFile = this.getCurrentLogFile();

    if (existsSync(logFile)) {
      const stats = statSync(logFile);
      if (stats.size >= this.config.maxLogSize!) {
        this.currentLogFile = null; // Force creation of new log file
      }
    }
  }

  /**
   * Get all log files
   */
  private getLogFiles(): string[] {
    try {
      if (!existsSync(this.config.logDir)) {
        return [];
      }

      return readdirSync(this.config.logDir)
        .filter((file) => file.startsWith('audit_') && file.endsWith('.log'))
        .sort();
    } catch {
      return [];
    }
  }

  /**
   * Read log file
   */
  private async readLogFile(filename: string): Promise<AuditEvent[]> {
    try {
      const filePath = join(this.config.logDir, filename);
      const content = readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');

      return lines
        .map((line) => {
          try {
            return JSON.parse(line) as AuditEvent;
          } catch {
            return null;
          }
        })
        .filter((event) => event !== null) as AuditEvent[];
    } catch {
      return [];
    }
  }

  /**
   * Filter events based on query
   */
  private filterEvents(events: AuditEvent[], query: AuditQuery): AuditEvent[] {
    let filtered = events;

    // Filter by type
    if (query.types && query.types.length > 0) {
      filtered = filtered.filter((event) => query.types!.includes(event.type));
    }

    // Filter by date range
    if (query.startDate) {
      filtered = filtered.filter((event) => event.timestamp >= query.startDate!);
    }
    if (query.endDate) {
      filtered = filtered.filter((event) => event.timestamp <= query.endDate!);
    }

    // Filter by user
    if (query.userId) {
      filtered = filtered.filter((event) => event.userId === query.userId);
    }

    // Filter by success status
    if (query.success !== undefined) {
      filtered = filtered.filter((event) => event.success === query.success);
    }

    // Filter by invoice ID
    if (query.invoiceId) {
      filtered = filtered.filter((event) => event.invoiceId === query.invoiceId);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    if (query.offset) {
      filtered = filtered.slice(query.offset);
    }
    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  }

  /**
   * Calculate statistics
   */
  private calculateStats(events: AuditEvent[]): AuditStats {
    const eventsByType: Record<AuditEventType, number> = {} as any;
    const eventsByUser: Record<string, number> = {};
    const errors: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const event of events) {
      // Count by type
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

      // Count by user
      if (event.userId) {
        eventsByUser[event.userId] = (eventsByUser[event.userId] || 0) + 1;
      }

      // Count errors
      if (!event.success && event.error) {
        errors[event.error] = (errors[event.error] || 0) + 1;
      }

      // Sum durations
      if (event.duration) {
        totalDuration += event.duration;
        durationCount++;
      }
    }

    const commonErrors = Object.entries(errors)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const successCount = events.filter((e) => e.success).length;
    const successRate = events.length > 0 ? (successCount / events.length) * 100 : 0;
    const averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    const timestamps = events.map((e) => e.timestamp).sort();
    const timeRange = {
      start: timestamps[0] || '',
      end: timestamps[timestamps.length - 1] || '',
    };

    return {
      totalEvents: events.length,
      eventsByType,
      eventsByUser,
      successRate,
      averageDuration,
      commonErrors,
      timeRange,
    };
  }

  /**
   * Export to CSV
   */
  private exportToCSV(events: AuditEvent[]): string {
    if (events.length === 0) {
      return '';
    }

    const headers = [
      'ID',
      'Type',
      'Timestamp',
      'User ID',
      'Description',
      'Success',
      'Error',
      'Duration',
      'Invoice ID',
    ];

    const rows = events.map((event) => [
      event.id,
      event.type,
      event.timestamp,
      event.userId || '',
      event.description,
      event.success ? 'TRUE' : 'FALSE',
      event.error || '',
      event.duration || '',
      event.invoiceId || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Sanitize sensitive data
   */
  private sanitizeSensitiveData(details: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'certificate', 'privateKey'];
    const sanitized = { ...details };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Create an audit trail manager
 */
export function createAuditTrailManager(config: AuditConfig): AuditTrailManager {
  return new AuditTrailManager(config);
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
  config: AuditConfig
): Promise<void> {
  const manager = createAuditTrailManager(config);
  await manager.logEvent(event);
}

/**
 * Query audit events
 */
export async function queryAuditEvents(
  query: AuditQuery = {},
  config: AuditConfig
): Promise<AuditEvent[]> {
  const manager = createAuditTrailManager(config);
  return await manager.queryEvents(query);
}
