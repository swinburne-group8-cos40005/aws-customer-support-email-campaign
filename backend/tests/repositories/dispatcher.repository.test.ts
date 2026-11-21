import { createHash } from 'node:crypto';

import type { Queryable } from '#db/connection';
import type { DatabaseSession } from '#db/connection';

import {
    claimCampaignForDispatch,
    completeCampaignDispatch,
    failCampaignDispatch,
    listEligibleDispatchRecipients,
    listPendingDispatchJobs,
    markDispatchLogsQueued,
    seedPendingDispatchLogs,
    withCampaignDispatchLock,
} from '#repositories/dispatcher.repository';

import { runInTransaction, withDatabaseAdvisoryLock } from '#db/connection';



jest.mock('#db/connection', () => ({
    runInTransaction: jest.fn(),
    runReadQuery: jest.fn(),
    withDatabaseAdvisoryLock: jest.fn(),
}));

const runInTransactionMock = runInTransaction as jest.Mock;
const withDatabaseAdvisoryLockMock = withDatabaseAdvisoryLock as jest.Mock;
const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const CUSTOMER_ID = '11111111-1111-4000-8000-000000000001';
const SEGMENT_ID = '55555555-5555-4000-8000-000000000001';
const TEMPLATE_ID = '22222222-2222-4000-8000-000000000001';
let tx: { query: jest.Mock };
let session: DatabaseSession;

beforeEach(() => {
    tx = { query: jest.fn() };
    session = {
        query: tx.query,
        transaction: async (operation) => operation(tx as unknown as Queryable),
    };
    runInTransactionMock.mockReset();
    runInTransactionMock.mockImplementation(async (operation) => operation(tx as unknown as Queryable));
    withDatabaseAdvisoryLockMock.mockReset();
    withDatabaseAdvisoryLockMock.mockImplementation(async (_key, operation) =>
        operation(session));
});

