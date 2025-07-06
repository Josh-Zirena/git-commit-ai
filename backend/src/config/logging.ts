import * as fs from "fs";
import * as path from "path";

export interface LoggingConfig {
  level: string;
  format: "console" | "json";
  enableRequestLogging: boolean;
  enableFileLogging: boolean;
  logDirectory: string;
  maxFileSize: number;
  maxFiles: number;
  enableConsoleLogging: boolean;
}

const defaultConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || "info",
  format: process.env.NODE_ENV === "production" ? "json" : "console",
  enableRequestLogging: true,
  enableFileLogging: process.env.NODE_ENV === "production",
  logDirectory: process.env.LOG_DIR || "./logs",
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  enableConsoleLogging: process.env.NODE_ENV !== "production"
};

export class LoggingSetup {
  private config: LoggingConfig;
  private logFiles: {
    error: string;
    combined: string;
  };

  constructor(config: Partial<LoggingConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.logFiles = {
      error: path.join(this.config.logDirectory, "error.log"),
      combined: path.join(this.config.logDirectory, "combined.log")
    };
    
    this.setupLogDirectory();
  }

  private setupLogDirectory(): void {
    if (this.config.enableFileLogging) {
      try {
        if (!fs.existsSync(this.config.logDirectory)) {
          fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
      } catch (error) {
        console.error("Failed to create log directory:", error);
        // Fallback to console only logging
        this.config.enableFileLogging = false;
      }
    }
  }

  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        const archivePath = path.join(dir, `${base}-${timestamp}${ext}`);
        
        fs.renameSync(filePath, archivePath);
        
        // Clean up old log files
        await this.cleanupOldLogs(dir, base, ext);
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
    }
  }

  private async cleanupOldLogs(dir: string, base: string, ext: string): Promise<void> {
    try {
      const files = fs.readdirSync(dir);
      const logFiles = files
        .filter(file => file.startsWith(base) && file.endsWith(ext) && file !== `${base}${ext}`)
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          time: fs.statSync(path.join(dir, file)).mtime
        }))
        .sort((a, b) => b.time.getTime() - a.time.getTime());

      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.config.maxFiles);
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (error) {
      console.error("Error cleaning up old logs:", error);
    }
  }

  public async writeLog(level: string, message: string, data?: any): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...data
    };

    const formattedMessage = this.config.format === "json" 
      ? JSON.stringify(logEntry) 
      : `[${logEntry.timestamp}] ${logEntry.level}: ${message}`;

    // Console logging
    if (this.config.enableConsoleLogging) {
      switch (level) {
        case "error":
          console.error(formattedMessage);
          break;
        case "warn":
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    }

    // File logging
    if (this.config.enableFileLogging) {
      try {
        const logMessage = formattedMessage + "\n";
        
        // Write to combined log
        await this.rotateLogFile(this.logFiles.combined);
        fs.appendFileSync(this.logFiles.combined, logMessage);
        
        // Write errors to error log
        if (level === "error") {
          await this.rotateLogFile(this.logFiles.error);
          fs.appendFileSync(this.logFiles.error, logMessage);
        }
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  }

  public getConfig(): LoggingConfig {
    return { ...this.config };
  }
}

export const createLoggingSetup = (config?: Partial<LoggingConfig>): LoggingSetup => {
  return new LoggingSetup(config);
};

export default LoggingSetup;