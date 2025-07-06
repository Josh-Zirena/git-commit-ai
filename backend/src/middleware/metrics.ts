import { Request, Response, NextFunction, Router } from "express";
import { performance } from "perf_hooks";

export interface AppMetrics {
  uptime: number;
  timestamp: string;
  requests: {
    total: number;
    success: number;
    errors: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
    byEndpoint: Record<string, number>;
  };
  performance: {
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuUsage: NodeJS.CpuUsage;
  };
}

class MetricsCollector {
  private metrics: AppMetrics;
  private responseTimes: number[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      uptime: 0,
      timestamp: "",
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byStatus: {},
        byMethod: {},
        byEndpoint: {}
      },
      performance: {
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: 0
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuUsage: process.cpuUsage()
      }
    };
  }

  recordRequest(req: Request, res: Response, responseTime: number): void {
    const endpoint = this.normalizeEndpoint(req.route?.path || req.path);
    
    // Update request counts
    this.metrics.requests.total++;
    this.metrics.requests.byMethod[req.method] = (this.metrics.requests.byMethod[req.method] || 0) + 1;
    this.metrics.requests.byStatus[res.statusCode.toString()] = (this.metrics.requests.byStatus[res.statusCode.toString()] || 0) + 1;
    this.metrics.requests.byEndpoint[endpoint] = (this.metrics.requests.byEndpoint[endpoint] || 0) + 1;
    
    // Update success/error counts
    if (res.statusCode >= 200 && res.statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
    
    // Update response time metrics
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times to prevent memory issues
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    this.updatePerformanceMetrics();
  }

  private normalizeEndpoint(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/\d+/g, "/:id")
      .replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "/:uuid")
      .replace(/\/[a-zA-Z0-9_-]{10,}/g, "/:token");
  }

  private updatePerformanceMetrics(): void {
    if (this.responseTimes.length === 0) return;
    
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    this.metrics.performance.averageResponseTime = sum / this.responseTimes.length;
    this.metrics.performance.maxResponseTime = Math.max(...this.responseTimes);
    this.metrics.performance.minResponseTime = Math.min(...this.responseTimes);
  }

  private updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memory.used = memUsage.heapUsed;
    this.metrics.memory.total = memUsage.heapTotal;
    this.metrics.memory.percentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    this.metrics.system.cpuUsage = process.cpuUsage();
    this.metrics.uptime = process.uptime();
    this.metrics.timestamp = new Date().toISOString();
  }

  getMetrics(): AppMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics.requests = {
      total: 0,
      success: 0,
      errors: 0,
      byStatus: {},
      byMethod: {},
      byEndpoint: {}
    };
    this.responseTimes = [];
    this.updatePerformanceMetrics();
  }
}

export const metricsCollector = new MetricsCollector();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = performance.now();
  
  const originalSend = res.send;
  res.send = function(body) {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    metricsCollector.recordRequest(req, res, responseTime);
    
    return originalSend.call(this, body);
  };
  
  next();
};

export const createMetricsRouter = (): Router => {
  const router = Router();
  
  router.get("/", (req: Request, res: Response) => {
    try {
      const metrics = metricsCollector.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error getting metrics:", error);
      res.status(500).json({
        error: "Failed to retrieve metrics",
        success: false
      });
    }
  });
  
  router.post("/reset", (req: Request, res: Response) => {
    try {
      metricsCollector.reset();
      res.json({
        success: true,
        message: "Metrics reset successfully"
      });
    } catch (error) {
      console.error("Error resetting metrics:", error);
      res.status(500).json({
        error: "Failed to reset metrics",
        success: false
      });
    }
  });
  
  return router;
};

export default metricsMiddleware;