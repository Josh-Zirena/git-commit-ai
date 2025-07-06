import * as fs from 'fs';
import * as path from 'path';
import { LoggingSetup } from '../../src/config/logging';

describe('LoggingSetup', () => {
  let loggingSetup: LoggingSetup;
  let tempLogDir: string;

  beforeEach(() => {
    tempLogDir = path.join(__dirname, '../../../test-logs');
    loggingSetup = new LoggingSetup({
      logDirectory: tempLogDir,
      enableFileLogging: true,
      enableConsoleLogging: false
    });
  });

  afterEach(() => {
    // Clean up test log files
    if (fs.existsSync(tempLogDir)) {
      const files = fs.readdirSync(tempLogDir);
      for (const file of files) {
        const filePath = path.join(tempLogDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(tempLogDir);
    }
  });

  describe('Constructor', () => {
    it('should create logging setup with default config', () => {
      const setup = new LoggingSetup();
      expect(setup).toBeInstanceOf(LoggingSetup);
      expect(setup.getConfig().level).toBe('info');
    });

    it('should create logging setup with custom config', () => {
      const customConfig = {
        level: 'error',
        format: 'json' as const,
        enableFileLogging: false
      };
      const setup = new LoggingSetup(customConfig);
      expect(setup.getConfig().level).toBe('error');
      expect(setup.getConfig().format).toBe('json');
      expect(setup.getConfig().enableFileLogging).toBe(false);
    });
  });

  describe('Log Directory Setup', () => {
    it('should create log directory if it does not exist', () => {
      expect(fs.existsSync(tempLogDir)).toBe(true);
    });

    it('should handle log directory creation errors gracefully', () => {
      // Mock console.error to avoid test output noise
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      const setup = new LoggingSetup({
        logDirectory: '/invalid/path/that/cannot/be/created',
        enableFileLogging: true
      });
      
      // Should not throw error and should disable file logging
      expect(setup.getConfig().enableFileLogging).toBe(false);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Log Writing', () => {
    it('should write log to file when file logging is enabled', async () => {
      const testMessage = 'Test log message';
      await loggingSetup.writeLog('info', testMessage);

      const combinedLogPath = path.join(tempLogDir, 'combined.log');
      expect(fs.existsSync(combinedLogPath)).toBe(true);

      const logContent = fs.readFileSync(combinedLogPath, 'utf8');
      expect(logContent).toContain(testMessage);
      expect(logContent).toContain('INFO');
    });

    it('should write error logs to both combined and error log files', async () => {
      const testMessage = 'Test error message';
      await loggingSetup.writeLog('error', testMessage);

      const combinedLogPath = path.join(tempLogDir, 'combined.log');
      const errorLogPath = path.join(tempLogDir, 'error.log');

      expect(fs.existsSync(combinedLogPath)).toBe(true);
      expect(fs.existsSync(errorLogPath)).toBe(true);

      const combinedContent = fs.readFileSync(combinedLogPath, 'utf8');
      const errorContent = fs.readFileSync(errorLogPath, 'utf8');

      expect(combinedContent).toContain(testMessage);
      expect(errorContent).toContain(testMessage);
    });

    it('should format logs as JSON when format is set to json', async () => {
      const setup = new LoggingSetup({
        logDirectory: tempLogDir,
        format: 'json',
        enableFileLogging: true,
        enableConsoleLogging: false
      });

      const testMessage = 'Test JSON log';
      await setup.writeLog('info', testMessage, { extra: 'data' });

      const combinedLogPath = path.join(tempLogDir, 'combined.log');
      const logContent = fs.readFileSync(combinedLogPath, 'utf8');

      expect(() => JSON.parse(logContent.trim())).not.toThrow();
      const parsedLog = JSON.parse(logContent.trim());
      expect(parsedLog.message).toBe(testMessage);
      expect(parsedLog.level).toBe('INFO');
      expect(parsedLog.extra).toBe('data');
    });

    it('should handle file write errors gracefully', async () => {
      // Create a setup that will fail file writes by using a read-only directory
      const readOnlyDir = path.join(tempLogDir, 'readonly');
      fs.mkdirSync(readOnlyDir, { recursive: true });
      
      const setup = new LoggingSetup({
        logDirectory: readOnlyDir,
        enableFileLogging: true,
        enableConsoleLogging: false
      });

      // Mock console.error to suppress error output
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw error even if file write fails
      await expect(setup.writeLog('info', 'test message')).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Log Rotation', () => {
    it('should rotate log files when they exceed max size', async () => {
      const setup = new LoggingSetup({
        logDirectory: tempLogDir,
        enableFileLogging: true,
        enableConsoleLogging: false,
        maxFileSize: 100 // Very small size to trigger rotation
      });

      // Write enough data to trigger rotation
      const longMessage = 'x'.repeat(200);
      await setup.writeLog('info', longMessage);

      // Write another message to trigger rotation
      await setup.writeLog('info', 'Second message');

      const logFiles = fs.readdirSync(tempLogDir);
      const combinedLogs = logFiles.filter(file => file.startsWith('combined'));
      
      // Should have at least 2 files (original and rotated)
      expect(combinedLogs.length).toBeGreaterThan(1);
    });
  });

  describe('Console Logging', () => {
    it('should log to console when console logging is enabled', async () => {
      const setup = new LoggingSetup({
        enableConsoleLogging: true,
        enableFileLogging: false
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await setup.writeLog('info', 'Test console message');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should use console.error for error logs', async () => {
      const setup = new LoggingSetup({
        enableConsoleLogging: true,
        enableFileLogging: false
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await setup.writeLog('error', 'Test error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});