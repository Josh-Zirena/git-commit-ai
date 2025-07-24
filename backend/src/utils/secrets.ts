import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let cachedApiKey: string | null = null;

/**
 * Retrieves the OpenAI API key from AWS Secrets Manager or environment variable
 * Caches the result to avoid repeated API calls
 */
export const getOpenAIApiKey = async (): Promise<string> => {
  // Return cached value if available
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // First try environment variable (for local development)
  if (process.env.OPENAI_API_KEY) {
    cachedApiKey = process.env.OPENAI_API_KEY;
    return cachedApiKey;
  }

  // If no environment variable, try AWS Secrets Manager (for production)
  if (process.env.NODE_ENV === 'production') {
    try {
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
      const command = new GetSecretValueCommand({
        SecretId: 'git-commit-ai-openai-api-key',
      });
      
      const response = await client.send(command);
      
      if (response.SecretString) {
        cachedApiKey = response.SecretString;
        return cachedApiKey;
      }
    } catch (error) {
      console.error('Failed to retrieve API key from AWS Secrets Manager:', error);
      throw new Error('OpenAI API key not found in AWS Secrets Manager');
    }
  }

  throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or configure AWS Secrets Manager.');
};

/**
 * Clears the cached API key (useful for testing)
 */
export const clearApiKeyCache = (): void => {
  cachedApiKey = null;
};