/** HTTP-ready error carrying the contract's error envelope fields. */
export class ApiError extends Error {
    constructor(
        readonly statusCode: number,
        readonly code: string,
        message: string,
        readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** 404 per docs/api-contract.md §1.3 example (resource missing in Aurora). */
export class NotFoundError extends ApiError {
    constructor(entity: string, id: string) {
        super(
            404,
            'RESOURCE_NOT_FOUND',
            `${entity} with ID ${id} does not exist in Aurora database`,
            { field: `${entity}Id`, reason: 'UUID does not exist in Aurora database' },
        );
    }
}
