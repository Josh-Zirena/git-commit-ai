import { Request } from "express";

export interface CognitoUser {
  sub: string;
  email: string;
  email_verified: boolean;
  "cognito:username": string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  iat: number;
  exp: number;
  token_use: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email: string;
    emailVerified: boolean;
    username: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    iat: number;
    exp: number;
  };
  authToken?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    sub: string;
    email: string;
    emailVerified: boolean;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  tokens?: AuthTokens;
}

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  clientSecret?: string;
  region: string;
}

export enum AuthErrorCodes {
  INVALID_CREDENTIALS = "InvalidCredentials",
  USER_NOT_FOUND = "UserNotFound",
  USER_NOT_CONFIRMED = "UserNotConfirmed",
  INVALID_TOKEN = "InvalidToken",
  TOKEN_EXPIRED = "TokenExpired",
  CODE_MISMATCH = "CodeMismatch",
  INVALID_PASSWORD = "InvalidPassword",
  USERNAME_EXISTS = "UsernameExists",
  LIMIT_EXCEEDED = "LimitExceeded",
  NETWORK_ERROR = "NetworkError",
  UNKNOWN_ERROR = "UnknownError"
}

export class AuthError extends Error {
  public code: AuthErrorCodes;
  public statusCode: number;

  constructor(message: string, code: AuthErrorCodes, statusCode: number = 400) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const mapCognitoError = (error: any): AuthError => {
  const message = error.message || "Authentication error";
  
  switch (error.code || error.name) {
    case "NotAuthorizedException":
      return new AuthError("Invalid credentials", AuthErrorCodes.INVALID_CREDENTIALS, 401);
    case "UserNotFoundException":
      return new AuthError("User not found", AuthErrorCodes.USER_NOT_FOUND, 404);
    case "UserNotConfirmedException":
      return new AuthError("User email not verified", AuthErrorCodes.USER_NOT_CONFIRMED, 400);
    case "InvalidParameterException":
      return new AuthError("Invalid parameters", AuthErrorCodes.INVALID_PASSWORD, 400);
    case "CodeMismatchException":
      return new AuthError("Invalid verification code", AuthErrorCodes.CODE_MISMATCH, 400);
    case "UsernameExistsException":
      return new AuthError("User already exists", AuthErrorCodes.USERNAME_EXISTS, 409);
    case "LimitExceededException":
      return new AuthError("Rate limit exceeded", AuthErrorCodes.LIMIT_EXCEEDED, 429);
    case "NetworkingError":
      return new AuthError("Network error", AuthErrorCodes.NETWORK_ERROR, 503);
    default:
      return new AuthError(message, AuthErrorCodes.UNKNOWN_ERROR, 500);
  }
};