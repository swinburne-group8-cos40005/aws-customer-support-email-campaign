import type {
    SendMessageBatchCommandInput,
    SendMessageBatchCommandOutput,
} from '@aws-sdk/client-sqs';

import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';

import type { SendQueueBatchResult, SendQueueEntry } from '#services/dispatcher.service';



interface DispatcherSqsClient {
    send(command: SendMessageBatchCommand): Promise<SendMessageBatchCommandOutput>;
}

const _sqsClient: DispatcherSqsClient = new SQSClient({});

export const sendQueueBatch = async (
    entries: SendQueueEntry[],
    client: DispatcherSqsClient = _sqsClient,
): Promise<SendQueueBatchResult> => {
    if (entries.length === 0 || entries.length > 10) {
        throw new RangeError('SQS SendMessageBatch requires between 1 and 10 entries');
    }

    const queueUrl = process.env.SEND_QUEUE_URL;
    if (!queueUrl) {
        throw new Error('SEND_QUEUE_URL is required to dispatch campaign jobs');
    }

    const input: SendMessageBatchCommandInput = {
        QueueUrl: queueUrl,
        Entries: entries,
    };
    const result = await client.send(new SendMessageBatchCommand(input));

    return {
        Successful: result.Successful ?? [],
        Failed: result.Failed ?? [],
    };
};
