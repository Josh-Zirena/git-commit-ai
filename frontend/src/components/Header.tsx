import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import aiIcon from '../assets/ai-icon.svg';

export default function Header() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  const getThemeIcon = () => {
    return theme === 'light' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />;
  };

  const getThemeLabel = () => {
    return theme === 'light' ? 'Light mode (click for dark)' : 'Dark mode (click for light)';
  };

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm shadow-lg border-b border-gray-200 dark:border-gray-700"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10">
              <img src={aiIcon} alt="AI Neural Network" className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI Git Commit Generator
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                AI-powered commit message generation
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label={getThemeLabel()}
              type="button"
              title={getThemeLabel()}
            >
              {getThemeIcon()}
            </button>
          </div>
        </div>
      </div>
    </motion.header>
  );
}