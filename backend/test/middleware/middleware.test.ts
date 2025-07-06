import request from 'supertest';
import express from 'express';
import { requestIdMiddleware, loggingMiddleware, logger } from '../../src/middleware/logging';
import { securityMiddleware } from '../../src/middleware/security';
import { metricsMiddleware, metricsCollector } from '../../src/middleware/metrics';

describe('Middleware Tests', () => {
  describe('Security Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(securityMiddleware());
      const testHandler = (req: express.Request, res: express.Response) => {
        res.json({ test: 'ok' });
      };
      app.get('/test', testHandler);
    });

    it('should add security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should remove revealing headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });
  });

  describe('Request ID Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(requestIdMiddleware);
      const testHandler = (req: express.Request, res: express.Response) => {
        res.json({ requestId: req.requestId });
      };
      app.get('/test', testHandler);
    });

    it('should add request ID to request object', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.requestId).toBeDefined();
      expect(typeof response.body.requestId).toBe('string');
      expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    it('should generate unique request IDs', async () => {
      const response1 = await request(app).get('/test');
      const response2 = await request(app).get('/test');

      expect(response1.body.requestId).not.toEqual(response2.body.requestId);
    });
  });

  describe('Logging Middleware', () => {
    let app: express.Application;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      app = express();
      app.use(requestIdMiddleware);
      app.use(loggingMiddleware);
      const testHandler = (req: express.Request, res: express.Response) => {
        res.json({ test: 'ok' });
      };
      app.get('/test', testHandler);
      
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log requests with request ID', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls.find(call => 
        call[0].includes('GET /test') && call[0].includes('Status: 200')
      );
      expect(logCall).toBeDefined();
    });
  });

  describe('Metrics Middleware', () => {
    let app: express.Application;

    beforeEach(() => {
      app = express();
      app.use(requestIdMiddleware);
      app.use(metricsMiddleware);
      const testHandler = (req: express.Request, res: express.Response) => {
        res.json({ test: 'ok' });
      };
      app.get('/test', testHandler);
      
      // Reset metrics before each test
      metricsCollector.reset();
    });

    it('should record request metrics', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.success).toBe(1);
      expect(metrics.requests.errors).toBe(0);
      expect(metrics.requests.byMethod.GET).toBe(1);
      expect(metrics.requests.byStatus['200']).toBe(1);
    });

    it('should track error requests', async () => {
      const errorHandler = (req: express.Request, res: express.Response) => {
        res.status(500).json({ error: 'test error' });
      };
      app.get('/error', errorHandler);

      await request(app)
        .get('/error')
        .expect(500);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.requests.total).toBe(1);
      expect(metrics.requests.success).toBe(0);
      expect(metrics.requests.errors).toBe(1);
      expect(metrics.requests.byStatus['500']).toBe(1);
    });

    it('should track response times', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.performance.averageResponseTime).toBeGreaterThan(0);
      expect(metrics.performance.maxResponseTime).toBeGreaterThan(0);
      expect(metrics.performance.minResponseTime).toBeGreaterThan(0);
    });
  });
});