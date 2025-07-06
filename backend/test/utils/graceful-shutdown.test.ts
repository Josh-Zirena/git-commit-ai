import http from 'http';
import express from 'express';
import { GracefulShutdown } from '../../src/utils/graceful-shutdown';

describe('GracefulShutdown', () => {
  let server: http.Server;
  let app: express.Application;
  let gracefulShutdown: GracefulShutdown;

  beforeEach(() => {
    app = express();
    const testHandler = (req: express.Request, res: express.Response) => {
      res.json({ test: 'ok' });
    };
    app.get('/test', testHandler);
    server = http.createServer(app);
  });

  afterEach(() => {
    if (server && server.listening) {
      server.close();
    }
  });

  describe('Constructor', () => {
    it('should create graceful shutdown instance with default config', () => {
      gracefulShutdown = new GracefulShutdown(server);
      expect(gracefulShutdown).toBeInstanceOf(GracefulShutdown);
    });

    it('should create graceful shutdown instance with custom config', () => {
      const customConfig = {
        timeout: 5000,
        signals: ['SIGTERM'],
        onShutdown: jest.fn()
      };
      gracefulShutdown = new GracefulShutdown(server, customConfig);
      expect(gracefulShutdown).toBeInstanceOf(GracefulShutdown);
    });
  });

  describe('Signal Handling', () => {
    it('should register signal handlers', () => {
      const originalOn = process.on;
      const processSpy = jest.spyOn(process, 'on').mockImplementation(() => process);

      gracefulShutdown = new GracefulShutdown(server);

      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

      processSpy.mockRestore();
    });
  });

  describe('Connection Tracking', () => {
    it('should track connections', (done) => {
      gracefulShutdown = new GracefulShutdown(server);
      
      server.listen(0, () => {
        const port = (server.address() as any).port;
        
        // Make a request to create a connection
        const clientSocket = new (require('net').Socket)();
        clientSocket.connect(port, 'localhost', () => {
          // Connection should be tracked
          expect(gracefulShutdown['connections'].size).toBe(1);
          
          clientSocket.end();
          
          // After connection ends, it should be removed from tracking
          setTimeout(() => {
            expect(gracefulShutdown['connections'].size).toBe(0);
            done();
          }, 100);
        });
      });
    });
  });

  describe('Shutdown Process', () => {
    it('should execute custom shutdown hook', (done) => {
      const onShutdownMock = jest.fn().mockResolvedValue(undefined);
      
      gracefulShutdown = new GracefulShutdown(server, {
        onShutdown: onShutdownMock,
        timeout: 1000
      });

      server.listen(0, () => {
        // Mock process.exit to prevent actual exit
        const originalExit = process.exit;
        process.exit = jest.fn() as any;

        // Trigger shutdown
        gracefulShutdown.forceShutdown().then(() => {
          expect(onShutdownMock).toHaveBeenCalled();
          process.exit = originalExit;
          done();
        }).catch(done);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle shutdown errors gracefully', (done) => {
      const onShutdownMock = jest.fn().mockRejectedValue(new Error('Shutdown error'));
      
      gracefulShutdown = new GracefulShutdown(server, {
        onShutdown: onShutdownMock,
        timeout: 1000
      });

      server.listen(0, () => {
        // Mock process.exit to prevent actual exit
        const originalExit = process.exit;
        process.exit = jest.fn() as any;

        // Trigger shutdown
        gracefulShutdown.forceShutdown().then(() => {
          expect(onShutdownMock).toHaveBeenCalled();
          expect(process.exit).toHaveBeenCalledWith(1);
          process.exit = originalExit;
          done();
        }).catch(done);
      });
    });
  });
});