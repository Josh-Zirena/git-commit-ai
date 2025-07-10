import { useState, useCallback, useEffect } from 'react';
import { Send, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../hooks/useTheme';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card variant="glass" className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="diff" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Git Diff
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  (Ctrl+Enter to submit)
                </span>
              </label>
              <div className="relative">
                <textarea
                  id="diff"
                  value={diff}
                  onChange={(e) => setDiff(e.target.value)}
                  placeholder="Paste your git diff here..."
                  className="w-full h-64 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm text-gray-900 dark:text-white transition-all duration-200"
                  required
                  disabled={isLoading}
                />
                {diff && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-2 right-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleReset}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !diff.trim()}
              isLoading={isLoading}
              className="w-full sm:w-auto"
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? 'Generating...' : 'Generate Commit Message'}
            </Button>
          </form>
        </Card>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <Card variant="elevated" className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-red-700 dark:text-red-300 font-medium">
                    {error}
                  </p>
                </div>
              </Card>
            </motion.div>
          )}

          {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6"
          >
            <Card variant="elevated" className="p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-300">
                  Generated Commit Message
                </h3>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="sm"
                  className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-700">
                  <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2">
                    Commit Message
                  </h4>
                  <SyntaxHighlighter
                    language="text"
                    style={isDark ? tomorrow : prism}
                    customStyle={{
                      margin: 0,
                      background: 'transparent',
                      padding: 0,
                      fontSize: '14px',
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                    }}
                  >
                    {result.commitMessage}
                  </SyntaxHighlighter>
                </div>
                
                {result.description && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      Description
                    </h4>
                    <p className="text-blue-700 dark:text-blue-300 text-sm leading-relaxed">
                      {result.description}
                    </p>
                  </div>
                )}

                {/* Generation Details */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                  <h4 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">
                    Generation Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Provider:</span>
                      <p className="text-purple-700 dark:text-purple-300 capitalize">{result.provider}</p>
                    </div>
                    <div>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Model:</span>
                      <p className="text-purple-700 dark:text-purple-300">{result.model}</p>
                    </div>
                    <div>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Total Tokens:</span>
                      <p className="text-purple-700 dark:text-purple-300">{result.usage.totalTokens}</p>
                    </div>
                    <div>
                      <span className="text-purple-600 dark:text-purple-400 font-medium">Input→Output:</span>
                      <p className="text-purple-700 dark:text-purple-300">
                        {result.usage.promptTokens}→{result.usage.completionTokens}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}