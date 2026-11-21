import {
    CreateScheduleCommand,
    DeleteScheduleCommand,
    ResourceNotFoundException,
    SchedulerClient,
} from '@aws-sdk/client-scheduler';
import type {
    CreateScheduleCommandOutput,
    DeleteScheduleCommandOutput,
} from '@aws-sdk/client-scheduler';



interface ScheduleCreator {
    send(command: CreateScheduleCommand): Promise<CreateScheduleCommandOutput>;
}

interface ScheduleDeleter {
    send(command: DeleteScheduleCommand): Promise<DeleteScheduleCommandOutput>;
}

const _schedulerClient: ScheduleCreator & ScheduleDeleter = new SchedulerClient({});

const _scheduleName = (campaignId: string): string => `campaign-${campaignId}`;

const _requiredEnvironmentValue = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required to manage campaign schedules`);
    }
    return value;
};

const _scheduleExpression = (scheduledAt: string): string => {
    const timestamp = new Date(scheduledAt);
    if (Number.isNaN(timestamp.getTime())) {
        throw new Error(`Invalid scheduledAt timestamp: ${scheduledAt}`);
    }
    return `at(${timestamp.toISOString().slice(0, 19)})`;
};

export const createCampaignSchedule = async (
    campaignId: string,
    scheduledAt: string,
    client: ScheduleCreator = _schedulerClient,
): Promise<void> => {
    const groupName = _requiredEnvironmentValue('SCHEDULER_GROUP_NAME');
    const functionArn = _requiredEnvironmentValue('DISPATCHER_LAMBDA_ARN');
    const roleArn = _requiredEnvironmentValue('SCHEDULER_ROLE_ARN');

    await client.send(new CreateScheduleCommand({
        Name: _scheduleName(campaignId),
        GroupName: groupName,
        ScheduleExpression: _scheduleExpression(scheduledAt),
        ScheduleExpressionTimezone: 'UTC',
        FlexibleTimeWindow: { Mode: 'OFF' },
        ActionAfterCompletion: 'DELETE',
        Target: {
            Arn: functionArn,
            RoleArn: roleArn,
            Input: JSON.stringify({ campaignId, trigger: 'scheduled' }),
        },
    }));
};

export const deleteCampaignSchedule = async (
    campaignId: string,
    client: ScheduleDeleter = _schedulerClient,
): Promise<boolean> => {
    const groupName = _requiredEnvironmentValue('SCHEDULER_GROUP_NAME');

    try {
        await client.send(new DeleteScheduleCommand({
            Name: _scheduleName(campaignId),
            GroupName: groupName,
        }));
        return true;
    } catch (error) {
        if (error instanceof ResourceNotFoundException) {
            return false;
        }
        throw error;
    }
};
