import { Heart } from "lucide-react";
import { siGithub } from "simple-icons";
import { motion } from "framer-motion";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
          <span className="text-sm">© {currentYear} Created with</span>
          <Heart className="w-4 h-4 text-red-500" />
          <span className="text-sm">by</span>
          <a
            href="https://github.com/Josh-Zirena"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 font-medium"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d={siGithub.path} />
            </svg>
            Josh Zirena
          </a>
        </div>
      </div>
    </motion.footer>
  );
}
