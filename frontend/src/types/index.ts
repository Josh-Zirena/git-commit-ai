export interface CommitRequest {
  diff: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
}

export interface CommitResponse {
  success: boolean;
  commitMessage: string;
  description: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AICommitResponse {
  success: boolean;
  commitMessage: string;
  description: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
}

export interface ApiError {
  error: string;
  message?: string;
}