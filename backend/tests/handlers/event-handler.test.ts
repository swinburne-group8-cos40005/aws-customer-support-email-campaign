import type { SQSEvent, SQSRecord } from 'aws-lambda';

import { handler } from '#handlers/event-handler';
import { processSesFeedbackRecord } from '#services/ses-feedback.service';



jest.mock('#services/ses-feedback.service', () => ({
    processSesFeedbackRecord: jest.fn(),
}));

const processSesFeedbackRecordMock = processSesFeedbackRecord as jest.Mock;

const _record = (messageId: string): SQSRecord => ({
    messageId,
    receiptHandle: `receipt-${messageId}`,
    body: '{}',
    attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '0',
        SenderId: 'sns',
        ApproximateFirstReceiveTimestamp: '0',
    },
    messageAttributes: {},
    md5OfBody: 'md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:csep-feedback-queue-dev',
    awsRegion: 'us-east-1',
});

const _event = (...records: SQSRecord[]): SQSEvent => ({
    Records: records,
});

beforeEach(() => {
    processSesFeedbackRecordMock.mockReset();
    processSesFeedbackRecordMock.mockResolvedValue('updated');
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('EventHandler SQS batch processing', () => {
    test('acknowledges a batch when every record is processed', async () => {
        await expect(handler(_event(_record('a'), _record('b'))))
            .resolves.toEqual({ batchItemFailures: [] });
        expect(processSesFeedbackRecordMock).toHaveBeenCalledTimes(2);
    });

    test('returns only failed record identifiers for partial retry', async () => {
        processSesFeedbackRecordMock
            .mockResolvedValueOnce('updated')
            .mockRejectedValueOnce(new Error('bad SNS event'))
            .mockRejectedValueOnce(new Error('database unavailable'));

        await expect(handler(_event(
            _record('ok'),
            _record('malformed'),
            _record('retry'),
        ))).resolves.toEqual({
            batchItemFailures: [
                { itemIdentifier: 'malformed' },
                { itemIdentifier: 'retry' },
            ],
        });
        expect(processSesFeedbackRecordMock).toHaveBeenCalledTimes(3);
    });
});
