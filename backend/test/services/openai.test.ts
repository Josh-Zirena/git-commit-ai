import { OpenAIService } from '../../src/services/openai';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

// Mock secrets utility
jest.mock('../../src/utils/secrets', () => ({
  getOpenAIApiKey: jest.fn(),
  clearApiKeyCache: jest.fn(),
}));

import { getOpenAIApiKey } from '../../src/utils/secrets';
const mockGetOpenAIApiKey = getOpenAIApiKey as jest.MockedFunction<typeof getOpenAIApiKey>;

describe('OpenAIService', () => {
  let service: OpenAIService;
  let mockClient: jest.Mocked<OpenAI>;
  let mockCreate: jest.Mock;
  let mockList: jest.Mock;

  const validGitDiff = `diff --git a/src/test.js b/src/test.js
index 1234567..abcdefg 100644
--- a/src/test.js
+++ b/src/test.js
@@ -1,3 +1,4 @@
 function test() {
   console.log('test');
+  return true;
 }`;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create mock functions
    mockCreate = jest.fn();
    mockList = jest.fn();
    
    // Mock OpenAI client
    mockClient = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: {
        list: mockList,
      },
    } as any;
    
    MockedOpenAI.mockImplementation(() => mockClient);
    
    // Create service instance
    service = new OpenAIService({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('should create OpenAI service without immediate initialization', () => {
      const newService = new OpenAIService({ apiKey: 'test-key' });
      expect(newService).toBeDefined();
      // OpenAI client should not be created until first method call
      expect(MockedOpenAI).not.toHaveBeenCalled();
    });

    it('should create OpenAI service with custom options', () => {
      const customService = new OpenAIService({
        apiKey: 'custom-key',
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 200,
        timeout: 60000,
      });
      expect(customService).toBeDefined();
      // OpenAI client should not be created until first method call
      expect(MockedOpenAI).not.toHaveBeenCalled();
    });

    it('should handle no API key during construction', () => {
      delete process.env.OPENAI_API_KEY;
      
      // Constructor should not throw - error happens on first method call
      expect(() => {
        new OpenAIService();
      }).not.toThrow();
    });

    it('should initialize OpenAI client on first method call', async () => {
      delete process.env.OPENAI_API_KEY; // Clear env var to test secrets manager fallback
      mockGetOpenAIApiKey.mockResolvedValue('secrets-key');
      const newService = new OpenAIService();
      
      // Mock successful response
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'COMMIT: test\nDESCRIPTION: test' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      });
      
      await newService.generateCommitMessage(validGitDiff);
      
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: 'secrets-key',
        timeout: 30000,
      });
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: feat: add return statement to test function\nDESCRIPTION: Added return true statement to test function for better testing capability'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(validGitDiff);

      expect(result).toEqual({
        commitMessage: 'feat: add return statement to test function',
        description: 'Added return true statement to test function for better testing capability',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        }
      });
    });

    it('should handle response without proper format', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'feat: add return statement\n\nAdded return true to improve function'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(validGitDiff);

      expect(result.commitMessage).toBe('feat: add return statement');
      expect(result.description).toBe('Added return true to improve function');
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: ''
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(service.generateCommitMessage(validGitDiff)).rejects.toThrow('No response content received from OpenAI');
    });

    it('should throw error for invalid git diff', async () => {
      const invalidDiff = 'not a git diff';

      await expect(service.generateCommitMessage(invalidDiff)).rejects.toThrow('Invalid git diff');
    });

    it('should throw error when no response content', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: null
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await expect(service.generateCommitMessage(validGitDiff)).rejects.toThrow('No response content received from OpenAI');
    });

    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('Rate limit exceeded') as any;
      apiError.status = 429;
      mockCreate.mockRejectedValue(apiError);

      await expect(service.generateCommitMessage(validGitDiff)).rejects.toThrow('Rate limit exceeded');
    });

    it('should rethrow non-OpenAI errors', async () => {
      const genericError = new Error('Network error');
      mockCreate.mockRejectedValue(genericError);

      await expect(service.generateCommitMessage(validGitDiff)).rejects.toThrow('Network error');
    });

    it('should call OpenAI with correct parameters', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: feat: test\nDESCRIPTION: test description'
          }
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      await service.generateCommitMessage(validGitDiff);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert developer who writes clear, concise commit messages following conventional commit format. Generate only the commit message and description, no additional text.'
          },
          {
            role: 'user',
            content: expect.stringContaining('Analyze this git diff and generate a conventional commit message.')
          }
        ],
        temperature: 0.1,
        max_tokens: 150,
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when OpenAI API is accessible', async () => {
      mockList.mockResolvedValue({} as any);

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockList).toHaveBeenCalled();
    });

    it('should return false when OpenAI API is not accessible', async () => {
      mockList.mockRejectedValue(new Error('API Error'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('different diff types', () => {
    it('should handle file addition', async () => {
      const additionDiff = `diff --git a/new-file.js b/new-file.js
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/new-file.js
@@ -0,0 +1,3 @@
+function newFunction() {
+  return 'hello';
+}`;

      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: feat: add new utility function\nDESCRIPTION: Added new utility function for greeting'
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(additionDiff);

      expect(result.commitMessage).toBe('feat: add new utility function');
    });

    it('should handle file deletion', async () => {
      const deletionDiff = `diff --git a/old-file.js b/old-file.js
deleted file mode 100644
index 1234567..0000000
--- a/old-file.js
+++ /dev/null
@@ -1,3 +0,0 @@
-function oldFunction() {
-  return 'old';
-}`;

      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: chore: remove deprecated function\nDESCRIPTION: Removed old deprecated function that is no longer needed'
          }
        }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(deletionDiff);

      expect(result.commitMessage).toBe('chore: remove deprecated function');
    });
  });

  describe('usage tracking', () => {
    it('should track token usage correctly', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: feat: test\nDESCRIPTION: test'
          }
        }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 75,
          total_tokens: 275,
        }
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(validGitDiff);

      expect(result.usage).toEqual({
        promptTokens: 200,
        completionTokens: 75,
        totalTokens: 275,
      });
    });

    it('should handle missing usage data', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'COMMIT: feat: test\nDESCRIPTION: test'
          }
        }],
        usage: undefined
      };

      mockCreate.mockResolvedValue(mockResponse as any);

      const result = await service.generateCommitMessage(validGitDiff);

      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
  });
});