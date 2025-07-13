import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createOpenAIService } from "./services/openai";
import { createEnhancedOpenAIService } from "./services/enhancedOpenAI";
import { createAISDKService } from "./services/aiSdkService";
import { validateGitDiff } from "./utils/validation";
import { requestIdMiddleware, loggingMiddleware, logger } from "./middleware/logging";
import { securityMiddleware } from "./middleware/security";
import { metricsMiddleware, createMetricsRouter } from "./middleware/metrics";
import { setupGracefulShutdown } from "./utils/graceful-shutdown";
import healthRouter from "./routes/health";
import { createLoggingSetup } from "./config/logging";
import { validateCognitoConfig } from "./config/cognito";

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize logging setup
createLoggingSetup();

// Security middleware - must be first
app.use(securityMiddleware());

// Request ID and logging middleware
app.use(requestIdMiddleware);
app.use(loggingMiddleware);

// Metrics middleware
app.use(metricsMiddleware);

// CORS configuration for cross-origin requests from frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    'http://localhost:5173', 
    'http://localhost:3000',
    /^https:\/\/.*\.cloudfront\.net$/,  // Allow CloudFront domains
    /^https:\/\/.*\.amazonaws\.com$/    // Allow S3 direct access during development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' })); // Increased for large diff support

// Rate limiting - 10 requests per minute (higher limit for testing)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 1000 : 10, // Much higher limit for testing
  message: {
    error: "Too many requests from this IP, please try again later.",
    success: false
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use("/api/", limiter);

// Routes
app.use("/health", healthRouter);
app.use("/metrics", createMetricsRouter());

// Root endpoint for basic health check (fallback)
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    service: "git-commit-ai",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Conditionally enable auth routes only if Cognito is configured
if (validateCognitoConfig()) {
  logger.info("Cognito configuration found, enabling auth routes", "system");
  import("./routes/auth").then(({ default: authRouter }) => {
    app.use("/auth", authRouter);
  });
} else {
  logger.warn("Cognito configuration not found, auth routes disabled", "system");
}

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
    req.logger.error("Error generating commit message", req.requestId, error);

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
    req.logger.error("Error generating commit message (enhanced)", req.requestId, error);

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

// AI SDK endpoint with multi-provider support
app.post("/api/generate-commit-ai", async (req: Request, res: Response) => {
  try {
    const { diff, provider = 'openai', model } = req.body;

    // Basic input validation
    if (!diff) {
      res.status(400).json({ 
        error: "Git diff is required",
        success: false
      });
      return;
    }

    // Validate provider
    if (!['openai', 'anthropic'].includes(provider)) {
      res.status(400).json({
        error: "Invalid provider. Supported providers: openai, anthropic",
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

    // Generate commit message using AI SDK
    const aiService = createAISDKService({
      provider,
      model,
    });
    
    const result = await aiService.generateCommitMessage(diff);

    res.json({
      success: true,
      commitMessage: result.commitMessage,
      description: result.description,
      usage: result.usage,
      provider: aiService.getCurrentProvider(),
      model: aiService.getCurrentModel(),
    });
  } catch (error) {
    req.logger.error("Error generating commit message (AI SDK)", req.requestId, error);

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes("API key")) {
        res.status(401).json({
          error: "AI provider API key is not configured or invalid",
          success: false,
        });
      } else if (error.message.includes("rate limit")) {
        res.status(429).json({
          error: "AI provider API rate limit exceeded",
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

// 404 handler for non-existent API routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "API endpoint not found",
    success: false
  });
});

// Global error handler
app.use((error: any, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.requestId || "unknown";
  logger.error("Unhandled error", requestId, error);
  
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
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, "system");
  logger.info(`Health check available at http://localhost:${PORT}/health`, "system");
  logger.info(`Metrics available at http://localhost:${PORT}/metrics`, "system");
  logger.info(`API endpoint available at http://localhost:${PORT}/api/generate-commit`, "system");
});

// Setup graceful shutdown
setupGracefulShutdown(server, {
  timeout: 30000,
  onShutdown: async () => {
    logger.info("Performing cleanup tasks before shutdown", "system");
    // Add any cleanup tasks here
  }
});

export default app;