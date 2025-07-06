import axios from 'axios';
import type { CommitRequest, CommitResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export const generateCommitMessage = async (request: CommitRequest): Promise<CommitResponse> => {
  try {
    const response = await api.post<CommitResponse>('/generate-commit', request);
    
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.error || 'Failed to generate commit message');
    }
    throw error;
  }
};

export default api;