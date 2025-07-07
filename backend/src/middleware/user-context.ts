import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/auth";

export interface UserContext {
  sub: string;
  email: string;
  emailVerified: boolean;
  username: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

export const addUserContext = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user) {
    // Add user context to request
    req.userContext = {
      sub: req.user.sub,
      email: req.user.email,
      emailVerified: req.user.emailVerified,
      username: req.user.username,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      picture: req.user.picture,
      isAuthenticated: true,
      isEmailVerified: req.user.emailVerified
    };
    
    // Add user context to response locals for use in templates/logging
    res.locals.user = req.userContext;
  } else {
    // Anonymous user context
    req.userContext = {
      sub: "anonymous",
      email: "",
      emailVerified: false,
      username: "anonymous",
      isAuthenticated: false,
      isEmailVerified: false
    };
    
    res.locals.user = req.userContext;
  }
  
  next();
};

export const getUserDisplayName = (userContext: UserContext): string => {
  if (!userContext.isAuthenticated) {
    return "Anonymous";
  }
  
  if (userContext.firstName && userContext.lastName) {
    return `${userContext.firstName} ${userContext.lastName}`;
  }
  
  if (userContext.firstName) {
    return userContext.firstName;
  }
  
  return userContext.email;
};

export const isUserAuthenticated = (req: AuthenticatedRequest): boolean => {
  return req.userContext?.isAuthenticated ?? false;
};

export const isUserEmailVerified = (req: AuthenticatedRequest): boolean => {
  return req.userContext?.isEmailVerified ?? false;
};

export const getUserId = (req: AuthenticatedRequest): string | null => {
  return req.userContext?.sub ?? null;
};

export const getUserEmail = (req: AuthenticatedRequest): string | null => {
  return req.userContext?.email ?? null;
};

// Extend the AuthenticatedRequest interface
declare module "../types/auth" {
  interface AuthenticatedRequest {
    userContext?: UserContext;
  }
}