import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import Header from './components/Header';
import CommitGenerator from './components/CommitGenerator';
import AICommitGeneratorFixed from './components/AICommitGeneratorFixed';
import Footer from './components/Footer';
import { ThemeProvider } from './components/ThemeProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppContent() {
  const { theme } = useTheme();
  const [useAISDK, setUseAISDK] = useState(false);
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header />
      
      {/* Mode Switcher */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-center gap-4 p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Mode:
            </label>
            <select
              value={useAISDK ? 'ai-sdk' : 'original'}
              onChange={(e) => setUseAISDK(e.target.value === 'ai-sdk')}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="original">Original (OpenAI Direct)</option>
              <option value="ai-sdk">AI SDK (Multi-Provider)</option>
            </select>
          </div>
          
          {useAISDK && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Provider:
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as 'openai' | 'anthropic')}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <main className="flex-1">
        {useAISDK ? (
          <AICommitGeneratorFixed provider={provider} />
        ) : (
          <CommitGenerator />
        )}
      </main>
      
      <Footer />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: isDark ? '#374151' : '#ffffff',
            color: isDark ? '#f9fafb' : '#111827',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;