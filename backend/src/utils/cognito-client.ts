import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  AdminGetUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "crypto";
import { getCognitoConfig } from "../config/cognito";
import {
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  AuthError,
  mapCognitoError
} from "../types/auth";

export class CognitoClient {
  private client: CognitoIdentityProviderClient;
  private config: ReturnType<typeof getCognitoConfig>;

  constructor() {
    this.config = getCognitoConfig();
    this.client = new CognitoIdentityProviderClient({
      region: this.config.region
    });
  }

  private calculateSecretHash = (username: string): string | undefined => {
    if (!this.config.clientSecret) return undefined;

    const message = username + this.config.clientId;
    return createHmac("sha256", this.config.clientSecret)
      .update(message)
      .digest("base64");
  };

  register = async (userData: RegisterRequest): Promise<{ userSub: string; codeDeliveryDetails: any }> => {
    try {
      const secretHash = this.calculateSecretHash(userData.email);
      
      const command = new SignUpCommand({
        ClientId: this.config.clientId,
        Username: userData.email,
        Password: userData.password,
        SecretHash: secretHash,
        UserAttributes: [
          { Name: "email", Value: userData.email },
          ...(userData.firstName ? [{ Name: "given_name", Value: userData.firstName }] : []),
          ...(userData.lastName ? [{ Name: "family_name", Value: userData.lastName }] : [])
        ]
      });

      const response = await this.client.send(command);
      
      return {
        userSub: response.UserSub!,
        codeDeliveryDetails: response.CodeDeliveryDetails
      };
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  verifyEmail = async (data: VerifyEmailRequest): Promise<void> => {
    try {
      const secretHash = this.calculateSecretHash(data.email);
      
      const command = new ConfirmSignUpCommand({
        ClientId: this.config.clientId,
        Username: data.email,
        ConfirmationCode: data.code,
        SecretHash: secretHash
      });

      await this.client.send(command);
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  login = async (credentials: LoginRequest): Promise<AuthTokens> => {
    try {
      const secretHash = this.calculateSecretHash(credentials.email);
      
      const command = new InitiateAuthCommand({
        ClientId: this.config.clientId,
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: credentials.email,
          PASSWORD: credentials.password,
          ...(secretHash && { SECRET_HASH: secretHash })
        }
      });

      const response = await this.client.send(command);
      
      if (!response.AuthenticationResult) {
        throw new AuthError("Login failed", "InvalidCredentials" as any, 401);
      }

      const { AccessToken, RefreshToken, IdToken, ExpiresIn } = response.AuthenticationResult;
      
      return {
        accessToken: AccessToken!,
        refreshToken: RefreshToken!,
        idToken: IdToken!,
        expiresIn: ExpiresIn!,
        tokenType: "Bearer"
      };
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  refreshToken = async (data: RefreshTokenRequest): Promise<AuthTokens> => {
    try {
      const command = new InitiateAuthCommand({
        ClientId: this.config.clientId,
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: {
          REFRESH_TOKEN: data.refreshToken
        }
      });

      const response = await this.client.send(command);
      
      if (!response.AuthenticationResult) {
        throw new AuthError("Token refresh failed", "InvalidToken" as any, 401);
      }

      const { AccessToken, IdToken, ExpiresIn } = response.AuthenticationResult;
      
      return {
        accessToken: AccessToken!,
        refreshToken: data.refreshToken, // Refresh token doesn't change
        idToken: IdToken!,
        expiresIn: ExpiresIn!,
        tokenType: "Bearer"
      };
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  logout = async (accessToken: string): Promise<void> => {
    try {
      const command = new GlobalSignOutCommand({
        AccessToken: accessToken
      });

      await this.client.send(command);
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  forgotPassword = async (data: ForgotPasswordRequest): Promise<{ codeDeliveryDetails: any }> => {
    try {
      const secretHash = this.calculateSecretHash(data.email);
      
      const command = new ForgotPasswordCommand({
        ClientId: this.config.clientId,
        Username: data.email,
        SecretHash: secretHash
      });

      const response = await this.client.send(command);
      
      return {
        codeDeliveryDetails: response.CodeDeliveryDetails
      };
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  resetPassword = async (data: ResetPasswordRequest): Promise<void> => {
    try {
      const secretHash = this.calculateSecretHash(data.email);
      
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.config.clientId,
        Username: data.email,
        Password: data.newPassword,
        ConfirmationCode: data.code,
        SecretHash: secretHash
      });

      await this.client.send(command);
    } catch (error) {
      throw mapCognitoError(error);
    }
  };

  getUser = async (accessToken: string): Promise<any> => {
    try {
      const command = new GetUserCommand({
        AccessToken: accessToken
      });

      const response = await this.client.send(command);
      
      return {
        username: response.Username,
        attributes: response.UserAttributes?.reduce((acc, attr) => {
          acc[attr.Name!] = attr.Value!;
          return acc;
        }, {} as Record<string, string>)
      };
    } catch (error) {
      throw mapCognitoError(error);
    }
  };
}

export const cognitoClient = new CognitoClient();