describe('dispatcher repository', () => {
    test('resolves segment members while filtering suppressed emails in SQL', async () => {
        tx.query.mockResolvedValue({
            rows: [{ customer_id: CUSTOMER_ID, email: 'person@example.com' }],
            rowCount: 1,
        });

        await listEligibleDispatchRecipients(SEGMENT_ID, session);

        const [sql, values] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(sql).toContain('FROM customer_segments cs');
        expect(sql).toContain('NOT EXISTS');
        expect(sql).toContain('FROM email_suppressions s');
        expect(sql).toContain('lower(trim(c.email))');
        expect(sql).not.toContain('is_subscribed');
        expect(values).toEqual([SEGMENT_ID]);
    });

    test('seeds pending logs using deterministic keys and ignores duplicate keys', async () => {
        await seedPendingDispatchLogs(CAMPAIGN_ID, [
            { customer_id: CUSTOMER_ID, email: 'person@example.com' },
        ], session);

        const [sql, values] = tx.query.mock.calls[0] as [string, unknown[]];
        const expectedKey = createHash('sha256')
            .update(`${CAMPAIGN_ID}${CUSTOMER_ID}`)
            .digest('hex');
        expect(sql).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
        expect(sql).toContain("'pending'");
        expect(values).toEqual([CAMPAIGN_ID, CUSTOMER_ID, 'person@example.com', expectedKey]);
    });

    test('skips the insert transaction for an empty audience', async () => {
        await seedPendingDispatchLogs(CAMPAIGN_ID, [], session);

        expect(tx.query).not.toHaveBeenCalled();
    });

    test('seeds multiple recipients with parameterized values', async () => {
        await seedPendingDispatchLogs(CAMPAIGN_ID, [
            { customer_id: CUSTOMER_ID, email: 'one@example.com' },
            { customer_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'two@example.com' },
        ], session);

        const [sql, values] = tx.query.mock.calls[0] as [string, unknown[]];
        expect(sql.match(/\(\$\d+, \$\d+, \$\d+, \$\d+, 'pending'\)/g)).toHaveLength(2);
        expect(values).toHaveLength(8);
    });

    test('transitions scheduled campaigns to sending under the row lock', async () => {
        tx.query
            .mockResolvedValueOnce({
                rows: [{
                    campaign_id: CAMPAIGN_ID,
                    segment_id: SEGMENT_ID,
                    template_id: TEMPLATE_ID,
                    status: 'scheduled',
                    dispatch_mode: 'scheduled',
                }],
            })
            .mockResolvedValueOnce({ rows: [{ campaign_id: CAMPAIGN_ID }] });

        const result = await claimCampaignForDispatch(CAMPAIGN_ID, 'scheduled', session);

        expect(tx.query.mock.calls[0]?.[0]).toContain('FOR UPDATE');
        expect(tx.query.mock.calls[1]?.[0]).toContain("SET status = 'sending'");
        expect(result).toMatchObject({ status: 'sending', dispatch_mode: 'scheduled' });
    });

    test('ignores a campaign that no longer exists', async () => {
        tx.query.mockResolvedValueOnce({ rows: [] });

        await expect(claimCampaignForDispatch(CAMPAIGN_ID, 'immediate', session))
            .resolves.toBeNull();
    });

    test('ignores a campaign whose dispatch mode does not match the trigger', async () => {
        tx.query.mockResolvedValueOnce({
            rows: [{
                campaign_id: CAMPAIGN_ID,
                segment_id: SEGMENT_ID,
                template_id: TEMPLATE_ID,
                status: 'sending',
                dispatch_mode: 'scheduled',
            }],
        });

        const result = await claimCampaignForDispatch(CAMPAIGN_ID, 'immediate', session);

        expect(result).toBeNull();
        expect(tx.query).toHaveBeenCalledTimes(1);
    });

    test('returns an already-sending campaign so a retry can resume pending jobs', async () => {
        const campaign = {
            campaign_id: CAMPAIGN_ID,
            segment_id: SEGMENT_ID,
            template_id: TEMPLATE_ID,
            status: 'sending',
            dispatch_mode: 'immediate',
        };
        tx.query.mockResolvedValueOnce({ rows: [campaign] });

        await expect(claimCampaignForDispatch(CAMPAIGN_ID, 'immediate', session))
            .resolves.toEqual(campaign);
    });

    test('reports a lost scheduled transition under the row lock', async () => {
        tx.query
            .mockResolvedValueOnce({
                rows: [{
                    campaign_id: CAMPAIGN_ID,
                    segment_id: SEGMENT_ID,
                    template_id: TEMPLATE_ID,
                    status: 'scheduled',
                    dispatch_mode: 'scheduled',
                }],
            })
            .mockResolvedValueOnce({ rows: [] });

        await expect(claimCampaignForDispatch(CAMPAIGN_ID, 'scheduled', session))
            .rejects.toThrow('could not transition from scheduled to sending');
    });

    test('loads still-pending jobs and repeats suppression filtering', async () => {
        const jobs = [{ email_log_id: 'log-1', campaign_id: CAMPAIGN_ID }];
        tx.query.mockResolvedValueOnce({ rows: jobs });

        await expect(listPendingDispatchJobs(CAMPAIGN_ID, session)).resolves.toEqual(jobs);
        expect(tx.query.mock.calls[0]?.[0]).toContain("l.send_status = 'pending'");
        expect(tx.query.mock.calls[0]?.[0]).toContain('FROM email_suppressions s');
    });

    test('marks accepted logs queued and skips empty id lists', async () => {
        await markDispatchLogsQueued([], session);
        expect(tx.query).not.toHaveBeenCalled();

        await markDispatchLogsQueued(['log-1'], session);
        expect(tx.query.mock.calls[0]?.[0]).toContain("SET send_status = 'queued'");
        expect(tx.query.mock.calls[0]?.[1]).toEqual([['log-1']]);
    });

    test('completes only a campaign still in sending and reports missing transition rows', async () => {
        tx.query.mockResolvedValueOnce({ rows: [{ campaign_id: CAMPAIGN_ID }] });
        await expect(completeCampaignDispatch(CAMPAIGN_ID, session)).resolves.toBeUndefined();
        expect(tx.query.mock.calls[0]?.[0]).toContain("SET status = 'completed'");

        tx.query.mockResolvedValueOnce({ rows: [] });
        await expect(completeCampaignDispatch(CAMPAIGN_ID, session))
            .rejects.toThrow('could not transition from sending to completed');
    });

    test('marks a campaign failed using either the supplied session or a new transaction', async () => {
        await failCampaignDispatch(CAMPAIGN_ID, session);
        expect(tx.query.mock.calls[0]?.[0]).toContain("SET status = 'failed'");

        await failCampaignDispatch(CAMPAIGN_ID);
        expect(runInTransactionMock).toHaveBeenCalledTimes(1);
    });

    test('delegates campaign locks to the shared advisory lock helper', async () => {
        const operation = jest.fn().mockResolvedValue('locked');

        await expect(withCampaignDispatchLock(CAMPAIGN_ID, operation)).resolves.toBe('locked');
        expect(withDatabaseAdvisoryLockMock).toHaveBeenCalledWith(
            `dispatcher:${CAMPAIGN_ID}`,
            operation,
        );
    });
});
