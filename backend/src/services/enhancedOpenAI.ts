import OpenAI from 'openai';
import { DiffProcessor, ProcessedDiff } from '../utils/diffProcessor';
import { validateGitDiff } from '../utils/validation';

export interface EnhancedCommitMessageResponse {
  commitMessage: string;
  description: string;
  summary: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingInfo: {
    originalSize: number;
    processedSize: number;
    filesAnalyzed: number;
    totalFiles: number;
    wasTruncated: boolean;
    processingStrategy: 'direct' | 'chunked' | 'summarized';
  };
}

export interface EnhancedOpenAIServiceOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  // Large diff handling options
  maxDirectSize?: number; // Process directly if under this size
  maxChunkSize?: number;   // Size of individual chunks
  maxTotalSize?: number;   // Total size after chunking
  enableSummarization?: boolean;
}

export class EnhancedOpenAIService {
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private diffProcessor: DiffProcessor;
  private maxDirectSize: number;
  private enableSummarization: boolean;

  constructor(options: EnhancedOpenAIServiceOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in options.');
    }

    this.client = new OpenAI({
      apiKey,
      timeout: options.timeout || 60000, // Increased timeout for large diffs
    });

    this.model = options.model || 'gpt-4o-mini';
    this.temperature = options.temperature || 0.1;
    this.maxTokens = options.maxTokens || 200;
    this.maxDirectSize = options.maxDirectSize || 100 * 1024; // 100KB
    this.enableSummarization = options.enableSummarization ?? true;

