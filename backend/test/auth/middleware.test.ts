import { Request, Response, NextFunction } from "express";
import { authenticateToken, optionalAuth, requireEmailVerification } from "../../src/middleware/auth";
import { AuthenticatedRequest } from "../../src/types/auth";
import jwt from "jsonwebtoken";

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock jwks-rsa
jest.mock("jwks-rsa", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getSigningKey: jest.fn()
  }))
}));

describe("Authentication Middleware", () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe("authenticateToken", () => {
    it("should authenticate valid token successfully", async () => {
      const mockUser = {
        sub: "test-user-sub",
        email: "test@example.com",
        email_verified: true,
        "cognito:username": "testuser",
        given_name: "Test",
        family_name: "User",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        token_use: "access"
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token"
      };

      // Mock JWT verification to return the user
      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === "function") {
          callback(null, mockUser);
        }
      });

      await authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toEqual({
        sub: mockUser.sub,
        email: mockUser.email,
        emailVerified: mockUser.email_verified,
        username: mockUser["cognito:username"],
        firstName: mockUser.given_name,
        lastName: mockUser.family_name,
        iat: mockUser.iat,
        exp: mockUser.exp
      });
      expect(mockRequest.authToken).toBe("valid-token");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 401 for missing authorization header", async () => {
      await authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Access token is required",
        success: false
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid token format", async () => {
      mockRequest.headers = {
        authorization: "Invalid token-format"
      };

      await authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Access token is required",
        success: false
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", async () => {
      const mockUser = {
        sub: "test-user-sub",
        email: "test@example.com",
        email_verified: true,
        "cognito:username": "testuser",
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
        token_use: "access"
      };

      mockRequest.headers = {
        authorization: "Bearer expired-token"
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === "function") {
          callback(null, mockUser);
        }
      });

      await authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Token expired",
        success: false
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 401 for non-access token", async () => {
      const mockUser = {
        sub: "test-user-sub",
        email: "test@example.com",
        email_verified: true,
        "cognito:username": "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        token_use: "id" // Not an access token
      };

      mockRequest.headers = {
        authorization: "Bearer id-token"
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === "function") {
          callback(null, mockUser);
        }
      });

      await authenticateToken(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Invalid token type",
        success: false
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("optionalAuth", () => {
    it("should continue without authentication when no token provided", async () => {
      await optionalAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should add user info when valid token provided", async () => {
      const mockUser = {
        sub: "test-user-sub",
        email: "test@example.com",
        email_verified: true,
        "cognito:username": "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        token_use: "access"
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token"
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === "function") {
          callback(null, mockUser);
        }
      });

      await optionalAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should continue without authentication when token is invalid", async () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token"
      };

      mockJwt.verify.mockImplementation((token, getKey, options, callback) => {
        if (typeof callback === "function") {
          const error = new Error("Invalid token") as any;
          callback(error, undefined);
        }
      });

      await optionalAuth(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe("requireEmailVerification", () => {
    it("should continue for verified user", () => {
      mockRequest.user = {
        sub: "test-user-sub",
        email: "test@example.com",
        emailVerified: true,
        username: "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      requireEmailVerification(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 401 for unauthenticated user", () => {
      requireEmailVerification(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Authentication required",
        success: false
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should return 403 for unverified user", () => {
      mockRequest.user = {
        sub: "test-user-sub",
        email: "test@example.com",
        emailVerified: false,
        username: "testuser",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      requireEmailVerification(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: "Email verification required",
        success: false,
        code: "EMAIL_NOT_VERIFIED"
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});