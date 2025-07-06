import { Server } from "http";
import logger from "../middleware/logging";

export interface GracefulShutdownConfig {
  timeout: number; // milliseconds
  signals: string[];
  onShutdown?: () => Promise<void>;
}

const defaultConfig: GracefulShutdownConfig = {
  timeout: 30000, // 30 seconds
  signals: ["SIGTERM", "SIGINT"],
  onShutdown: undefined
};

export class GracefulShutdown {
  private server: Server;
  private config: GracefulShutdownConfig;
  private isShuttingDown = false;
  private connections = new Set<any>();

  constructor(server: Server, config: Partial<GracefulShutdownConfig> = {}) {
    this.server = server;
    this.config = { ...defaultConfig, ...config };
    this.setupSignalHandlers();
    this.trackConnections();
  }

  private setupSignalHandlers(): void {
    this.config.signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, starting graceful shutdown`, "system");
        this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", "system", error);
      this.shutdown();
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at Promise", "system", { reason, promise });
      this.shutdown();
    });
  }

  private trackConnections(): void {
    this.server.on("connection", (connection) => {
      this.connections.add(connection);
      
      connection.on("close", () => {
        this.connections.delete(connection);
      });
    });
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn("Shutdown already in progress", "system");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Starting graceful shutdown", "system");

    // Set a timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout reached, forcing exit", "system");
      process.exit(1);
    }, this.config.timeout);

    try {
      // Call custom shutdown hook if provided
      if (this.config.onShutdown) {
        logger.info("Executing custom shutdown hook", "system");
        await this.config.onShutdown();
      }

      // Stop accepting new connections
      this.server.close(() => {
        logger.info("HTTP server closed", "system");
      });

      // Close existing connections
      logger.info(`Closing ${this.connections.size} active connections`, "system");
      for (const connection of this.connections) {
        connection.destroy();
      }

      // Wait for server to close
      await new Promise<void>((resolve) => {
        this.server.on("close", resolve);
      });

      clearTimeout(forceShutdownTimer);
      logger.info("Graceful shutdown completed", "system");
      process.exit(0);
    } catch (error) {
      clearTimeout(forceShutdownTimer);
      logger.error("Error during graceful shutdown", "system", error);
      process.exit(1);
    }
  }

  public async forceShutdown(): Promise<void> {
    logger.warn("Force shutdown requested", "system");
    await this.shutdown();
  }
}

export const setupGracefulShutdown = (server: Server, config?: Partial<GracefulShutdownConfig>): GracefulShutdown => {
  return new GracefulShutdown(server, config);
};

export default GracefulShutdown;