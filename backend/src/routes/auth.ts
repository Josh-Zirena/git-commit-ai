import { Router, Request, Response } from "express";
import { cognitoClient } from "../utils/cognito-client";
import { authenticateToken } from "../middleware/auth";
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthenticatedRequest,
  AuthError
} from "../types/auth";

const router = Router();

// Register new user
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const userData: RegisterRequest = req.body;
    
    // Basic validation
    if (!userData.email || !userData.password) {
      res.status(400).json({
        error: "Email and password are required",
        success: false
      });
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      res.status(400).json({
        error: "Invalid email format",
        success: false
      });
      return;
    }
    
    // Password validation
    if (userData.password.length < 8) {
      res.status(400).json({
        error: "Password must be at least 8 characters long",
        success: false
      });
      return;
    }

    const result = await cognitoClient.register(userData);
    
    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for verification code.",
      userSub: result.userSub,
      codeDeliveryDetails: result.codeDeliveryDetails
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Registration failed",
        success: false
      });
    }
  }
});

// Verify email
router.post("/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: VerifyEmailRequest = req.body;
    
    if (!data.email || !data.code) {
      res.status(400).json({
        error: "Email and verification code are required",
        success: false
      });
      return;
    }

    await cognitoClient.verifyEmail(data);
    
    res.json({
      success: true,
      message: "Email verified successfully. You can now log in."
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Email verification failed",
        success: false
      });
    }
  }
});

// Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const credentials: LoginRequest = req.body;
    
    if (!credentials.email || !credentials.password) {
      res.status(400).json({
        error: "Email and password are required",
        success: false
      });
      return;
    }

    const tokens = await cognitoClient.login(credentials);
    
    res.json({
      success: true,
      message: "Login successful",
      tokens
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Login failed",
        success: false
      });
    }
  }
});

// Refresh token
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: RefreshTokenRequest = req.body;
    
    if (!data.refreshToken) {
      res.status(400).json({
        error: "Refresh token is required",
        success: false
      });
      return;
    }

    const tokens = await cognitoClient.refreshToken(data);
    
    res.json({
      success: true,
      message: "Token refreshed successfully",
      tokens
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Token refresh failed",
        success: false
      });
    }
  }
});

// Logout
router.post("/logout", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.authToken) {
      res.status(400).json({
        error: "No active session found",
        success: false
      });
      return;
    }

    await cognitoClient.logout(req.authToken);
    
    res.json({
      success: true,
      message: "Logged out successfully"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Logout failed",
        success: false
      });
    }
  }
});

// Forgot password
router.post("/forgot-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: ForgotPasswordRequest = req.body;
    
    if (!data.email) {
      res.status(400).json({
        error: "Email is required",
        success: false
      });
      return;
    }

    const result = await cognitoClient.forgotPassword(data);
    
    res.json({
      success: true,
      message: "Password reset code sent to your email",
      codeDeliveryDetails: result.codeDeliveryDetails
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Password reset request failed",
        success: false
      });
    }
  }
});

// Reset password
router.post("/reset-password", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: ResetPasswordRequest = req.body;
    
    if (!data.email || !data.code || !data.newPassword) {
      res.status(400).json({
        error: "Email, code, and new password are required",
        success: false
      });
      return;
    }
    
    if (data.newPassword.length < 8) {
      res.status(400).json({
        error: "New password must be at least 8 characters long",
        success: false
      });
      return;
    }

    await cognitoClient.resetPassword(data);
    
    res.json({
      success: true,
      message: "Password reset successfully"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false,
        code: error.code
      });
    } else {
      res.status(500).json({
        error: "Password reset failed",
        success: false
      });
    }
  }
});

// Get current user profile
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: "Authentication required",
        success: false
      });
      return;
    }

    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to get user profile",
      success: false
    });
  }
});

export default router;