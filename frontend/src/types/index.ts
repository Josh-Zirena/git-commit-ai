export interface CommitRequest {
  diff: string;
}

export interface CommitResponse {
  success: boolean;
  commitMessage: string;
  description: string;
  usage?: any;
}

export interface ApiError {
  error: string;
  message?: string;
}