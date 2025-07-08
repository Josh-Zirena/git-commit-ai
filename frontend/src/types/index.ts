export interface CommitRequest {
  diff: string;
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

export interface ApiError {
  error: string;
  message?: string;
}