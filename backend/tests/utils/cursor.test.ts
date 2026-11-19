import { decodeAuditCursor, encodeAuditCursor } from '#utils/cursor';




const CURSOR = {
    createdAt: '2026-10-25T14:30:00.000Z',
    auditLogId: 'e1f2a3b4-5678-40ab-cdef-1234567890ab',
};

describe('encodeAuditCursor / decodeAuditCursor', () => {
    test('round-trips a keyset position through base64url', () => {
        const encoded = encodeAuditCursor(CURSOR);

        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(decodeAuditCursor(encoded)).toEqual(CURSOR);
    });

    test('throws a 400 validation error for text that is not base64 JSON', () => {
        expect(() => decodeAuditCursor('not-a-cursor')).toThrow(
            expect.objectContaining({
                statusCode: 400,
                code: 'VALIDATION_ERROR',
                details: { field: 'cursor', reason: expect.any(String) },
            }),
        );
    });

    test('throws a 400 validation error when the payload is valid JSON but not a cursor', () => {
        const encoded = Buffer.from(JSON.stringify({ hello: 'world' }), 'utf8')
            .toString('base64url');

        expect(() => decodeAuditCursor(encoded)).toThrow(
            expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }),
        );
    });

    test('rejects a cursor whose id is not a UUID', () => {
        const encoded = Buffer.from(
            JSON.stringify({ createdAt: CURSOR.createdAt, id: 'not-a-uuid' }),
            'utf8',
        ).toString('base64url');

        expect(() => decodeAuditCursor(encoded)).toThrow(
            expect.objectContaining({ statusCode: 400 }),
        );
    });

    test('rejects a cursor whose timestamp is not ISO 8601', () => {
        const encoded = Buffer.from(
            JSON.stringify({ createdAt: 'yesterday', id: CURSOR.auditLogId }),
            'utf8',
        ).toString('base64url');

        expect(() => decodeAuditCursor(encoded)).toThrow(
            expect.objectContaining({ statusCode: 400 }),
        );
    });
});
