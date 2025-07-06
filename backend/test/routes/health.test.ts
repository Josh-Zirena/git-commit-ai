import request from 'supertest';
import express from 'express';
import healthRouter from '../../src/routes/health';

describe('Health Check Route', () => {
  let app: express.Application;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    app = express();
    app.use('/health', healthRouter);
    // Store original API key
    originalApiKey = process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    // Restore original API key
    if (originalApiKey) {
      process.env.OPENAI_API_KEY = originalApiKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  describe('GET /health', () => {
    it('should return health status with all required fields', async () => {
      // Set up a valid API key for this test
      process.env.OPENAI_API_KEY = 'sk-test-key-123';
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('openai');
    });

    it('should return healthy status when OpenAI API key is properly configured', async () => {
      // Mock a valid API key
      const originalApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'sk-test-key-123';

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.dependencies.openai.status).toBe('healthy');

      // Restore original API key
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should return unhealthy status when OpenAI API key is not configured', async () => {
      // Mock missing API key
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.dependencies.openai.status).toBe('unhealthy');
      expect(response.body.dependencies.openai.message).toBe('OpenAI API key not configured');

      // Restore original API key
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should return unhealthy status when OpenAI API key has invalid format', async () => {
      // Mock invalid API key format
      const originalApiKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'invalid-key-format';

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.dependencies.openai.status).toBe('unhealthy');
      expect(response.body.dependencies.openai.message).toBe('Invalid OpenAI API key format');

      // Restore original API key
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should return proper timestamp format', async () => {
      // Set up a valid API key for this test
      process.env.OPENAI_API_KEY = 'sk-test-key-123';
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(timestamp).getTime()).not.toBeNaN();
    });

    it('should return uptime as a number', async () => {
      // Set up a valid API key for this test
      process.env.OPENAI_API_KEY = 'sk-test-key-123';
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });
});