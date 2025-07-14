import axios from 'axios';
import type { CommitRequest, CommitResponse, AICommitResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const generateCommitMessage = async (request: CommitRequest): Promise<CommitResponse> => {
  try {
    const response = await api.post<CommitResponse>('/lambda/generate-commit', request);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error || 'Failed to generate commit message');
    }
    throw error;
  }
};

// Enhanced API for AI SDK with provider/model support
export const generateCommitMessageAI = async (request: CommitRequest): Promise<AICommitResponse> => {
  try {
    const response = await api.post<AICommitResponse>('/lambda/generate-commit', request);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error || 'Failed to generate commit message');
    }
    throw error;
  }
};

export default api;