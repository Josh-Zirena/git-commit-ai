import request from "supertest";
import express from "express";
import authRouter from "../../src/routes/auth";
import { cognitoClient } from "../../src/utils/cognito-client";

// Mock the Cognito client completely
jest.mock("../../src/utils/cognito-client", () => ({
  cognitoClient: {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn()
  }
}));

const mockCognitoClient = cognitoClient as jest.Mocked<typeof cognitoClient>;

describe("Authentication Routes (Unit)", () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a minimal Express app for testing
    app = express();
    app.use(express.json());
    app.use("/auth", authRouter);
    jest.clearAllMocks();
  });

  describe("POST /auth/register", () => {
    it("should register a new user successfully", async () => {
      const mockResult = {
        userSub: "test-user-sub",
        codeDeliveryDetails: {
          DeliveryMedium: "EMAIL",
          Destination: "test@example.com"
        }
      };

      mockCognitoClient.register.mockResolvedValue(mockResult);

      const userData = {
        email: "test@example.com",
        password: "TestPassword123!",
        firstName: "Test",
        lastName: "User"
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.userSub).toBe("test-user-sub");
      expect(mockCognitoClient.register).toHaveBeenCalledWith(userData);
    });

    it("should return 400 for missing email", async () => {
      const userData = {
        password: "TestPassword123!"
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Email and password are required");
    });

    it("should return 400 for invalid email format", async () => {
      const userData = {
        email: "invalid-email",
        password: "TestPassword123!"
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Invalid email format");
    });

    it("should return 400 for short password", async () => {
      const userData = {
        email: "test@example.com",
        password: "short"
      };

      const response = await request(app)
        .post("/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Password must be at least 8 characters long");
    });
  });

  describe("POST /auth/verify", () => {
    it("should verify email successfully", async () => {
      mockCognitoClient.verifyEmail.mockResolvedValue();

      const verificationData = {
        email: "test@example.com",
        code: "123456"
      };

      const response = await request(app)
        .post("/auth/verify")
        .send(verificationData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe("Email verified successfully. You can now log in.");
      expect(mockCognitoClient.verifyEmail).toHaveBeenCalledWith(verificationData);
    });

    it("should return 400 for missing verification code", async () => {
      const verificationData = {
        email: "test@example.com"
      };

      const response = await request(app)
        .post("/auth/verify")
        .send(verificationData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Email and verification code are required");
    });
  });

  describe("POST /auth/login", () => {
    it("should login successfully and return tokens", async () => {
      const mockTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        idToken: "mock-id-token",
        expiresIn: 3600,
        tokenType: "Bearer" as const
      };

      mockCognitoClient.login.mockResolvedValue(mockTokens);

      const credentials = {
        email: "test@example.com",
        password: "TestPassword123!"
      };

      const response = await request(app)
        .post("/auth/login")
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tokens).toEqual(mockTokens);
      expect(mockCognitoClient.login).toHaveBeenCalledWith(credentials);
    });

    it("should return 400 for missing credentials", async () => {
      const credentials = {
        email: "test@example.com"
      };

      const response = await request(app)
        .post("/auth/login")
        .send(credentials);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Email and password are required");
    });
  });

  describe("POST /auth/refresh", () => {
    it("should refresh tokens successfully", async () => {
      const mockTokens = {
        accessToken: "new-access-token",
        refreshToken: "same-refresh-token",
        idToken: "new-id-token",
        expiresIn: 3600,
        tokenType: "Bearer" as const
      };

      mockCognitoClient.refreshToken.mockResolvedValue(mockTokens);

      const refreshData = {
        refreshToken: "existing-refresh-token"
      };

      const response = await request(app)
        .post("/auth/refresh")
        .send(refreshData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.tokens).toEqual(mockTokens);
      expect(mockCognitoClient.refreshToken).toHaveBeenCalledWith(refreshData);
    });

    it("should return 400 for missing refresh token", async () => {
      const response = await request(app)
        .post("/auth/refresh")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("Refresh token is required");
    });
  });
});