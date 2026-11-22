import type { InvokeCommand } from '@aws-sdk/client-lambda';

import { invokeDispatcherAsynchronously } from '#services/dispatcher-invoker';



const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const _originalDispatcherArn = process.env.DISPATCHER_LAMBDA_ARN;

beforeEach(() => {
    process.env.DISPATCHER_LAMBDA_ARN =
        'arn:aws:lambda:us-east-1:123456789012:function:csep-dispatcher-dev';
});

afterEach(() => {
    jest.restoreAllMocks();
    if (_originalDispatcherArn === undefined) {
        delete process.env.DISPATCHER_LAMBDA_ARN;
    } else {
        process.env.DISPATCHER_LAMBDA_ARN = _originalDispatcherArn;
    }
});

describe('invokeDispatcherAsynchronously', () => {
    test('asynchronously invokes Dispatcher with the shared immediate trigger payload', async () => {
        const send = jest.fn(async (_command: InvokeCommand) => ({
            StatusCode: 202,
            $metadata: {},
        }));

        await invokeDispatcherAsynchronously(
            CAMPAIGN_ID,
            { send },
        );

        const command = send.mock.calls[0]?.[0] as InvokeCommand;
        expect(command.input).toMatchObject({
            FunctionName: process.env.DISPATCHER_LAMBDA_ARN,
            InvocationType: 'Event',
        });
        const payload = command.input.Payload;
        if (!(payload instanceof Uint8Array)) {
            throw new Error('Expected the invoke payload to be encoded as bytes');
        }
        expect(JSON.parse(new TextDecoder().decode(payload))).toEqual({
            campaignId: CAMPAIGN_ID,
            trigger: 'immediate',
        });
    });

    test('fails explicitly when the Dispatcher ARN is missing or invoke is rejected', async () => {
        delete process.env.DISPATCHER_LAMBDA_ARN;
        await expect(invokeDispatcherAsynchronously(CAMPAIGN_ID))
            .rejects.toThrow('DISPATCHER_LAMBDA_ARN is required');

        process.env.DISPATCHER_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:test';
        await expect(invokeDispatcherAsynchronously(
            CAMPAIGN_ID,
            { send: jest.fn().mockRejectedValue(new Error('Lambda unavailable')) },
        )).rejects.toThrow('Lambda unavailable');
    });

    test('rejects a response that was not accepted as an asynchronous invoke', async () => {
        await expect(invokeDispatcherAsynchronously(
            CAMPAIGN_ID,
            { send: jest.fn().mockResolvedValue({ StatusCode: 200, $metadata: {} }) },
        )).rejects.toThrow('unexpected status 200');
    });
});
