import { useState, useCallback } from 'react';
import { Send, Copy, Check, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { tomorrow, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useChat } from '@ai-sdk/react';
import { useTheme } from '../hooks/useTheme';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { LoadingSpinner } from './LoadingSpinner';
import { useClipboard } from '../hooks/useClipboard';

interface AICommitGeneratorProps {
  provider?: 'openai' | 'anthropic';
  model?: string;
}

export default function AICommitGenerator({ 
  provider = 'openai', 
  model 
}: AICommitGeneratorProps) {
  const [diff, setDiff] = useState('');
  const { copy, copied } = useClipboard();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { messages, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/lambda/generate-commit',
    body: {
      provider,
      model,
    },
    initialMessages: [],
  });

  // Get the latest assistant message (commit result)
  const latestCommit = messages.find(m => m.role === 'assistant')?.content;
  
  // Parse the commit message from the AI response
  const parseCommitMessage = (content: string) => {
    const lines = content.split('\n');
    let commitMessage = '';
    let description = '';

    for (const line of lines) {
      if (line.startsWith('COMMIT:')) {
        commitMessage = line.replace('COMMIT:', '').trim();
      } else if (line.startsWith('DESCRIPTION:')) {
        description = line.replace('DESCRIPTION:', '').trim();
      }
    }

    if (!commitMessage && !description) {
      const allLines = content.split('\n');
      commitMessage = allLines[0] || '';
      description = allLines.slice(1).join('\n').trim();
    }

    return { commitMessage, description };
  };

  const handleGenerate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!diff.trim() || isLoading) return;

    // Format the diff as a message for the AI SDK
    const prompt = `Analyze this git diff and generate a conventional commit message:\n\n${diff.trim()}`;
    
    // Clear previous messages and send new request
    setMessages([]);
    handleSubmit(e, {
      data: { content: prompt }
    });
  }, [diff, isLoading, handleSubmit, setMessages]);

  const handleCopy = () => {
    if (latestCommit) {
      const { commitMessage } = parseCommitMessage(latestCommit);
      if (commitMessage) {
        copy(commitMessage);
      }
    }
  };

  const handleReset = () => {
    setMessages([]);
    setDiff('');
  };

  const commitData = latestCommit ? parseCommitMessage(latestCommit) : null;

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
          <form onSubmit={handleGenerate} className="space-y-4">
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
              
              {(commitData || error) && (
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
                    {error.message}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      <AnimatePresence>
        {commitData && (
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
                    {commitData.commitMessage}
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
            {commitData.description && (
              <Card>
                <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {commitData.description}
                </p>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}