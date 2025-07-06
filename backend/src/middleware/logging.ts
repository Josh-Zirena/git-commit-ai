import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export interface LogLevel {
  INFO: "info";
  WARN: "warn";
  ERROR: "error";
}

export const LOG_LEVELS: LogLevel = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error"
};

export interface LogEntry {
  level: string;
  timestamp: string;
  requestId: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;
  message?: string;
  error?: any;
}

export interface LoggerConfig {
  level: string;
  format: "console" | "json";
  enableRequestLogging: boolean;
}

const defaultConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL || "info",
  format: process.env.NODE_ENV === "production" ? "json" : "console",
  enableRequestLogging: true
};

class Logger {
  private config: LoggerConfig;

  constructor(config: LoggerConfig = defaultConfig) {
    this.config = config;
  }

  private shouldLog(level: string): boolean {
    const levels = ["error", "warn", "info"];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex <= currentLevelIndex;
  }

  private formatLog(entry: LogEntry): string {
    if (this.config.format === "json") {
      return JSON.stringify(entry);
    }
    
    const timestamp = entry.timestamp;
    const level = entry.level.toUpperCase();
    const requestId = entry.requestId.substring(0, 8);
    
    if (entry.method && entry.url) {
      return `[${timestamp}] ${level} [${requestId}] ${entry.method} ${entry.url} - Status: ${entry.statusCode || "N/A"} - Duration: ${entry.duration || "N/A"}ms`;
    }
    
    return `[${timestamp}] ${level} [${requestId}] ${entry.message || ""}`;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.formatLog(entry);
    
    switch (entry.level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "info":
      default:
        console.log(formatted);
        break;
    }
  }

  info(message: string, requestId: string, meta?: any): void {
    this.log({
      level: LOG_LEVELS.INFO,
      timestamp: new Date().toISOString(),
      requestId,
      message,
      ...meta
    });
  }

  warn(message: string, requestId: string, meta?: any): void {
    this.log({
      level: LOG_LEVELS.WARN,
      timestamp: new Date().toISOString(),
      requestId,
      message,
      ...meta
    });
  }

  error(message: string, requestId: string, error?: any, meta?: any): void {
    this.log({
      level: LOG_LEVELS.ERROR,
      timestamp: new Date().toISOString(),
      requestId,
      message,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      ...meta
    });
  }

  logRequest(req: Request, res: Response, duration: number): void {
    if (!this.config.enableRequestLogging) {
      return;
    }

    const requestId = req.requestId || "unknown";
    this.log({
      level: LOG_LEVELS.INFO,
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress
    });
  }
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: Logger;
    }
  }
}

export const logger = new Logger();

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.requestId = uuidv4();
  req.logger = logger;
  next();
};

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    logger.logRequest(req, res, duration);
    return originalSend.call(this, body);
  };
  
  next();
};

export default logger;