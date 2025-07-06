import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateCommitMessage } from '../services/api';
import type { CommitRequest, CommitResponse } from '../types';
import toast from 'react-hot-toast';

export function useCommitGeneration() {
  const queryClient = useQueryClient();

  const mutation = useMutation<CommitResponse, Error, CommitRequest>({
    mutationFn: generateCommitMessage,
    onSuccess: (data) => {
      toast.success('Commit message generated successfully!');
      
      // Cache the result for potential reuse
      queryClient.setQueryData(['commit', data.commitMessage], data);
    },
    onError: (error) => {
      console.error('Commit generation error:', error);
      toast.error(error.message || 'Failed to generate commit message');
    },
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors
      if (failureCount < 2 && error.message.includes('Network')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    generateCommit: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}