import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { validateGitDiff } from '../utils/validation';

export interface CommitMessageResponse {
  commitMessage: string;
  description: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIProvider = 'openai' | 'anthropic';

export interface AISDKServiceOptions {
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export class AISDKService {
  private provider: AIProvider;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private openaiApiKey?: string;
  private anthropicApiKey?: string;

  constructor(options: AISDKServiceOptions = {}) {
    this.provider = options.provider || 'openai';
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 150;
    
    // Set up API keys
    this.openaiApiKey = options.openaiApiKey || process.env.OPENAI_API_KEY;
    this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    
    // Set default models based on provider
    if (this.provider === 'openai') {
      this.model = options.model || 'gpt-4o-mini';
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass openaiApiKey in options.');
      }
    } else if (this.provider === 'anthropic') {
      this.model = options.model || 'claude-3-haiku-20240307';
      if (!this.anthropicApiKey) {
        throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or pass anthropicApiKey in options.');
      }
    } else {
      // Default fallback
      this.model = options.model || 'gpt-4o-mini';
    }
  }

  async generateCommitMessage(gitDiff: string): Promise<CommitMessageResponse> {
    // Validate git diff input
    const validation = validateGitDiff(gitDiff);
    if (!validation.isValid) {
      throw new Error(`Invalid git diff: ${validation.errors.join(', ')}`);
    }

    const prompt = this.buildPrompt(gitDiff);

    try {
      const model = this.getModel();
      
      const result = await generateText({
        model,
        prompt,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });

      // Debug: Log the raw AI response
      console.log('AI SDK Raw Response:', result.text);

      const parsed = this.parseResponse(result.text);
      
      return {
        commitMessage: parsed.commitMessage,
        description: parsed.description,
        usage: {
          promptTokens: result.usage?.promptTokens || 0,
          completionTokens: result.usage?.completionTokens || 0,
          totalTokens: result.usage?.totalTokens || 0,
        }
      };
    } catch (error) {
      throw new Error(`AI SDK Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getModel() {
    if (this.provider === 'openai') {
      // Set environment variable for this call if custom key provided
      if (this.openaiApiKey) {
        process.env.OPENAI_API_KEY = this.openaiApiKey;
      }
      return openai(this.model);
    } else if (this.provider === 'anthropic') {
      // Set environment variable for this call if custom key provided
      if (this.anthropicApiKey) {
        process.env.ANTHROPIC_API_KEY = this.anthropicApiKey;
      }
      return anthropic(this.model);
    }
    
    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  private buildPrompt(gitDiff: string): string {
    return `You are an expert developer who writes clear, concise commit messages following conventional commit format. Generate only the commit message and description, no additional text.

Analyze this git diff and generate a conventional commit message.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, docs, style, refactor, test, chore
- Keep the first line under 50 characters
- Provide a detailed description after a blank line
- Focus on WHAT changed and WHY, not HOW
- Use imperative mood (e.g., "add", "fix", "update")

Git diff:
${gitDiff}

IMPORTANT: You MUST format your response EXACTLY like this:
COMMIT: [your commit message here]
DESCRIPTION: [your detailed description here]

Do not include any other text, explanations, or formatting. Start your response with "COMMIT:" followed by the commit message on the same line, then "DESCRIPTION:" followed by the description on the next line.`;
  }

  private parseResponse(content: string): { commitMessage: string; description: string } {
    const lines = content.trim().split('\n');
    let commitMessage = '';
    let description = '';

    for (const line of lines) {
      if (line.startsWith('COMMIT:')) {
        commitMessage = line.replace('COMMIT:', '').trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        description = line.replace('DESCRIPTION:', '').trim();
      }
    }

    // Debug: Log parsing results
    console.log('AI SDK Parsed commit message:', commitMessage);
    console.log('AI SDK Parsed description:', description);

    // Fallback parsing if the format isn't followed
    if (!commitMessage && !description) {
      const allLines = content.trim().split('\n');
      commitMessage = allLines[0] || '';
      description = allLines.slice(1).join('\n').trim();
      console.log('AI SDK Used fallback parsing - commit:', commitMessage, 'description:', description);
    }

    // Ensure we have at least a commit message
    if (!commitMessage) {
      commitMessage = content.trim().split('\n')[0] || 'chore: update code';
      console.log('AI SDK Used default commit message:', commitMessage);
    }

    return { commitMessage, description };
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const model = this.getModel();
      
      // Simple test generation
      await generateText({
        model,
        prompt: 'Say "OK"',
        maxTokens: 5,
      });
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Method to change provider at runtime
  changeProvider(provider: AIProvider, model?: string): void {
    this.provider = provider;
    
    if (provider === 'openai') {
      this.model = model || 'gpt-4o-mini';
      if (!this.openaiApiKey) {
        throw new Error('OpenAI API key is required to switch to OpenAI provider.');
      }
    } else if (provider === 'anthropic') {
      this.model = model || 'claude-3-haiku-20240307';
      if (!this.anthropicApiKey) {
        throw new Error('Anthropic API key is required to switch to Anthropic provider.');
      }
    }
  }

  // Getter methods
  getCurrentProvider(): AIProvider {
    return this.provider;
  }

  getCurrentModel(): string {
    return this.model;
  }
}

// Export singleton instance factory function
export const createAISDKService = (options?: AISDKServiceOptions) => new AISDKService(options);