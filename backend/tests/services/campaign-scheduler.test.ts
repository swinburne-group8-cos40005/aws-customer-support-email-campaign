import { ResourceNotFoundException } from '@aws-sdk/client-scheduler';
import type {
    CreateScheduleCommand,
    DeleteScheduleCommand,
} from '@aws-sdk/client-scheduler';

import {
    createCampaignSchedule,
    deleteCampaignSchedule,
} from '#services/campaign-scheduler';



const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';
const _originalSchedulerEnvironment = {
    dispatcherArn: process.env.DISPATCHER_LAMBDA_ARN,
    groupName: process.env.SCHEDULER_GROUP_NAME,
    roleArn: process.env.SCHEDULER_ROLE_ARN,
};

const _setSchedulerEnvironment = (): void => {
    process.env.SCHEDULER_GROUP_NAME = 'csep-dispatch-dev';
    process.env.DISPATCHER_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:csep-dispatcher-dev';
    process.env.SCHEDULER_ROLE_ARN = 'arn:aws:iam::123456789012:role/csep-scheduler';
};

beforeEach(() => {
    _setSchedulerEnvironment();
});

afterEach(() => {
    jest.restoreAllMocks();
    if (_originalSchedulerEnvironment.groupName === undefined) {
        delete process.env.SCHEDULER_GROUP_NAME;
    } else {
        process.env.SCHEDULER_GROUP_NAME = _originalSchedulerEnvironment.groupName;
    }
    if (_originalSchedulerEnvironment.dispatcherArn === undefined) {
        delete process.env.DISPATCHER_LAMBDA_ARN;
    } else {
        process.env.DISPATCHER_LAMBDA_ARN = _originalSchedulerEnvironment.dispatcherArn;
    }
    if (_originalSchedulerEnvironment.roleArn === undefined) {
        delete process.env.SCHEDULER_ROLE_ARN;
    } else {
        process.env.SCHEDULER_ROLE_ARN = _originalSchedulerEnvironment.roleArn;
    }
});

describe('createCampaignSchedule', () => {
    test('creates a one-time schedule with the shared trigger payload and injected client', async () => {
        const send = jest.fn(async (_command: CreateScheduleCommand) => ({
            ScheduleArn: undefined,
            $metadata: {},
        }));

        await createCampaignSchedule(
            CAMPAIGN_ID,
            '2026-11-22T10:15:30.123+07:00',
            { send },
        );

        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            input: {
                Name: `campaign-${CAMPAIGN_ID}`,
                GroupName: 'csep-dispatch-dev',
                ScheduleExpression: 'at(2026-11-22T03:15:30)',
                ScheduleExpressionTimezone: 'UTC',
                FlexibleTimeWindow: { Mode: 'OFF' },
                ActionAfterCompletion: 'DELETE',
                Target: {
                    Arn: process.env.DISPATCHER_LAMBDA_ARN,
                    RoleArn: process.env.SCHEDULER_ROLE_ARN,
                    Input: JSON.stringify({ campaignId: CAMPAIGN_ID, trigger: 'scheduled' }),
                },
            },
        }));
    });

    test('reports missing deployment configuration and invalid timestamps', async () => {
        delete process.env.SCHEDULER_GROUP_NAME;
        await expect(createCampaignSchedule(CAMPAIGN_ID, '2026-11-22T03:15:30Z'))
            .rejects.toThrow('SCHEDULER_GROUP_NAME is required');

        _setSchedulerEnvironment();
        await expect(createCampaignSchedule(CAMPAIGN_ID, 'not-a-timestamp'))
            .rejects.toThrow('Invalid scheduledAt timestamp');
    });

});

describe('deleteCampaignSchedule', () => {
    test('deletes the deterministic schedule in the configured group', async () => {
        const send = jest.fn(async (_command: DeleteScheduleCommand) => ({ $metadata: {} }));

        await expect(deleteCampaignSchedule(
            CAMPAIGN_ID,
            { send },
        )).resolves.toBe(true);

        expect(send).toHaveBeenCalledWith(expect.objectContaining({
            input: {
                Name: `campaign-${CAMPAIGN_ID}`,
                GroupName: 'csep-dispatch-dev',
            },
        }));
    });

    test('treats a schedule that already executed or was deleted as absent', async () => {
        const send = jest.fn().mockRejectedValue(new ResourceNotFoundException({
            $metadata: { httpStatusCode: 404 },
            message: 'Schedule does not exist',
            Message: 'Schedule does not exist',
        }));

        await expect(deleteCampaignSchedule(
            CAMPAIGN_ID,
            { send },
        )).resolves.toBe(false);
    });

    test('surfaces non-not-found Scheduler failures', async () => {
        const send = jest.fn().mockRejectedValue(new Error('access denied'));

        await expect(deleteCampaignSchedule(
            CAMPAIGN_ID,
            { send },
        )).rejects.toThrow('access denied');
    });
});
