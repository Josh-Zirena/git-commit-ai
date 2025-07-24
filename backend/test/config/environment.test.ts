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
    it('should use OPENAI_API_KEY environment variable (not OPEN_AI_API_KEY)', () => {
      // Clear both possible environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPEN_AI_API_KEY;

      // Set the incorrect one
      process.env.OPEN_AI_API_KEY = 'sk-test-incorrect-key';

      // Try to create service that uses the API key
      expect(() => {
        createOpenAIService();
      }).toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in options.');
    });

    it('should work with correct OPENAI_API_KEY environment variable', () => {
      // Set the correct environment variable
      process.env.OPENAI_API_KEY = 'sk-test-correct-key';
      delete process.env.OPEN_AI_API_KEY;

      // This should not throw an error during initialization
      expect(() => {
        createOpenAIService();
      }).not.toThrow();
    });

    it('should fail when no OpenAI API key is provided', () => {
      // Clear all possible API key environment variables
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPEN_AI_API_KEY;

      // Try to create service that uses the API key
      expect(() => {
        createOpenAIService();
      }).toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in options.');
    });

    it('should detect common environment variable naming mistakes', () => {
      const commonMistakes = [
        'OPEN_AI_API_KEY',
        'OPENAI_APIKEY', 
        'OPEN_AI_APIKEY',
        'OPENAI_KEY',
        'OPEN_AI_KEY'
      ];

      // Test that none of these incorrect names work
      commonMistakes.forEach(incorrectName => {
        // Clear correct variable and set incorrect one
        delete process.env.OPENAI_API_KEY;
        process.env[incorrectName] = 'sk-test-key';

        expect(() => {
          createOpenAIService();
        }).toThrow('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in options.');

        // Clean up
        delete process.env[incorrectName];
      });
    });
  });

  describe('Terraform Environment Variable Validation', () => {
    it('should validate that Terraform uses correct environment variable name', () => {
      // Read the Terraform file to ensure it uses the correct variable name
      const fs = require('fs');
      const path = require('path');
      
      const terraformPath = path.join(__dirname, '../../../aws-resources.tf');
      const terraformContent = fs.readFileSync(terraformPath, 'utf8');
      
      // Check that Terraform uses OPENAI_API_KEY (correct)
      expect(terraformContent).toMatch(/OPENAI_API_KEY/);
      
      // Check that Terraform doesn't use OPEN_AI_API_KEY (incorrect)
      expect(terraformContent).not.toMatch(/OPEN_AI_API_KEY/);
    });
  });
});