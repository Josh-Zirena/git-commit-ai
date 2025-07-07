import { CognitoConfig } from "../types/auth";

export const getCognitoConfig = (): CognitoConfig => {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!userPoolId || !clientId) {
    throw new Error(
      "Missing required Cognito configuration. Please set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables."
    );
  }

  return {
    userPoolId,
    clientId,
    clientSecret,
    region
  };
};

export const getJWTSettings = () => ({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  issuer: `https://cognito-idp.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
  algorithms: ["RS256"],
  audience: process.env.COGNITO_CLIENT_ID
});

export const validateCognitoConfig = (): boolean => {
  try {
    getCognitoConfig();
    return true;
  } catch {
    return false;
  }
};