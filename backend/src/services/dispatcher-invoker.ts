import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import type { InvokeCommandOutput } from '@aws-sdk/client-lambda';



interface DispatcherInvokeClient {
    send(command: InvokeCommand): Promise<InvokeCommandOutput>;
}

const _lambdaClient: DispatcherInvokeClient = new LambdaClient({});

export const invokeDispatcherAsynchronously = async (
    campaignId: string,
    client: DispatcherInvokeClient = _lambdaClient,
): Promise<void> => {
    const functionArn = process.env.DISPATCHER_LAMBDA_ARN;
    if (!functionArn) {
        throw new Error('DISPATCHER_LAMBDA_ARN is required to invoke the Dispatcher');
    }

    const result = await client.send(new InvokeCommand({
        FunctionName: functionArn,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
            campaignId,
            trigger: 'immediate',
        })),
    }));

    if (result.StatusCode !== 202) {
        throw new Error(`Dispatcher async invocation returned unexpected status ${result.StatusCode}`);
    }
};
