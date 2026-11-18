import { runReadQuery } from '#db/connection';

import type { EmailLogRow } from '#repositories/email-log.repository';
import {
    listEmailLogRows,
    mapEmailLogRowToResponse,
} from '#repositories/email-log.repository';




jest.mock('#db/connection', () => ({
    runReadQuery: jest.fn(),
}));

const runReadQueryMock = runReadQuery as jest.Mock;

const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

const logRow = (): EmailLogRow => ({
    email_log_id: 'c4d5e6f7-a8b9-4c1d-8e3f-4a5b6c7d8e9f',
    recipient_email: 'user@example.com',
    send_status: 'delivered',
    ses_message_id: '0100017a-8b9c-xyz-000000',
    attempt_count: 1,
    updated_at: '2026-10-30T10:02:15.000Z',
});

beforeEach(() => {
    runReadQueryMock.mockReset();
});

describe('listEmailLogRows', () => {
    test('filters by campaign and orders newest first', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [logRow()], rowCount: 1 });

        const rows = await listEmailLogRows(CAMPAIGN_ID);

        const [text, params] = runReadQueryMock.mock.calls[0] as [string, unknown[]];
        expect(text).toContain('FROM email_logs');
        expect(text).toContain('ORDER BY created_at DESC');
        expect(params).toEqual([CAMPAIGN_ID]);
        expect(rows).toHaveLength(1);
    });

    test('returns an empty list when the campaign has no logs yet', async () => {
        runReadQueryMock.mockResolvedValue({ rows: [], rowCount: 0 });

        await expect(listEmailLogRows(CAMPAIGN_ID)).resolves.toEqual([]);
    });
});

describe('mapEmailLogRowToResponse', () => {
    test('maps the row onto the contract log entry (§2.1)', () => {
        expect(mapEmailLogRowToResponse(logRow())).toEqual({
            emailLogId: 'c4d5e6f7-a8b9-4c1d-8e3f-4a5b6c7d8e9f',
            recipientEmail: 'user@example.com',
            sendStatus: 'delivered',
            sesMessageId: '0100017a-8b9c-xyz-000000',
            attemptCount: 1,
            updatedAt: '2026-10-30T10:02:15.000Z',
        });
    });
});
