import { statsOverviewQuerySchema } from '#schemas/stats.schema';




describe('statsOverviewQuerySchema', () => {
    test('defaults limit to 10 when absent', () => {
        expect(statsOverviewQuerySchema.parse({})).toEqual({ limit: 10 });
    });

    test('coerces the limit string sent by API Gateway', () => {
        expect(statsOverviewQuerySchema.parse({ limit: '25' })).toEqual({ limit: 25 });
    });

    test.each(['0', '51', '2.5', 'abc'])('rejects limit %p', (limit) => {
        expect(statsOverviewQuerySchema.safeParse({ limit }).success).toBe(false);
    });
});
