import { CognitoClient } from "../../src/utils/cognito-client";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthError } from "../../src/types/auth";

// Mock AWS SDK
jest.mock("@aws-sdk/client-cognito-identity-provider");

const mockCognitoClient = {
  send: jest.fn()
};

(CognitoIdentityProviderClient as jest.Mock).mockImplementation(() => mockCognitoClient);

// Mock environment variables
process.env.COGNITO_USER_POOL_ID = "test-pool-id";
process.env.COGNITO_CLIENT_ID = "test-client-id";
process.env.COGNITO_CLIENT_SECRET = "test-client-secret";
process.env.AWS_REGION = "us-east-1";

describe("CognitoClient", () => {
  let cognitoClient: CognitoClient;

  beforeEach(() => {
    cognitoClient = new CognitoClient();
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should register user successfully", async () => {
      const mockResponse = {
        UserSub: "test-user-sub",
        CodeDeliveryDetails: {
          DeliveryMedium: "EMAIL",
          Destination: "test@example.com"
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse);

      const userData = {
        email: "test@example.com",
        password: "TestPassword123!",
        firstName: "Test",
        lastName: "User"
      };

      const result = await cognitoClient.register(userData);

      expect(result.userSub).toBe("test-user-sub");
      expect(result.codeDeliveryDetails).toEqual(mockResponse.CodeDeliveryDetails);
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(SignUpCommand));
    });

    it("should handle registration errors", async () => {
      const mockError = {
        name: "UsernameExistsException",
        message: "User already exists"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      const userData = {
        email: "existing@example.com",
        password: "TestPassword123!"
      };

      await expect(cognitoClient.register(userData)).rejects.toThrow(AuthError);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      mockCognitoClient.send.mockResolvedValue({});

      const verificationData = {
        email: "test@example.com",
        code: "123456"
      };

      await expect(cognitoClient.verifyEmail(verificationData)).resolves.toBeUndefined();
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(ConfirmSignUpCommand));
    });

    it("should handle verification errors", async () => {
      const mockError = {
        name: "CodeMismatchException",
        message: "Invalid verification code"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      const verificationData = {
        email: "test@example.com",
        code: "wrong-code"
      };

      await expect(cognitoClient.verifyEmail(verificationData)).rejects.toThrow(AuthError);
    });
  });

  describe("login", () => {
    it("should login successfully and return tokens", async () => {
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: "access-token",
          RefreshToken: "refresh-token",
          IdToken: "id-token",
          ExpiresIn: 3600
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse);

      const credentials = {
        email: "test@example.com",
        password: "TestPassword123!"
      };

      const result = await cognitoClient.login(credentials);

      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
      expect(result.idToken).toBe("id-token");
      expect(result.expiresIn).toBe(3600);
      expect(result.tokenType).toBe("Bearer");
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(InitiateAuthCommand));
    });

    it("should handle login errors", async () => {
      const mockError = {
        name: "NotAuthorizedException",
        message: "Incorrect username or password"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      const credentials = {
        email: "test@example.com",
        password: "wrong-password"
      };

      await expect(cognitoClient.login(credentials)).rejects.toThrow(AuthError);
    });

    it("should handle missing authentication result", async () => {
      const mockResponse = {}; // No AuthenticationResult

      mockCognitoClient.send.mockResolvedValue(mockResponse);

      const credentials = {
        email: "test@example.com",
        password: "TestPassword123!"
      };

      await expect(cognitoClient.login(credentials)).rejects.toThrow(AuthError);
    });
  });

  describe("refreshToken", () => {
    it("should refresh tokens successfully", async () => {
      const mockResponse = {
        AuthenticationResult: {
          AccessToken: "new-access-token",
          IdToken: "new-id-token",
          ExpiresIn: 3600
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse);

      const refreshData = {
        refreshToken: "existing-refresh-token"
      };

      const result = await cognitoClient.refreshToken(refreshData);

      expect(result.accessToken).toBe("new-access-token");
      expect(result.refreshToken).toBe("existing-refresh-token"); // Should stay the same
      expect(result.idToken).toBe("new-id-token");
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(InitiateAuthCommand));
    });

    it("should handle refresh token errors", async () => {
      const mockError = {
        name: "NotAuthorizedException",
        message: "Refresh token is not valid"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      const refreshData = {
        refreshToken: "invalid-refresh-token"
      };

      await expect(cognitoClient.refreshToken(refreshData)).rejects.toThrow(AuthError);
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      mockCognitoClient.send.mockResolvedValue({});

      await expect(cognitoClient.logout("access-token")).resolves.toBeUndefined();
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(GlobalSignOutCommand));
    });

    it("should handle logout errors", async () => {
      const mockError = {
        name: "NotAuthorizedException",
        message: "Access token is not valid"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      await expect(cognitoClient.logout("invalid-token")).rejects.toThrow(AuthError);
    });
  });

  describe("forgotPassword", () => {
    it("should send password reset code successfully", async () => {
      const mockResponse = {
        CodeDeliveryDetails: {
          DeliveryMedium: "EMAIL",
          Destination: "test@example.com"
        }
      };

      mockCognitoClient.send.mockResolvedValue(mockResponse);

      const resetData = {
        email: "test@example.com"
      };

      const result = await cognitoClient.forgotPassword(resetData);

      expect(result.codeDeliveryDetails).toEqual(mockResponse.CodeDeliveryDetails);
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(ForgotPasswordCommand));
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      mockCognitoClient.send.mockResolvedValue({});

      const resetData = {
        email: "test@example.com",
        code: "123456",
        newPassword: "NewPassword123!"
      };

      await expect(cognitoClient.resetPassword(resetData)).resolves.toBeUndefined();
      expect(mockCognitoClient.send).toHaveBeenCalledWith(expect.any(ConfirmForgotPasswordCommand));
    });

    it("should handle password reset errors", async () => {
      const mockError = {
        name: "CodeMismatchException",
        message: "Invalid reset code"
      };

      mockCognitoClient.send.mockRejectedValue(mockError);

      const resetData = {
        email: "test@example.com",
        code: "wrong-code",
        newPassword: "NewPassword123!"
      };

      await expect(cognitoClient.resetPassword(resetData)).rejects.toThrow(AuthError);
    });
  });
});