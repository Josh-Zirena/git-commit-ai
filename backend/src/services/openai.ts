import OpenAI from 'openai';
import { validateGitDiff } from '../utils/validation';
import { getOpenAIApiKey } from '../utils/secrets';

export interface CommitMessageResponse {
  commitMessage: string;
  description: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OpenAIServiceOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export class OpenAIService {
  private client: OpenAI | null = null;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private apiKey: string | null = null;
  private timeout: number;

  constructor(options: OpenAIServiceOptions = {}) {
    this.model = options.model || 'gpt-4o-mini';
    this.timeout = options.timeout || 30000;
    this.apiKey = options.apiKey || null;
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 150;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.client) {
      return;
    }

    const apiKey = this.apiKey || await getOpenAIApiKey();
    
    this.client = new OpenAI({
      apiKey,
      timeout: this.timeout,
    });
  }

  async generateCommitMessage(gitDiff: string): Promise<CommitMessageResponse> {
    await this.ensureInitialized();
    
    // Validate git diff input
    const validation = validateGitDiff(gitDiff);
    if (!validation.isValid) {
      throw new Error(`Invalid git diff: ${validation.errors.join(', ')}`);
    }

    const prompt = this.buildPrompt(gitDiff);

    try {
      if (!this.client) {
        throw new Error('OpenAI client not initialized');
      }
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert developer who writes clear, concise commit messages following conventional commit format. Generate only the commit message and description, no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content received from OpenAI');
      }

      // Debug: Log the raw AI response
      console.log('OpenAI Raw Response:', content);

      const parsed = this.parseResponse(content);
      
      return {
        commitMessage: parsed.commitMessage,
        description: parsed.description,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        }
      };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API Error: ${error.message} (Status: ${error.status})`);
      }
      throw error;
    }
  }

  private buildPrompt(gitDiff: string): string {
    return `Analyze this git diff and generate a conventional commit message.

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
    console.log('Parsed commit message:', commitMessage);
    console.log('Parsed description:', description);

    // Fallback parsing if the format isn't followed
    if (!commitMessage && !description) {
      const allLines = content.trim().split('\n');
      commitMessage = allLines[0] || '';
      description = allLines.slice(1).join('\n').trim();
      console.log('Used fallback parsing - commit:', commitMessage, 'description:', description);
    }

    // Ensure we have at least a commit message
    if (!commitMessage) {
      commitMessage = content.trim().split('\n')[0] || 'chore: update code';
      console.log('Used default commit message:', commitMessage);
    }

    return { commitMessage, description };
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      if (!this.client) {
        return false;
      }
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance factory function
export const createOpenAIService = (options?: OpenAIServiceOptions) => new OpenAIService(options);