// Set NODE_ENV to test for all test runs
process.env.NODE_ENV = 'test';

// Mock OpenAI API key if not set
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = "sk-test-openai-key-for-testing";
}

// Mock Cognito config for tests
process.env.COGNITO_USER_POOL_ID = "test-pool-id";
process.env.COGNITO_CLIENT_ID = "test-client-id";
process.env.COGNITO_CLIENT_SECRET = "test-client-secret";
process.env.AWS_REGION = "us-east-1";