import type { SendMessageBatchCommand } from '@aws-sdk/client-sqs';

import { sendQueueBatch } from '#services/dispatcher-queue';
import type { SendQueueEntry } from '#services/dispatcher.service';



const _entry = (id: string): SendQueueEntry => ({
    Id: id,
    MessageBody: JSON.stringify({ campaignId: 'campaign-1' }),
    MessageAttributes: {
        idempotencyKey: { DataType: 'String', StringValue: `key-${id}` },
    },
});

const _originalQueueUrl = process.env.SEND_QUEUE_URL;

beforeEach(() => {
    process.env.SEND_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789012/send';
});

afterEach(() => {
    jest.restoreAllMocks();
    if (_originalQueueUrl === undefined) {
        delete process.env.SEND_QUEUE_URL;
    } else {
        process.env.SEND_QUEUE_URL = _originalQueueUrl;
    }
});

describe('sendQueueBatch', () => {
    test('sends entries to the configured queue and returns partial results', async () => {
        const send = jest.fn(async (_command: SendMessageBatchCommand) => ({
            Successful: [{
                Id: 'ok',
                MessageId: 'message-id',
                MD5OfMessageBody: 'md5',
            }],
            Failed: [{ Id: 'failed', Code: 'Throttled', SenderFault: false }],
            $metadata: {},
        }));

        await expect(sendQueueBatch([_entry('ok'), _entry('failed')], { send }))
            .resolves.toEqual({
                Successful: [{
                    Id: 'ok',
                    MessageId: 'message-id',
                    MD5OfMessageBody: 'md5',
                }],
                Failed: [{ Id: 'failed', Code: 'Throttled', SenderFault: false }],
            });
        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            input: {
                QueueUrl: process.env.SEND_QUEUE_URL,
                Entries: [_entry('ok'), _entry('failed')],
            },
        }));
    });

    test('normalizes omitted SQS result arrays to empty lists', async () => {
        const send = jest.fn(async (_command: SendMessageBatchCommand) => ({
            Successful: undefined,
            Failed: undefined,
            $metadata: {},
        }));

        await expect(sendQueueBatch([_entry('only')], { send })).resolves.toEqual({
            Successful: [],
            Failed: [],
        });
    });

    test.each([0, 11])('rejects a batch with %i entries', async (count) => {
        await expect(sendQueueBatch(Array.from({ length: count }, (_, index) => _entry(`${index}`))))
            .rejects.toThrow('between 1 and 10');
    });

    test('requires a queue URL before contacting SQS', async () => {
        delete process.env.SEND_QUEUE_URL;
        const send = jest.fn();

        await expect(sendQueueBatch([_entry('only')], { send }))
            .rejects.toThrow('SEND_QUEUE_URL is required');
        expect(send).not.toHaveBeenCalled();
    });
});
