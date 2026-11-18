/**
 * Domain-level errors. They carry the contract's HTTP fields
 * (docs/api-contract.md §1.3) so the error-mapping step can map them
 * one-to-one;
 * repositories and services throw them without knowing about HTTP.
 */
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

/** 400 with the contract's { field, reason } details shape. */
export class ValidationError extends ApiError {
    constructor(field: string, reason: string) {
        super(400, 'VALIDATION_ERROR', reason, { field, reason });
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

/** 401 — raised by resolveAuthenticatedUser when Cognito claims are missing. */
export class UnauthorizedError extends ApiError {
    constructor() {
        super(401, 'UNAUTHORIZED', 'A valid Cognito ID token is required.');
    }
}

/**
 * 409 — the resource exists but its current state forbids the requested
 * transition (e.g. editing a campaign that is no longer a draft). The
 * allowed transitions live in docs/email-state-machine.md §1.2.
 */
export class ConflictError extends ApiError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(409, 'CONFLICT', message, details);
    }
}
