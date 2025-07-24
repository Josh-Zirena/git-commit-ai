import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createOpenAIService } from '../../src/services/openai';

describe('Environment Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('OpenAI API Key Configuration', () => {
    it('should use OPENAI_API_KEY environment variable (not OPEN_AI_API_KEY)', async () => {
      // Clear both possible environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPEN_AI_API_KEY;

      // Set the incorrect one
      process.env.OPEN_AI_API_KEY = 'sk-test-incorrect-key';

      // Try to create service and call a method that initializes it
      const service = createOpenAIService();
      await expect(service.generateCommitMessage('test')).rejects.toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or configure AWS Secrets Manager.');
    });

    it('should work with correct OPENAI_API_KEY environment variable', async () => {
      // Set the correct environment variable
      process.env.OPENAI_API_KEY = 'sk-test-correct-key';
      delete process.env.OPEN_AI_API_KEY;

      // This should not throw an error during initialization
      const service = createOpenAIService();
      // Just check that we can create the service without errors
      expect(service).toBeDefined();
    });

    it('should fail when no OpenAI API key is provided', async () => {
      // Clear all possible API key environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPEN_AI_API_KEY;

      // Try to create service and call a method that initializes it
      const service = createOpenAIService();
      await expect(service.generateCommitMessage('test')).rejects.toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or configure AWS Secrets Manager.');
    });

    it('should detect common environment variable naming mistakes', async () => {
      const commonMistakes = [
        'OPEN_AI_API_KEY',
        'OPENAI_APIKEY', 
        'OPEN_AI_APIKEY',
        'OPENAI_KEY',
        'OPEN_AI_KEY'
      ];

      // Test that none of these incorrect names work
      for (const incorrectName of commonMistakes) {
        // Clear correct variable and set incorrect one
        delete process.env.OPENAI_API_KEY;
        process.env[incorrectName] = 'sk-test-key';

        const service = createOpenAIService();
        await expect(service.generateCommitMessage('test')).rejects.toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or configure AWS Secrets Manager.');

        // Clean up
        delete process.env[incorrectName];
      }
    });
  });

  describe('Terraform Configuration Validation', () => {
    it('should use AWS Secrets Manager instead of environment variables', () => {
      // Read the Terraform file to ensure it uses Secrets Manager approach
      const fs = require('fs');
      const path = require('path');
      
      const terraformPath = path.join(__dirname, '../../../aws-resources.tf');
      const terraformContent = fs.readFileSync(terraformPath, 'utf8');
      
      // Check that Terraform creates the secrets manager secret
      expect(terraformContent).toMatch(/aws_secretsmanager_secret.*openai_api_key/);
      
      // Check that Lambda environment doesn't include OPENAI_API_KEY (we fetch at runtime)
      const envBlockMatch = terraformContent.match(/environment\s*{[^}]*}/);
      if (envBlockMatch) {
        expect(envBlockMatch[0]).not.toMatch(/OPENAI_API_KEY/);
      }
      
      // Check that Terraform doesn't use OPEN_AI_API_KEY (incorrect naming)
      expect(terraformContent).not.toMatch(/OPEN_AI_API_KEY/);
    });
  });
});