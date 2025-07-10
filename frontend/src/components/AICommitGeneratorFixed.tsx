import { useState, useCallback, useEffect } from 'react';
import { Send, Copy, Check, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../hooks/useTheme';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { LoadingSpinner } from './LoadingSpinner';
import { useClipboard } from '../hooks/useClipboard';
import type { AICommitResponse } from '../types';
import toast from 'react-hot-toast';

interface AICommitGeneratorFixedProps {
  provider?: 'openai' | 'anthropic';
  model?: string;
}

export default function AICommitGeneratorFixed({ 
  provider = 'openai', 
  model 
}: AICommitGeneratorFixedProps) {
  const [diff, setDiff] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AICommitResponse | null>(null);
  const { copy, copied } = useClipboard();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const generateCommit = useCallback(async () => {
    if (!diff.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/generate-commit-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diff: diff.trim(),
          provider,
          model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: AICommitResponse = await response.json();
      setResult(data);
      toast.success('Commit message generated successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate commit message';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [diff, provider, model, isLoading]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    generateCommit();
  }, [generateCommit]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generateCommit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [generateCommit]);

  const handleCopy = () => {
    if (result?.commitMessage) {
      copy(result.commitMessage);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setDiff('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <div className="flex items-center justify-center gap-2">
          <Zap className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI SDK Commit Generator
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Multi-provider AI-powered commit message generation • Provider: <span className="font-semibold text-purple-600 dark:text-purple-400">{provider}</span>
          {model && <span> • Model: <span className="font-semibold">{model}</span></span>}
        </p>
      </motion.div>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="diff" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Git Diff
              </label>
              <textarea
                id="diff"
                value={diff}
                onChange={(e) => setDiff(e.target.value)}
                placeholder="Paste your git diff here..."
                className="w-full h-64 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                disabled={isLoading}
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Tip: Use Ctrl+Enter (Cmd+Enter on Mac) to generate
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={!diff.trim() || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Generate Commit Message
                  </>
                )}
              </Button>
              
              {(result || error) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="px-4"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </form>
        </Card>
      </motion.div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-200">
                    Generation Failed
                  </h3>
                  <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                    {error}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {/* Commit Message */}
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    Generated Commit Message
                  </h3>
                  <SyntaxHighlighter
                    language="bash"
                    style={isDark ? tomorrow : prism}
                    customStyle={{
                      background: 'transparent',
                      padding: '12px 0',
                      margin: 0,
                      fontSize: '14px',
                    }}
                  >
                    {result.commitMessage}
                  </SyntaxHighlighter>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {/* Description */}
            {result.description && (
              <Card>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {result.description}
                </p>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                Generation Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Provider:</span>
                  <p className="font-medium capitalize">{result.provider}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Model:</span>
                  <p className="font-medium">{result.model}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Tokens Used:</span>
                  <p className="font-medium">{result.usage.totalTokens}</p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                  <p className="font-medium">
                    {result.usage.promptTokens}→{result.usage.completionTokens}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}