import type { CognitoUserPoolTriggerEvent } from "aws-lambda";
import { handler } from "#handlers/cognito-auth-trigger";

describe("Cognito authentication trigger", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  const createEvent = (
    triggerSource: string
  ): CognitoUserPoolTriggerEvent =>
    ({
      version: "1",
      region: "ap-southeast-2",
      userPoolId: "ap-southeast-2_example",
      userName: "test-user",
      callerContext: {
        awsSdkVersion: "aws-sdk-test",
        clientId: "test-client-id"
      },
      triggerSource,
      request: {
        userAttributes: {
          sub: "test-user-sub",
          email: "test@example.com"
        }
      },
      response: {}
    }) as CognitoUserPoolTriggerEvent;

  it("returns the incoming Cognito event unchanged", async () => {
    const event = createEvent("PostAuthentication_Authentication");

    const result = await handler(event);

    expect(result).toBe(event);
    expect(result).toEqual(event);
  });

  it("logs structured authentication metadata", async () => {
    const event = createEvent("PostAuthentication_Authentication");

    await handler(event);

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    const loggedValue = consoleSpy.mock.calls[0][0];
    const metadata = JSON.parse(loggedValue);

    expect(metadata).toEqual({
      timestamp: expect.any(String),
      triggerSource: "PostAuthentication_Authentication",
      sub: "test-user-sub",
      clientId: "test-client-id"
    });

    expect(Number.isNaN(Date.parse(metadata.timestamp))).toBe(false);
  });

  it("logs post-confirmation events", async () => {
    const event = createEvent("PostConfirmation_ConfirmSignUp");

    await handler(event);

    const metadata = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(metadata.triggerSource).toBe(
      "PostConfirmation_ConfirmSignUp"
    );
  });

  it("does not log email addresses or authentication secrets", async () => {
    const event = createEvent("PostAuthentication_Authentication");

    await handler(event);

    const loggedValue = consoleSpy.mock.calls[0][0];

    expect(loggedValue).not.toContain("test@example.com");
    expect(loggedValue).not.toContain("password");
    expect(loggedValue).not.toContain("accessToken");
  });
});
