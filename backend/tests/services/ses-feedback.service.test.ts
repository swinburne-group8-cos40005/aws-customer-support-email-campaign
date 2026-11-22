import type { SQSRecord } from 'aws-lambda';

import type {
    SesFeedbackEvent,
    SesFeedbackResult,
} from '#repositories/ses-feedback.repository';

import { processSesFeedbackRecord } from '#services/ses-feedback.service';



const SES_MESSAGE_ID = '0100017a-8b9c-example';
const EVENT_TIMESTAMP = '2026-11-22T13:15:30.000Z';

const _record = (eventPayload: Record<string, unknown>, id = 'sqs-message-1'): SQSRecord => ({
    messageId: id,
    receiptHandle: 'receipt',
    body: JSON.stringify({
        Type: 'Notification',
        MessageId: 'sns-message-1',
        Message: JSON.stringify(eventPayload),
    }),
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

const _apply = jest.fn<Promise<SesFeedbackResult>, [SesFeedbackEvent]>();

beforeEach(() => {
    _apply.mockReset();
    _apply.mockResolvedValue('updated');
});

describe('processSesFeedbackRecord', () => {
    test('acknowledges SES Send notifications without changing feedback state', async () => {
        await expect(processSesFeedbackRecord(_record({
            eventType: 'Send',
            mail: { messageId: SES_MESSAGE_ID },
            send: { timestamp: EVENT_TIMESTAMP },
        }), _apply)).resolves.toBe('ignored');
        expect(_apply).not.toHaveBeenCalled();
    });

    test('parses SNS-wrapped SES Delivery and correlates by SES message ID', async () => {
        const payload = {
            eventType: 'Delivery',
            mail: { messageId: SES_MESSAGE_ID },
            delivery: { timestamp: EVENT_TIMESTAMP, recipients: ['person@example.com'] },
        };

        await processSesFeedbackRecord(_record(payload), _apply);

        expect(_apply).toHaveBeenCalledWith(expect.objectContaining({
            sesMessageId: SES_MESSAGE_ID,
            eventType: 'delivery',
            status: 'delivered',
            eventAt: EVENT_TIMESTAMP,
            shouldSuppress: false,
            diagnostics: null,
            payload,
        }));
    });

    test.each([
        ['Permanent', true],
        ['Transient', false],
    ] as const)(
        'parses %s Bounce and selects suppression policy',
        async (bounceType, shouldSuppress) => {
            await processSesFeedbackRecord(_record({
                eventType: 'Bounce',
                mail: { messageId: SES_MESSAGE_ID },
                bounce: {
                    timestamp: EVENT_TIMESTAMP,
                    bounceType,
                    bounceSubType: 'General',
                    bouncedRecipients: [{
                        emailAddress: 'person@example.com',
                        diagnosticCode: 'smtp; 550 mailbox unavailable',
                    }],
                },
            }), _apply);

            expect(_apply).toHaveBeenCalledWith(expect.objectContaining({
                sesMessageId: SES_MESSAGE_ID,
                eventType: 'bounce',
                status: 'bounced',
                shouldSuppress,
                diagnostics: expect.objectContaining({
                    bounceType,
                    bounceSubType: 'General',
                }),
            }));
        },
    );

    test('parses SES Complaint and preserves complaint diagnostics', async () => {
        await processSesFeedbackRecord(_record({
            eventType: 'Complaint',
            mail: { messageId: SES_MESSAGE_ID },
            complaint: {
                timestamp: EVENT_TIMESTAMP,
                complaintSubType: 'OnAccountSuppressionList',
                feedbackId: 'feedback-123',
                complainedRecipients: [{ emailAddress: 'person@example.com' }],
            },
        }), _apply);

        expect(_apply).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'complaint',
            status: 'complained',
            shouldSuppress: true,
            diagnostics: {
                complaintSubType: 'OnAccountSuppressionList',
                feedbackId: 'feedback-123',
                complainedRecipients: [{ emailAddress: 'person@example.com' }],
            },
        }));
    });

    test.each([
        ['invalid SQS JSON', '{'],
        ['non-SNS message', JSON.stringify({ message: 'not an SNS envelope' })],
    ])('rejects %s for SQS retry', async (_label, body) => {
        const record = _record({});
        record.body = body;

        await expect(processSesFeedbackRecord(record, _apply)).rejects.toThrow();
        expect(_apply).not.toHaveBeenCalled();
    });

    test('rejects malformed or unsupported SES payloads', async () => {
        await expect(processSesFeedbackRecord(_record({
            eventType: 'Reject',
            mail: { messageId: SES_MESSAGE_ID },
        }), _apply)).rejects.toThrow('Unsupported SES feedback event type');

        await expect(processSesFeedbackRecord(_record({
            eventType: 'Delivery',
            mail: {},
            delivery: { timestamp: EVENT_TIMESTAMP },
        }), _apply)).rejects.toThrow('mail.messageId');
    });

    test('surfaces database failures for the record-level batch retry', async () => {
        _apply.mockRejectedValue(new Error('database unavailable'));

        await expect(processSesFeedbackRecord(_record({
            eventType: 'Delivery',
            mail: { messageId: SES_MESSAGE_ID },
            delivery: { timestamp: EVENT_TIMESTAMP },
        }), _apply)).rejects.toThrow('database unavailable');
    });
});