    this.diffProcessor = new DiffProcessor({
      maxChunkSize: options.maxChunkSize || 50 * 1024,
      maxTotalSize: options.maxTotalSize || 400 * 1024,
      maxFiles: 100
    });
  }

  async generateCommitMessage(gitDiff: string): Promise<EnhancedCommitMessageResponse> {
    // Initial validation
    const validation = validateGitDiff(gitDiff, { 
      maxSize: 10 * 1024 * 1024, // Allow up to 10MB for processing
      allowBinaryFiles: true 
    });
    
    if (!validation.isValid) {
      throw new Error(`Invalid git diff: ${validation.errors.join(', ')}`);
    }

    const originalSize = gitDiff.length;
    let processingStrategy: 'direct' | 'chunked' | 'summarized' = 'direct';
    let processedDiff: string;
    let processedInfo: ProcessedDiff | null = null;

    // Determine processing strategy based on size
    if (originalSize <= this.maxDirectSize) {
      // Small diff - process directly
      processedDiff = gitDiff;
      processingStrategy = 'direct';
    } else {
      // Large diff - process with chunking
      processedInfo = this.diffProcessor.processDiff(gitDiff);
      
      if (this.enableSummarization && processedInfo.isTruncated) {
        // Very large diff - use summarization strategy
        processingStrategy = 'summarized';
        processedDiff = await this.createSummarizedDiff(processedInfo);
      } else {
        // Large diff - use chunking strategy
        processingStrategy = 'chunked';
        processedDiff = this.createChunkedDiff(processedInfo);
      }
    }

    // Generate commit message
    const prompt = this.createPrompt(processedDiff, processingStrategy, processedInfo);
    
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(processingStrategy)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }

      const parsed = this.parseResponse(response);
      
      return {
        ...parsed,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        processingInfo: {
          originalSize,
          processedSize: processedDiff.length,
          filesAnalyzed: processedInfo?.chunks.length || 1,
          totalFiles: processedInfo?.totalFiles || 1,
          wasTruncated: processedInfo?.isTruncated || false,
          processingStrategy
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('context_length_exceeded')) {
          throw new Error('The git diff is too large even after processing. Please split into smaller commits.');
        }
        throw error;
      }
      throw new Error('Unknown error occurred while generating commit message');
    }
  }

  private createChunkedDiff(processedInfo: ProcessedDiff): string {
    const chunks = processedInfo.chunks.map(chunk => {
      return `File: ${chunk.filePath} (${chunk.changeType}, +${chunk.linesAdded}/-${chunk.linesDeleted} lines, priority: ${chunk.priority})\n${chunk.content}`;
    }).join('\n\n---\n\n');

    const header = `DIFF SUMMARY: ${processedInfo.summary}\n` +
                  `Files processed: ${processedInfo.chunks.length}/${processedInfo.totalFiles}\n` +
                  (processedInfo.isTruncated ? 'Note: Some files were truncated due to size limits.\n' : '') +
                  '\n---\n\n';

    return header + chunks;
  }

  private async createSummarizedDiff(processedInfo: ProcessedDiff): Promise<string> {
    // Create a high-level summary for very large diffs
    const filesSummary = processedInfo.chunks.map(chunk => 
      `${chunk.filePath}: ${chunk.changeType} (+${chunk.linesAdded}/-${chunk.linesDeleted})`
    ).join('\n');

    // Include only the most important chunks with content
    const importantChunks = processedInfo.chunks
      .filter(chunk => chunk.priority >= 4)
      .slice(0, 5) // Maximum 5 most important files
      .map(chunk => `${chunk.filePath}:\n${chunk.content.substring(0, 2000)}...`)
      .join('\n\n');

    return `LARGE DIFF SUMMARY (${processedInfo.totalFiles} files, ${processedInfo.totalLinesAdded}+ ${processedInfo.totalLinesDeleted}- lines)

FILES CHANGED:
${filesSummary}

KEY CHANGES (most important files):
${importantChunks}

Note: This is a summarized view of a large changeset. Full details were truncated.`;
  }

  private getSystemPrompt(strategy: 'direct' | 'chunked' | 'summarized'): string {
    const basePrompt = `You are a helpful assistant that generates concise, meaningful git commit messages based on git diffs.

Format your response as JSON:
{
  "commitMessage": "type: brief description",
  "description": "More detailed explanation of what changed and why",
  "summary": "High-level summary of the changes"
}

Follow conventional commit format (feat:, fix:, docs:, style:, refactor:, test:, chore:).
Keep commit messages under 72 characters.
Focus on the "what" and "why" of changes, not the "how".`;

    if (strategy === 'chunked') {
      return basePrompt + `

This diff has been processed and chunked due to its size. Files are prioritized by importance.
Focus on the most significant changes and provide a commit message that captures the overall intent.`;
    }

    if (strategy === 'summarized') {
      return basePrompt + `

This is a summarized view of a very large changeset. Focus on the high-level changes and overall purpose.
The commit message should reflect the main goal or theme of this large set of changes.`;
    }

    return basePrompt;
  }

  private createPrompt(
    processedDiff: string, 
    strategy: 'direct' | 'chunked' | 'summarized',
    processedInfo: ProcessedDiff | null
  ): string {
    let prompt = `Please analyze this git diff and generate a commit message:\n\n${processedDiff}`;

    if (strategy === 'chunked' && processedInfo) {
      prompt += `\n\nAdditional context: This changeset affects ${processedInfo.totalFiles} files total, with ${processedInfo.totalLinesAdded} additions and ${processedInfo.totalLinesDeleted} deletions.`;
    }

    if (strategy === 'summarized') {
      prompt += `\n\nNote: This represents a large changeset that has been summarized. Focus on the overall theme and purpose.`;
    }

    return prompt;
  }

  private parseResponse(response: string): { commitMessage: string; description: string; summary: string } {
    try {
      const parsed = JSON.parse(response);
      return {
        commitMessage: parsed.commitMessage || 'feat: update codebase',
        description: parsed.description || 'Various improvements and changes',
        summary: parsed.summary || 'Code changes'
      };
    } catch {
      // Fallback parsing if JSON fails
      const lines = response.split('\n').filter(line => line.trim());
      return {
        commitMessage: lines[0] || 'feat: update codebase',
        description: lines.slice(1).join(' ') || 'Various improvements and changes',
        summary: 'Code changes'
      };
    }
  }
}

export function createEnhancedOpenAIService(options?: EnhancedOpenAIServiceOptions): EnhancedOpenAIService {
  return new EnhancedOpenAIService(options);
}