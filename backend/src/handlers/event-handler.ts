import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';

import { processSesFeedbackRecord } from '#services/ses-feedback.service';



export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

    for (const record of event.Records) {
        try {
            await processSesFeedbackRecord(record);
        } catch (error) {
            console.error('Failed to process SES feedback SQS record', {
                messageId: record.messageId,
                error,
            });
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }

    return { batchItemFailures };
};
