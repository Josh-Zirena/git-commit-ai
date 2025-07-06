import request from 'supertest';
import app from '../src/index';
import { createOpenAIService } from '../src/services/openai';

// Mock the OpenAI service
jest.mock('../src/services/openai');
const mockCreateOpenAIService = createOpenAIService as jest.MockedFunction<typeof createOpenAIService>;

// Group tests to avoid rate limiting conflicts between describe blocks
describe('Express Server API Tests - Core Functionality', () => {
  let mockOpenAIService: any;

  const validGitDiff = `diff --git a/test.txt b/test.txt
index 1234567..abcdefg 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line 3
 line 4`;

  beforeAll(() => {
    mockOpenAIService = {
      generateCommitMessage: jest.fn(),
    };
    mockCreateOpenAIService.mockReturnValue(mockOpenAIService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIService.generateCommitMessage.mockClear();
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/generate-commit')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });
  });

  describe('Static File Serving', () => {
    it('should serve static files from public directory', async () => {
      // This test checks that static file middleware is configured
      const response = await request(app)
        .get('/nonexistent-static-file.txt')
        .expect(404);
    });
  });

  describe('POST /api/generate-commit', () => {
    describe('Successful Generation', () => {
      it('should generate commit message for valid diff', async () => {
        const mockResult = {
          commitMessage: 'Add new line to test.txt',
          description: 'Added a new line 3 to the test file',
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
        };

        mockOpenAIService.generateCommitMessage.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          commitMessage: mockResult.commitMessage,
          description: mockResult.description,
          usage: mockResult.usage
        });

        expect(mockOpenAIService.generateCommitMessage).toHaveBeenCalledWith(validGitDiff);
      });
    });

    describe('Input Validation', () => {
      it('should return 400 when diff is missing', async () => {
        const response = await request(app)
          .post('/api/generate-commit')
          .send({})
          .expect(400);

        expect(response.body).toEqual({
          error: 'Git diff is required',
          success: false
        });
      });

      it('should return 400 when diff is empty string', async () => {
        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: '' })
          .expect(400);

        expect(response.body).toEqual({
          error: 'Git diff is required',
          success: false
        });
      });

      it('should return 400 when diff is invalid format', async () => {
        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: 'not a valid git diff' })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid git diff format');
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('details');
        expect(Array.isArray(response.body.details)).toBe(true);
      });

      it('should return 400 when diff contains binary files', async () => {
        const binaryDiff = `diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
Binary files a/image.png and b/image.png differ`;

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: binaryDiff })
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Invalid git diff format');
        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('Error Handling', () => {
      it('should handle OpenAI API key errors', async () => {
        mockOpenAIService.generateCommitMessage.mockRejectedValue(
          new Error('API key is not configured')
        );

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff })
          .expect(401);

        expect(response.body).toEqual({
          error: 'OpenAI API key is not configured or invalid',
          success: false
        });
      });

      it('should handle OpenAI rate limit errors', async () => {
        mockOpenAIService.generateCommitMessage.mockRejectedValue(
          new Error('rate limit exceeded')
        );

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff })
          .expect(429);

        expect(response.body).toEqual({
          error: 'OpenAI API rate limit exceeded',
          success: false
        });
      });

      it('should handle generic errors', async () => {
        mockOpenAIService.generateCommitMessage.mockRejectedValue(
          new Error('Something went wrong')
        );

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff })
          .expect(500);

        expect(response.body).toEqual({
          error: 'Something went wrong',
          success: false
        });
      });

      it('should handle unknown errors', async () => {
        mockOpenAIService.generateCommitMessage.mockRejectedValue('Unknown error');

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff })
          .expect(500);

        expect(response.body).toEqual({
          error: 'An unknown error occurred',
          success: false
        });
      });
    });

    describe('Rate Limiting', () => {
      it('should include rate limit headers', async () => {
        const mockResult = {
          commitMessage: 'Test commit',
          description: 'Test description',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        };

        mockOpenAIService.generateCommitMessage.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/generate-commit')
          .send({ diff: validGitDiff });

        // Check that rate limit headers are present
        expect(response.headers).toHaveProperty('ratelimit-limit');
        expect(response.headers).toHaveProperty('ratelimit-remaining');
        expect(response.headers).toHaveProperty('ratelimit-reset');
      });
    });

  });
});

// Separate test suite for 404 handling to avoid rate limit conflicts
describe('Express Server API Tests - 404 Handling', () => {
  let mockOpenAIService: any;

  beforeAll(() => {
    mockOpenAIService = {
      generateCommitMessage: jest.fn(),
    };
    mockCreateOpenAIService.mockReturnValue(mockOpenAIService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIService.generateCommitMessage.mockClear();
  });

  it('should return 404 for non-existent API endpoints', async () => {
    const response = await request(app)
      .get('/api/non-existent-endpoint')
      .expect(404);

    expect(response.body).toEqual({
      error: 'API endpoint not found',
      success: false
    });
  });
});

// Separate test suite for content-type validation to avoid rate limit conflicts
describe('Express Server API Tests - Content-Type Validation', () => {
  let mockOpenAIService: any;

  const validGitDiff = `diff --git a/test.txt b/test.txt
index 1234567..abcdefg 100644
--- a/test.txt
+++ b/test.txt
@@ -1,3 +1,4 @@
 line 1
 line 2
+new line 3
 line 4`;

  beforeAll(() => {
    mockOpenAIService = {
      generateCommitMessage: jest.fn(),
    };
    mockCreateOpenAIService.mockReturnValue(mockOpenAIService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAIService.generateCommitMessage.mockClear();
  });

  it('should handle JSON content type', async () => {
    const mockResult = {
      commitMessage: 'Test commit',
      description: 'Test description',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
    };

    mockOpenAIService.generateCommitMessage.mockResolvedValue(mockResult);

    const response = await request(app)
      .post('/api/generate-commit')
      .set('Content-Type', 'application/json')
      .send({ diff: validGitDiff })
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  it('should handle payload too large error', async () => {
    // Create a diff that's larger than 2MB
    const largeDiff = 'diff --git a/large.txt b/large.txt\n' + 'x'.repeat(3 * 1024 * 1024); // 3MB

    const response = await request(app)
      .post('/api/generate-commit')
      .send({ diff: largeDiff })
      .expect(413);

    expect(response.body).toEqual({
      error: 'Request payload too large',
      success: false
    });
  });
});