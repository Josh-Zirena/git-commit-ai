import { Request, Response, NextFunction } from "express";

export interface SecurityConfig {
  contentTypeOptions: boolean;
  frameOptions: string | boolean;
  xssProtection: boolean;
  referrerPolicy: string;
  contentSecurityPolicy: string | boolean;
  hsts: boolean | { maxAge: number; includeSubDomains: boolean; preload: boolean };
}

const defaultConfig: SecurityConfig = {
  contentTypeOptions: true,
  frameOptions: "DENY",
  xssProtection: true,
  referrerPolicy: "strict-origin-when-cross-origin",
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
  hsts: process.env.NODE_ENV === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
};

export const securityMiddleware = (config: Partial<SecurityConfig> = {}) => {
  const finalConfig: SecurityConfig = { ...defaultConfig, ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // X-Content-Type-Options
    if (finalConfig.contentTypeOptions) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }

    // X-Frame-Options
    if (finalConfig.frameOptions) {
      const frameValue = typeof finalConfig.frameOptions === "string" ? finalConfig.frameOptions : "DENY";
      res.setHeader("X-Frame-Options", frameValue);
    }

    // X-XSS-Protection
    if (finalConfig.xssProtection) {
      res.setHeader("X-XSS-Protection", "1; mode=block");
    }

    // Referrer-Policy
    if (finalConfig.referrerPolicy) {
      res.setHeader("Referrer-Policy", finalConfig.referrerPolicy);
    }

    // Content-Security-Policy
    if (finalConfig.contentSecurityPolicy) {
      const cspValue = typeof finalConfig.contentSecurityPolicy === "string" 
        ? finalConfig.contentSecurityPolicy 
        : defaultConfig.contentSecurityPolicy;
      res.setHeader("Content-Security-Policy", cspValue as string);
    }

    // Strict-Transport-Security (HSTS)
    if (finalConfig.hsts && typeof finalConfig.hsts === "object") {
      const { maxAge, includeSubDomains, preload } = finalConfig.hsts;
      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += "; includeSubDomains";
      if (preload) hstsValue += "; preload";
      res.setHeader("Strict-Transport-Security", hstsValue);
    }

    // Remove potentially revealing headers
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");

    next();
  };
};

export default securityMiddleware;