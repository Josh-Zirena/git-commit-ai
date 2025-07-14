import serverlessExpress from '@codegenie/serverless-express';
import type { APIGatewayProxyEvent, Context, Callback } from 'aws-lambda';
import app from './index';

const serverlessApp = serverlessExpress({ app });

export const handler = (
  event: APIGatewayProxyEvent,
  context: Context,
  callback: Callback
) => {
  return serverlessApp(event, context, callback);
};