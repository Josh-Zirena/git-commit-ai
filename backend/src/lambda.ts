import serverlessExpress from '@codegenie/serverless-express';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';
import app from './index';

const serverlessApp = serverlessExpress({ app });

export const handler = (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback
) => {
  // Updated to use Secrets Manager for OpenAI API key
  return serverlessApp(event, context, callback);
};