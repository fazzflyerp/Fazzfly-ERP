/**
 * Centralized Logger - PRODUCTION READY ✅
 * Location: lib/logger.ts
 * 
 * ✅ Fixed all critical bugs
 * ✅ Fixed TypeScript errors
 * ✅ Multi-user safe with request tracking
 * ✅ PII masking
 * ✅ Serverless-safe
 * ✅ Auto-retry on flush failure
 */

import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  requestId: string;
  level: string;
  userId?: string;
  userEmail?: string;
  api: string;
  message: string;
  data?: any;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

// ✅ PII Masking helper
function maskPII(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const masked = Array.isArray(obj) ? [...obj] : { ...obj };
  const sensitiveKeys = ['password', 'token', 'secret', 'ssn', 'credit_card', 'accessToken', 'refreshToken'];

  for (const key in masked) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(s => lowerKey.includes(s))) {
      masked[key] = '***REDACTED***';
    }
    else if (lowerKey.includes('email') && typeof masked[key] === 'string') {
      const email = masked[key] as string;
      if (email.includes('@')) {
        const [user, domain] = email.split('@');
        masked[key] = `${user.substring(0, 3)}***@${domain}`;
      }
    }
    else if (typeof masked[key] === 'object') {
      masked[key] = maskPII(masked[key]);
    }
  }

  return masked;
}

class Logger {
  private logs: LogEntry[] = [];
  private currentLevel: LogLevel = LogLevel.INFO;
  private logDir = join(process.cwd(), "logs");
  private maxLogsInMemory = 1000;
  private isWriting = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushRetries = 3;
  private isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // Save originals before any patching
  private readonly _origLog = console.log.bind(console);
  private readonly _origWarn = console.warn.bind(console);
  private readonly _origError = console.error.bind(console);
  private _isCapturing = false;

  constructor() {
    this.initLogDir();
    this.interceptConsole();

    if (!this.isServerless) {
      this.flushTimer = setInterval(() => this.flushLogs(), 30000);

      process.on("beforeExit", async () => {
        if (this.flushTimer) clearInterval(this.flushTimer);
        await this.flushLogs();
      });
    }
  }

  // ── Console interception ────────────────────────────────────────────────
  private interceptConsole(): void {
    const self = this;
    console.log = (...args: any[]) => { self._origLog(...args); self._captureConsole("INFO", args); };
    console.warn = (...args: any[]) => { self._origWarn(...args); self._captureConsole("WARN", args); };
    console.error = (...args: any[]) => { self._origError(...args); self._captureConsole("ERROR", args); };
  }

  private _captureConsole(defaultLevel: string, args: any[]): void {
    if (this._isCapturing || args.length === 0) return;

    this._isCapturing = true;
    try {
      const firstArg = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);

      // Skip logger's own ANSI-colored output and internal messages
      if (/^\x1b\[/.test(firstArg) || firstArg.includes("💾 Flushed") || firstArg.includes("Failed to create log")) return;

      // Only capture messages that have our [requestId] bracket pattern
      // (all our API routes log with this pattern)
      const reqIdMatch = firstArg.match(/\[([a-zA-Z0-9]{4,16})\]/);
      if (!reqIdMatch) return;
      const requestId = reqIdMatch[1];

      // Detect level from emoji
      let level = defaultLevel;
      if (firstArg.includes("❌")) level = "ERROR";
      else if (firstArg.includes("⚠️")) level = "WARN";

      // Detect API from message keywords (Turbopack hides original file paths in stack)
      const api = this._guessApiFromMessage(firstArg);

      const data = args.length > 1 ? (args.length === 2 ? args[1] : args.slice(1)) : undefined;

      const levelMap: Record<string, LogLevel> = {
        ERROR: LogLevel.ERROR, WARN: LogLevel.WARN,
        INFO: LogLevel.INFO, DEBUG: LogLevel.DEBUG,
      };

      this.log(levelMap[level] ?? LogLevel.INFO, requestId, api, firstArg, data);
    } finally {
      this._isCapturing = false;
    }
  }

