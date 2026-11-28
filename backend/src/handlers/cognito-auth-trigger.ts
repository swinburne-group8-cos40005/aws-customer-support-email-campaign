import type { CognitoUserPoolTriggerEvent } from "aws-lambda";

export async function handler(
  event: CognitoUserPoolTriggerEvent
): Promise<CognitoUserPoolTriggerEvent> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    triggerSource: event.triggerSource ?? "unknown",
    sub: event.request?.userAttributes?.sub ?? null,
    clientId: event.callerContext?.clientId ?? null
  };

  console.log(JSON.stringify(logEntry));

  return event;
}
