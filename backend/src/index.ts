import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createOpenAIService } from "./services/openai";
import { createEnhancedOpenAIService } from "./services/enhancedOpenAI";
import { validateGitDiff } from "./utils/validation";

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - User-Agent: ${userAgent}`);
  
  // Log response status code after response is sent
  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[${timestamp}] ${method} ${url} - Status: ${res.statusCode}`);
    return originalSend.call(this, body);
  };
  
  next();
};

// Middleware
app.use(requestLogger);
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased for large diff support

// Rate limiting - 10 requests per minute (higher limit for testing)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 50 : 10, // Higher limit for testing
  message: {
    error: "Too many requests from this IP, please try again later.",
    success: false
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use("/api/", limiter);

// Serve static files from public directory
app.use(express.static("public"));

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Generate commit message endpoint
app.post("/api/generate-commit", async (req: Request, res: Response) => {
  try {
    const { diff } = req.body;

    // Basic input validation
    if (!diff) {
      res.status(400).json({ 
        error: "Git diff is required",
        success: false
      });
      return;
    }

    // Validate git diff format and content
    const validationResult = validateGitDiff(diff);
    if (!validationResult.isValid) {
      res.status(400).json({
        error: "Invalid git diff format",
        details: validationResult.errors,
        success: false
      });
      return;
    }

    // Generate commit message using OpenAI
    const openaiService = createOpenAIService();
    const result = await openaiService.generateCommitMessage(diff);

    res.json({
      success: true,
      commitMessage: result.commitMessage,
      description: result.description,
      usage: result.usage,
    });
  } catch (error) {
    console.error("Error generating commit message:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("API key")) {
        res.status(401).json({
          error: "OpenAI API key is not configured or invalid",
          success: false,
        });
      } else if (error.message.includes("rate limit")) {
        res.status(429).json({
          error: "OpenAI API rate limit exceeded",
          success: false,
        });
      } else {
        res.status(500).json({
          error: error.message,
          success: false,
        });
      }
    } else {
      res.status(500).json({
        error: "An unknown error occurred",
        success: false,
      });
    }
  }
});

// Enhanced generate commit message endpoint for large diffs
app.post("/api/generate-commit-enhanced", async (req: Request, res: Response) => {
  try {
    const { diff } = req.body;

    // Basic input validation
    if (!diff) {
      res.status(400).json({ 
        error: "Git diff is required",
        success: false
      });
      return;
    }

    // Generate commit message using Enhanced OpenAI service
    const enhancedService = createEnhancedOpenAIService({
      enableSummarization: true,
      maxDirectSize: 50 * 1024, // 50KB
      maxTotalSize: 300 * 1024,  // 300KB after processing
    });
    
    const result = await enhancedService.generateCommitMessage(diff);

    res.json({
      success: true,
      commitMessage: result.commitMessage,
      description: result.description,
      summary: result.summary,
      usage: result.usage,
      processingInfo: result.processingInfo,
    });
  } catch (error) {
    console.error("Error generating commit message:", error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("API key")) {
        res.status(401).json({
          error: "OpenAI API key is not configured or invalid",
          success: false,
        });
      } else if (error.message.includes("rate limit")) {
        res.status(429).json({
          error: "OpenAI API rate limit exceeded",
          success: false,
        });
      } else if (error.message.includes("too large")) {
        res.status(413).json({
          error: "Git diff is too large to process. Please split into smaller commits.",
          success: false,
        });
      } else if (error.message.includes("context_length_exceeded")) {
        res.status(413).json({
          error: "Git diff exceeds AI model context limits. Please split into smaller commits.",
          success: false,
        });
      } else {
        res.status(500).json({
          error: error.message,
          success: false,
        });
      }
    } else {
      res.status(500).json({
        error: "An unknown error occurred",
        success: false,
      });
    }
  }
});

// 404 handler for non-existent routes
app.use((_req: Request, res: Response) => {
  if (_req.path.startsWith('/api/')) {
    res.status(404).json({
      error: "API endpoint not found",
      success: false
    });
  } else {
    res.status(404).send('Page not found');
  }
});

// Global error handler
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", error);
  
  if (error.type === 'entity.too.large' || error.message === 'request entity too large') {
    res.status(413).json({
      error: "Request payload too large (max 10MB). Consider using smaller diffs or the enhanced endpoint.",
      success: false
    });
  } else {
    res.status(500).json({
      error: "Internal server error",
      success: false
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`API endpoint available at http://localhost:${PORT}/api/generate-commit`);
});

export default app;