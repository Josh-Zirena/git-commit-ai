import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { AuthenticatedRequest, CognitoUser, AuthError } from "../types/auth";
import { getJWTSettings } from "../config/cognito";

const client = jwksClient({
  jwksUri: getJWTSettings().jwksUri,
  requestHeaders: {},
  timeout: 30000
});

const getKey = (header: any, callback: any) => {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key!.getPublicKey();
    callback(null, signingKey);
  });
};

const verifyToken = (token: string): Promise<CognitoUser> => {
  return new Promise((resolve, reject) => {
    const jwtSettings = getJWTSettings();
    
    jwt.verify(
      token,
      getKey,
      {
        issuer: jwtSettings.issuer,
        audience: jwtSettings.audience,
        algorithms: jwtSettings.algorithms as any
      },
      (err: any, decoded: any) => {
        if (err) {
          return reject(new AuthError("Invalid token", "InvalidToken" as any, 401));
        }
        
        const user = decoded as CognitoUser;
        
        // Verify token is not expired
        if (user.exp < Date.now() / 1000) {
          return reject(new AuthError("Token expired", "TokenExpired" as any, 401));
        }
        
        // Verify this is an access token
        if (user.token_use !== "access") {
          return reject(new AuthError("Invalid token type", "InvalidToken" as any, 401));
        }
        
        resolve(user);
      }
    );
  });
};

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        error: "Access token is required",
        success: false
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    const cognitoUser = await verifyToken(token);
    
    // Add user info to request
    req.user = {
      sub: cognitoUser.sub,
      email: cognitoUser.email,
      emailVerified: cognitoUser.email_verified,
      username: cognitoUser["cognito:username"],
      firstName: cognitoUser.given_name,
      lastName: cognitoUser.family_name,
      picture: cognitoUser.picture,
      iat: cognitoUser.iat,
      exp: cognitoUser.exp
    };
    
    req.authToken = token;
    
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        error: error.message,
        success: false
      });
    } else {
      res.status(401).json({
        error: "Authentication failed",
        success: false
      });
    }
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without authentication
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const cognitoUser = await verifyToken(token);
      
      req.user = {
        sub: cognitoUser.sub,
        email: cognitoUser.email,
        emailVerified: cognitoUser.email_verified,
        username: cognitoUser["cognito:username"],
        firstName: cognitoUser.given_name,
        lastName: cognitoUser.family_name,
        picture: cognitoUser.picture,
        iat: cognitoUser.iat,
        exp: cognitoUser.exp
      };
      
      req.authToken = token;
    } catch (authError) {
      // Token is invalid, but this is optional auth, so continue without user
    }
    
    next();
  } catch (error) {
    // Any other error, continue without authentication
    next();
  }
};

export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: "Authentication required",
      success: false
    });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({
      error: "Email verification required",
      success: false,
      code: "EMAIL_NOT_VERIFIED"
    });
    return;
  }

  next();
};