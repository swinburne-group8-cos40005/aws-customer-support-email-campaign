import { z } from 'zod';

import type { DispatchMode } from '#repositories/dispatcher.repository';

import { dispatchCampaign } from '#services/dispatcher.service';



const _triggerSchema = z.object({
    campaignId: z.string().uuid(),
    trigger: z.enum(['scheduled', 'immediate']),
});

const _parseTrigger = (event: unknown): { campaignId: string; dispatchMode: DispatchMode } => {
    if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        throw new Error('Dispatcher event must be an object');
    }

    const envelope = event as Record<string, unknown>;
    let payload: unknown = envelope;
    if (envelope.detail !== undefined) {
        payload = typeof envelope.detail === 'string'
            ? JSON.parse(envelope.detail)
            : envelope.detail;
    }

    const parsed = _triggerSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(`Invalid Dispatcher trigger: ${parsed.error.message}`);
    }

    return {
        campaignId: parsed.data.campaignId,
        dispatchMode: parsed.data.trigger,
    };
};

/** Handler matches infra/dispatcher.yaml's DispatcherHandler (`dispatcher.handler`). */
export const handler = async (event: unknown) => dispatchCampaign(_parseTrigger(event));
