import type { Queryable } from '#db/connection';

import type { SesFeedbackEvent } from '#repositories/ses-feedback.repository';

import { applySesFeedbackEvent } from '#repositories/ses-feedback.repository';



jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
}));

const _runInTransaction = jest.requireMock('#db/connection').runInTransaction as jest.Mock;
const _EMAIL_LOG_ID = '44444444-4444-4000-8000-000000000001';
const _SES_MESSAGE_ID = '0100017a-8b9c-example';

const _event = (
    overrides: Partial<SesFeedbackEvent> = {},
): SesFeedbackEvent => ({
    sesMessageId: _SES_MESSAGE_ID,
    eventType: 'delivery',
    status: 'delivered',
    eventAt: '2026-11-22T13:15:30.000Z',
    payload: {
        eventType: 'Delivery',
        mail: { messageId: _SES_MESSAGE_ID },
        delivery: { timestamp: '2026-11-22T13:15:30.000Z' },
    },
    shouldSuppress: false,
    diagnostics: null,
    ...overrides,
});

let query: jest.Mock;
let dependencies: { runInTransaction: jest.Mock };

beforeEach(() => {
    query = jest.fn();
    _runInTransaction.mockReset();
    _runInTransaction.mockImplementation(async (operation) =>
        operation({ query } as unknown as Queryable));
    dependencies = {
        runInTransaction: jest.fn(async (operation) => operation({ query } as unknown as Queryable)),
    };
});

describe('applySesFeedbackEvent', () => {
    test('records an event and transitions a sent log to delivered transactionally', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    email_log_id: _EMAIL_LOG_ID,
                    recipient_email: ' Person@Example.com ',
                    send_status: 'sent',
                }],
            })
            .mockResolvedValueOnce({ rows: [{ event_id: 'event-1' }] })
            .mockResolvedValueOnce({ rows: [{ email_log_id: _EMAIL_LOG_ID }] });

        await expect(applySesFeedbackEvent(_event(), dependencies)).resolves.toBe('updated');
        expect(dependencies.runInTransaction).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledTimes(3);
        expect(query.mock.calls[0]?.[0]).toContain('WHERE ses_message_id = $1');
        expect(query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
        expect(query.mock.calls[1]?.[0]).toContain('ON CONFLICT (deduplication_key) DO NOTHING');
        expect(query.mock.calls[1]?.[1]?.[2]).toBe('delivery');
        expect(query.mock.calls[2]?.[0]).toContain("AND send_status = 'sent'");
        expect(query.mock.calls[2]?.[1]?.[1]).toBe('delivered');
    });

    test('upserts permanent-bounce suppression and stores event diagnostics in the same transaction', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    email_log_id: _EMAIL_LOG_ID,
                    recipient_email: ' Person@Example.com ',
                    send_status: 'sent',
                }],
            })
            .mockResolvedValueOnce({ rows: [{ event_id: 'event-2' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [{ email_log_id: _EMAIL_LOG_ID }] });

        await applySesFeedbackEvent(_event({
            eventType: 'bounce',
            status: 'bounced',
            shouldSuppress: true,
            diagnostics: {
                bounceType: 'Permanent',
                bouncedRecipients: [{ diagnosticCode: '550 no mailbox' }],
            },
        }), dependencies);

        expect(query).toHaveBeenCalledTimes(4);
        expect(query.mock.calls[2]?.[0]).toContain('INSERT INTO email_suppressions');
        expect(query.mock.calls[2]?.[1]).toEqual(['person@example.com', 'bounce']);
        expect(query.mock.calls[3]?.[0]).toContain('last_error = CASE');
        expect(JSON.parse(String(query.mock.calls[3]?.[1]?.[2])).bounceType).toBe('Permanent');
    });

    test('upserts complaint suppression even when its status transition is out of order', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    email_log_id: _EMAIL_LOG_ID,
                    recipient_email: 'person@example.com',
                    send_status: 'delivered',
                }],
            })
            .mockResolvedValueOnce({ rows: [{ event_id: 'event-3' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        await expect(applySesFeedbackEvent(_event({
            eventType: 'complaint',
            status: 'complained',
            shouldSuppress: true,
            diagnostics: { feedbackId: 'feedback-123' },
        }), dependencies)).resolves.toBe('ignored');

        expect(query.mock.calls[2]?.[0]).toContain('INSERT INTO email_suppressions');
        expect(query.mock.calls[2]?.[1]).toEqual(['person@example.com', 'complaint']);
        expect(query.mock.calls[3]?.[0]).toContain("AND send_status = 'sent'");
    });

    test('does not suppress transient bounces', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    email_log_id: _EMAIL_LOG_ID,
                    recipient_email: 'person@example.com',
                    send_status: 'sent',
                }],
            })
            .mockResolvedValueOnce({ rows: [{ event_id: 'event-4' }] })
            .mockResolvedValueOnce({ rows: [{ email_log_id: _EMAIL_LOG_ID }] });

        await applySesFeedbackEvent(_event({
            eventType: 'bounce',
            status: 'bounced',
            shouldSuppress: false,
            diagnostics: { bounceType: 'Transient' },
        }), dependencies);

        expect(query).toHaveBeenCalledTimes(3);
        expect(query.mock.calls[2]?.[1]?.[1]).toBe('bounced');
    });

    test('treats duplicate notifications idempotently', async () => {
        query
            .mockResolvedValueOnce({
                rows: [{
                    email_log_id: _EMAIL_LOG_ID,
                    recipient_email: 'person@example.com',
                    send_status: 'bounced',
                }],
            })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] });

        await expect(applySesFeedbackEvent(_event({
            eventType: 'bounce',
            status: 'bounced',
            shouldSuppress: true,
            diagnostics: { bounceType: 'Permanent' },
        }), dependencies)).resolves.toBe('duplicate');
        expect(query).toHaveBeenCalledTimes(3);
        expect(query.mock.calls[2]?.[0]).toContain('INSERT INTO email_suppressions');
    });

    test('retries when the SES message ID cannot yet be correlated', async () => {
        query.mockResolvedValueOnce({ rows: [] });

        await expect(applySesFeedbackEvent(_event(), dependencies))
            .rejects.toThrow('No email log found for SES message');
        expect(query).toHaveBeenCalledTimes(1);
    });
});
