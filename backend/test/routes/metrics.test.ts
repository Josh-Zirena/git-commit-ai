import request from 'supertest';
import express from 'express';
import { createMetricsRouter, metricsMiddleware, metricsCollector } from '../../src/middleware/metrics';
import { requestIdMiddleware } from '../../src/middleware/logging';

describe('Metrics Route', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(requestIdMiddleware);
    app.use(metricsMiddleware);
    app.use('/metrics', createMetricsRouter());
    const testHandler = (req: express.Request, res: express.Response) => {
      res.json({ test: 'ok' });
    };
    const errorHandler = (req: express.Request, res: express.Response) => {
      res.status(500).json({ error: 'test error' });
    };
    app.get('/test', testHandler);
    app.get('/error', errorHandler);
    
    // Reset metrics before each test
    metricsCollector.reset();
  });

  describe('GET /metrics', () => {
    it('should return metrics with all required fields', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('system');
    });

    it('should return proper request metrics structure', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const requests = response.body.requests;
      expect(requests).toHaveProperty('total');
      expect(requests).toHaveProperty('success');
      expect(requests).toHaveProperty('errors');
      expect(requests).toHaveProperty('byStatus');
      expect(requests).toHaveProperty('byMethod');
      expect(requests).toHaveProperty('byEndpoint');
    });

    it('should return proper performance metrics structure', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const performance = response.body.performance;
      expect(performance).toHaveProperty('averageResponseTime');
      expect(performance).toHaveProperty('maxResponseTime');
      expect(performance).toHaveProperty('minResponseTime');
    });

    it('should return proper memory metrics structure', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const memory = response.body.memory;
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('percentage');
      expect(typeof memory.used).toBe('number');
      expect(typeof memory.total).toBe('number');
      expect(typeof memory.percentage).toBe('number');
    });

    it('should return proper system metrics structure', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const system = response.body.system;
      expect(system).toHaveProperty('nodeVersion');
      expect(system).toHaveProperty('platform');
      expect(system).toHaveProperty('arch');
      expect(system).toHaveProperty('cpuUsage');
      expect(system.nodeVersion).toBe(process.version);
      expect(system.platform).toBe(process.platform);
      expect(system.arch).toBe(process.arch);
    });

    it('should track request counts correctly', async () => {
      // Make some test requests
      await request(app).get('/test').expect(200);
      await request(app).get('/error').expect(500);

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const requests = response.body.requests;
      expect(requests.total).toBeGreaterThan(0);
      expect(requests.success).toBeGreaterThan(0);
      expect(requests.errors).toBeGreaterThan(0);
      expect(requests.byStatus['200']).toBeGreaterThan(0);
      expect(requests.byStatus['500']).toBeGreaterThan(0);
      expect(requests.byMethod['GET']).toBeGreaterThan(0);
    });

    it('should include current timestamp in proper format', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(timestamp).getTime()).not.toBeNaN();
    });

    it('should return uptime as a number', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe('POST /metrics/reset', () => {
    it('should reset metrics successfully', async () => {
      // Make some requests to generate metrics
      await request(app).get('/test').expect(200);
      await request(app).get('/error').expect(500);

      // Check that metrics exist
      const beforeReset = await request(app).get('/metrics').expect(200);
      expect(beforeReset.body.requests.total).toBeGreaterThan(0);

      // Reset metrics
      const resetResponse = await request(app)
        .post('/metrics/reset')
        .expect(200);

      expect(resetResponse.body.success).toBe(true);
      expect(resetResponse.body.message).toBe('Metrics reset successfully');

      // Check that metrics are reset (should only have the /metrics request we just made)
      const afterReset = await request(app).get('/metrics').expect(200);
      expect(afterReset.body.requests.total).toBe(1); // Only the /metrics request
      expect(afterReset.body.requests.success).toBe(1);
      expect(afterReset.body.requests.errors).toBe(0);
    });
  });
});