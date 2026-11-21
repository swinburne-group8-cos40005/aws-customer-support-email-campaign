import { handler } from '#handlers/dispatcher';
import { dispatchCampaign } from '#services/dispatcher.service';



jest.mock('#services/dispatcher.service', () => ({
    dispatchCampaign: jest.fn(),
}));

const dispatchCampaignMock = dispatchCampaign as jest.Mock;
const CAMPAIGN_ID = '33333333-3333-4000-8000-000000000009';

beforeEach(() => {
    dispatchCampaignMock.mockReset();
    dispatchCampaignMock.mockResolvedValue({
        campaignId: CAMPAIGN_ID,
        status: 'completed',
        queued: 2,
    });
});

describe('dispatcher handler', () => {
    test.each(['immediate', 'scheduled'] as const)(
        'forwards %s trigger contract to the dispatch service',
        async (trigger) => {
            await handler({ campaignId: CAMPAIGN_ID, trigger });

            expect(dispatchCampaignMock).toHaveBeenCalledWith({
                campaignId: CAMPAIGN_ID,
                dispatchMode: trigger,
            });
        },
    );

    test('accepts a Scheduler event with a JSON detail payload', async () => {
        await handler({
            source: 'aws.scheduler',
            detail: JSON.stringify({ campaignId: CAMPAIGN_ID, trigger: 'scheduled' }),
        });

        expect(dispatchCampaignMock).toHaveBeenCalledWith({
            campaignId: CAMPAIGN_ID,
            dispatchMode: 'scheduled',
        });
    });

    test('accepts a Scheduler event with an object detail payload', async () => {
        await handler({
            source: 'aws.scheduler',
            detail: { campaignId: CAMPAIGN_ID, trigger: 'scheduled' },
        });

        expect(dispatchCampaignMock).toHaveBeenCalledWith({
            campaignId: CAMPAIGN_ID,
            dispatchMode: 'scheduled',
        });
    });

    test('rejects events that do not match the trigger contract', async () => {
        await expect(handler({ campaignId: CAMPAIGN_ID })).rejects.toThrow('Invalid Dispatcher trigger');
        expect(dispatchCampaignMock).not.toHaveBeenCalled();
    });
});
