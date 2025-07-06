import { EnhancedOpenAIService } from '../../src/services/enhancedOpenAI';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  commitMessage: 'feat: add new feature',
                  description: 'Added a new feature to improve functionality',
                  summary: 'New feature implementation'
                })
              }
            }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
              total_tokens: 150
            }
          })
        }
      }
    }))
  };
});

describe('EnhancedOpenAIService', () => {
  let service: EnhancedOpenAIService;

  beforeEach(() => {
    service = new EnhancedOpenAIService({
      apiKey: 'test-key',
      maxDirectSize: 500, // Very small for testing
      maxTotalSize: 2000,
      enableSummarization: true
    });
  });

  describe('Small diff handling', () => {
    it('should process small diffs directly', async () => {
      const smallDiff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 export function test() {
   return 'hello';
 }
+// New comment`;

      const result = await service.generateCommitMessage(smallDiff);

      expect(result.commitMessage).toBe('feat: add new feature');
      expect(result.description).toBe('Added a new feature to improve functionality');
      expect(result.processingInfo.processingStrategy).toBe('direct');
      expect(result.processingInfo.wasTruncated).toBe(false);
      expect(result.processingInfo.originalSize).toBe(smallDiff.length);
    });
  });

  describe('Large diff handling', () => {
    it('should process large diffs with chunking', async () => {
      // Create a large diff that exceeds maxDirectSize (500 chars)
      const largeDiff = `diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,10 +1,20 @@
 export function file1() {
   const data = 'hello world this is a long line to make the diff exceed the size limit for direct processing';
   const moreData = 'this is a much longer file with lots of content to ensure we trigger chunking mode';
   const evenMoreData = 'making it exceed the size limit with even more verbose content and explanations';
   const lotsOfData = 'adding significantly more content to make it large enough to require chunking processing';
+  const newData = 'new functionality added with comprehensive implementation details and documentation';
+  const anotherLine = 'another line of code with extensive comments and detailed explanations of functionality';
+  const yetAnother = 'yet another line with very detailed and comprehensive implementation information';
+  const finalLine = 'final line of new code with complete documentation and extensive comments explaining the logic';
   return data + moreData + evenMoreData + lotsOfData + newData + anotherLine + yetAnother + finalLine;
 }

diff --git a/file2.ts b/file2.ts
index 2345678..bcdefgh 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,5 +1,10 @@
 export function file2() {
   const config = 'configuration with detailed settings and comprehensive options for all use cases';
+  const newConfig = 'new configuration option with extensive documentation and detailed explanations';
+  const anotherConfig = 'another config with comprehensive settings and detailed configuration options';
+  const moreConfig = 'more configuration with extensive options and detailed settings for advanced users';
   return config + newConfig + anotherConfig + moreConfig;
 }`;

      const result = await service.generateCommitMessage(largeDiff);

      expect(result.commitMessage).toBe('feat: add new feature');
      expect(result.processingInfo.processingStrategy).toMatch(/chunked|summarized/);
      expect(result.processingInfo.originalSize).toBe(largeDiff.length);
      expect(result.processingInfo.processedSize).toBeGreaterThan(0);
      expect(result.processingInfo.filesAnalyzed).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid git diff', async () => {
      const invalidDiff = 'This is not a git diff';

      await expect(service.generateCommitMessage(invalidDiff))
        .rejects.toThrow('Invalid git diff');
    });

    it('should handle empty diff', async () => {
      await expect(service.generateCommitMessage(''))
        .rejects.toThrow('Invalid git diff');
    });
  });

  describe('Processing info', () => {
    it('should provide accurate processing information', async () => {
      const diff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,2 +1,3 @@
 export function test() {
+  console.log('new line');
   return 'hello';
 }`;

      const result = await service.generateCommitMessage(diff);

      expect(result.processingInfo).toEqual({
        originalSize: diff.length,
        processedSize: expect.any(Number),
        filesAnalyzed: expect.any(Number),
        totalFiles: expect.any(Number),
        wasTruncated: expect.any(Boolean),
        processingStrategy: expect.stringMatching(/direct|chunked|summarized/)
      });

      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });
    });
  });
});