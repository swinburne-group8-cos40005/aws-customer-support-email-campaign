import { APIGatewayProxyEvent } from 'aws-lambda';

/** Cognito `sub` claim injected by the API Gateway JWT authorizer. */
export const cognitoSub = (event: APIGatewayProxyEvent): string | null => {
  const authorizer = (
    event.requestContext as unknown as {
      authorizer?: { claims?: Record<string, string> };
    }
  ).authorizer;
  return authorizer?.claims?.sub ?? null;
};