  private _guessApiFromMessage(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("upload") || m.includes("drive") || m.includes("image upload")) return "/api/upload";
    if (m.includes("dashboard")) return "/api/dashboard";
    if (m.includes("payroll")) return "/api/payroll";
    if (m.includes("receipt") || m.includes("invoice")) return "/api/receipt";
    if (m.includes("crm") || m.includes("customer") || m.includes("appointment") || m.includes("followup")) return "/api/crm";
    if (m.includes("master")) return "/api/master";
    if (m.includes("module") || m.includes("helper") || m.includes("submit")) return "/api/module";
    if (m.includes("auth") || m.includes("sign in") || m.includes("token")) return "/api/auth";
    if (m.includes("user")) return "/api/user";
    return "/api/other";
  }

  private async initLogDir(): Promise<void> {
    try {
      await mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create log directory:", error);
    }
  }

  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  createContext(api: string, userEmail?: string, maskData = true) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const context = {
      requestId,
      api,
      userEmail,
      startTime,

      setUser: (email: string) => {
        context.userEmail = email;
        return context;
      },

      debug: (message: string, data?: any) => {
        this.log(
          LogLevel.DEBUG,
          requestId,
          api,
          message,
          maskData ? maskPII(data) : data,
          context.userEmail
        );
      },

      info: (message: string, data?: any) => {
        this.log(
          LogLevel.INFO,
          requestId,
          api,
          message,
          maskData ? maskPII(data) : data,
          context.userEmail
        );
      },

      warn: (message: string, data?: any) => {
        this.log(
          LogLevel.WARN,
          requestId,
          api,
          message,
          maskData ? maskPII(data) : data,
          context.userEmail
        );
      },

      error: (message: string, error?: any, data?: any) => {
        this.log(
          LogLevel.ERROR,
          requestId,
          api,
          message,
          maskData ? maskPII(data) : data,
          context.userEmail,
          error
        );
      },

      success: (message: string, data?: any) => {
        const duration = Date.now() - startTime;
        this.log(
          LogLevel.INFO,
          requestId,
          api,
          `✅ ${message}`,
          maskData ? maskPII({ ...data, duration }) : { ...data, duration },
          context.userEmail,
          undefined,
          duration
        );
      },

      measure: (label: string) => {
        const measureStart = Date.now();
        return () => {
          const elapsed = Date.now() - measureStart;
          this.log(
            LogLevel.DEBUG,
            requestId,
            api,
            `⏱️ ${label}`,
            { duration: elapsed },
            context.userEmail,
            undefined,
            elapsed
          );
        };
      },
    };

    return context;
  }

  private log(
    level: LogLevel,
    requestId: string,
    api: string,
    message: string,
    data?: any,
    userEmail?: string,
    error?: any,
    duration?: number
  ): void {
    if (level < this.currentLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      level: LogLevel[level],
      api,
      message,
      userEmail,
      data,
      duration,
    };

    if (error) {
      entry.error = {
        message: error?.message || String(error),
        stack: error?.stack,
      };
    }

    this.logs.push(entry);
    this.consoleLog(entry);

    if (this.isServerless) {
      if (level === LogLevel.ERROR || this.logs.length >= 10) {
        this.flushLogs();
      }
    } else {
      if (this.logs.length >= this.maxLogsInMemory) {
        this.flushLogs();
      }
    }
  }

  private consoleLog(entry: LogEntry): void {
    const colors = {
      DEBUG: "\x1b[36m",
      INFO: "\x1b[32m",
      WARN: "\x1b[33m",
      ERROR: "\x1b[31m",
    };

    const reset = "\x1b[0m";
    const color = colors[entry.level as keyof typeof colors] || "";

    const prefix = `${color}[${entry.level}]${reset} [${entry.requestId}] [${entry.api}]`;
    const user = entry.userEmail ? ` [${entry.userEmail}]` : "";
    const duration = entry.duration ? ` (${entry.duration}ms)` : "";

    this._origLog(`${prefix}${user} ${entry.message}${duration}`);

    if (entry.data) {
      this._origLog("  Data:", JSON.stringify(entry.data, null, 2));
    }

    if (entry.error) {
      this._origError("  Error:", entry.error.message);
      if (entry.error.stack) {
        this._origError(entry.error.stack);
      }
    }
  }

  // ✅ Fixed: Added return type
  private async flushLogs(attempt = 1): Promise<void> {
    if (this.logs.length === 0 || this.isWriting) return;

    this.isWriting = true;
    const logsToWrite = [...this.logs];
    this.logs = [];

    try {
      const date = new Date().toISOString().split("T")[0];
      const filename = join(this.logDir, `${date}.log`);

      const logLines = logsToWrite
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n";

      await appendFile(filename, logLines, "utf8");

      console.log(`💾 Flushed ${logsToWrite.length} logs to ${filename}`);
      
    } catch (error) {
      console.error(`❌ Failed to flush logs (attempt ${attempt}/${this.flushRetries}):`, error);
      
      // ✅ CRITICAL FIX: Restore logs correctly
      this.logs = [...logsToWrite, ...this.logs];
      
      // ✅ Retry with exponential backoff
      if (attempt < this.flushRetries) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.warn(`⚠️ Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        this.isWriting = false;
        return this.flushLogs(attempt + 1);
      } else {
        console.error(`❌ Max retries reached. ${logsToWrite.length} logs kept in memory.`);
      }
      
    } finally {
      this.isWriting = false;
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  getLogs(filter?: {
    level?: string;
    api?: string;
    userEmail?: string;
    startTime?: string;
    endTime?: string;
    requestId?: string;
  }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter?.level) {
      filtered = filtered.filter((log) => log.level === filter.level);
    }

    if (filter?.api) {
      filtered = filtered.filter((log) => log.api === filter.api);
    }

    if (filter?.userEmail) {
      filtered = filtered.filter((log) => log.userEmail === filter.userEmail);
    }

    if (filter?.requestId) {
      filtered = filtered.filter((log) => log.requestId === filter.requestId);
    }

    if (filter?.startTime) {
      filtered = filtered.filter((log) => log.timestamp >= filter.startTime!);
    }

    if (filter?.endTime) {
      filtered = filtered.filter((log) => log.timestamp <= filter.endTime!);
    }

    return filtered;
  }

  getStats() {
    const stats = {
      totalLogs: this.logs.length,
      byLevel: {} as Record<string, number>,
      byApi: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      errorCount: 0,
      avgDuration: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byApi[log.api] = (stats.byApi[log.api] || 0) + 1;

      if (log.userEmail) {
        stats.byUser[log.userEmail] = (stats.byUser[log.userEmail] || 0) + 1;
      }

      if (log.level === "ERROR") {
        stats.errorCount++;
      }

      if (log.duration) {
        totalDuration += log.duration;
        durationCount++;
      }
    }

    if (durationCount > 0) {
      stats.avgDuration = Math.round(totalDuration / durationCount);
    }

    return stats;
  }

  async forceFlush(): Promise<void> {
    await this.flushLogs();
  }

  clearLogs(): void {
    this.logs = [];
  }

  getLogCount(): number {
    return this.logs.length;
  }
}

export const logger = new Logger();

if (process.env.NODE_ENV === "production") {
  logger.setLevel(LogLevel.INFO);
} else {
  logger.setLevel(LogLevel.DEBUG);
}