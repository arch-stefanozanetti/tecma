import awsLambdaFastify from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';

import { buildServer } from './server.js';

type LambdaProxy = ReturnType<typeof awsLambdaFastify>;

let cachedProxyPromise: Promise<LambdaProxy> | null = null;

const getProxy = async (): Promise<LambdaProxy> => {
  if (cachedProxyPromise != null) return cachedProxyPromise;
  cachedProxyPromise = (async () => {
    const app = await buildServer();
    return awsLambdaFastify(app);
  })();
  return cachedProxyPromise;
};

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyStructuredResultV2> => {
  const proxy = await getProxy();
  return await new Promise<APIGatewayProxyStructuredResultV2>((resolve, reject) => {
    proxy(event, context, (error, result) => {
      if (error != null) {
        reject(error);
        return;
      }
      resolve(result as APIGatewayProxyStructuredResultV2);
    });
  });
};
