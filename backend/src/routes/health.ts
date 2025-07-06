import { Router, Request, Response } from "express";

const router = Router();

interface HealthCheckResult {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
  version: string;
  dependencies: {
    openai: {
      status: "healthy" | "unhealthy";
      message?: string;
    };
  };
}

const checkOpenAIHealth = async (): Promise<{ status: "healthy" | "unhealthy"; message?: string }> => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { status: "unhealthy", message: "OpenAI API key not configured" };
    }
    
    // Basic check - just verify the API key format
    if (!apiKey.startsWith("sk-")) {
      return { status: "unhealthy", message: "Invalid OpenAI API key format" };
    }
    
    return { status: "healthy" };
  } catch (error) {
    return { status: "unhealthy", message: "OpenAI health check failed" };
  }
};

router.get("/", async (req: Request, res: Response) => {
  try {
    const openaiHealth = await checkOpenAIHealth();
    
    const healthResult: HealthCheckResult = {
      status: openaiHealth.status === "healthy" ? "healthy" : "unhealthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      dependencies: {
        openai: openaiHealth
      }
    };

    const statusCode = healthResult.status === "healthy" ? 200 : 503;
    res.status(statusCode).json(healthResult);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(503).json({
      status: "unhealthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      error: "Health check failed"
    });
  }
});

export default router;