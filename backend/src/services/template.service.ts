import type {
    CreateTemplateInput,
    TemplateRow,
    UpdateTemplateInput,
} from '#repositories/template.repository';

import { runInTransaction } from '#db/connection';

import { insertAuditRecord } from '#repositories/audit-log.repository';

import {
    countCampaignsUsingTemplate,
    deleteTemplateRow,
    findTemplateRowById,
    findTemplateRowForUpdate,
    insertTemplateRow,
    listTemplateRows,
    mapTemplateRowToResponse,
    updateTemplateRow,
} from '#repositories/template.repository';

import { ConflictError, NotFoundError } from '#utils/errors';




/**
 * The audit snapshot recorded before/after every template mutation
 * (docs/audit-log-strategy.md §4).
 *
 * @param row - Template row before or after the mutation.
 *
 * @returns The snapshot stored in audit_logs.changes.
 *
 * @example
 * const snapshot = _toTemplateAuditSnapshot(row)
 * console.log(snapshot.subjectTemplate) // Output: 'Black Friday starts now'
 */
const _toTemplateAuditSnapshot = (row: TemplateRow) => ({
    name: row.name,
    subjectTemplate: row.subject_template,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
});

/** POST /templates command: the validated content plus the caller's identity. */
export interface CreateTemplateCommand extends CreateTemplateInput {
    userId: string;
}

/** PUT /templates/{id} command: the patch plus who is applying it. */
export interface UpdateTemplateCommand extends UpdateTemplateInput {
    templateId: string;
    userId: string;
}

/** GET /templates envelope — docs/api-contract.md §2.2 asks for the list. */
export interface TemplateListResult {
    data: ReturnType<typeof mapTemplateRowToResponse>[];
}

/**
 * Lists every template (docs/api-contract.md §2.2).
 *
 * @returns `{ data }` with the templates, newest first.
 *
 * @example
 * const result = await listTemplates()
 * console.log(result.data.length) // Output: 4
 */
export const listTemplates = async (): Promise<TemplateListResult> => {
    const rows = await listTemplateRows();

    return { data: rows.map(mapTemplateRowToResponse) };
};

/**
 * Reads one template by id.
 *
 * @param templateId - Template UUID from the path.
 *
 * @returns The template in contract field names.
 *
 * @throws NotFoundError When the template does not exist.
 *
 * @example
 * const template = await getTemplate('22222222-2222-4000-8000-000000000001')
 * console.log(template.subjectTemplate) // Output: 'Black Friday starts now'
 */
export const getTemplate = async (templateId: string) => {
    const row = await findTemplateRowById(templateId);
    if (!row) {
        throw new NotFoundError('template', templateId);
    }

    return mapTemplateRowToResponse(row);
};

/**
 * Creates a template and its `create` audit row in one transaction.
 *
 * @param command - Validated content plus the caller's identity.
 *
 * @returns The stored template row.
 *
 * @example
 * const row = await createTemplate({
 *     name: 'Black Friday Announcement',
 *     subjectTemplate: 'Black Friday starts now',
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(row.template_id) // Output: '22222222-2222-4000-8000-000000000009'
 */
export const createTemplate = async (command: CreateTemplateCommand): Promise<TemplateRow> => {
    return runInTransaction(async (tx) => {
        const row = await insertTemplateRow(tx, {
            name: command.name,
            subjectTemplate: command.subjectTemplate,
            bodyHtml: command.bodyHtml,
            bodyText: command.bodyText,
        });

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'create',
            entityType: 'template',
            entityId: row.template_id,
            changes: {
                before: null,
                after: _toTemplateAuditSnapshot(row),
            },
        });

        return row;
    });
};

/**
 * Updates template content. Templates have no state gate: editing a
 * subject or body never affects emails already handed to SES, because
 * the Worker renders the template at send time.
 *
 * @param command - Template id, the partial patch, and the caller's identity.
 *
 * @returns The updated template row.
 *
 * @throws NotFoundError When the template does not exist.
 *
 * @example
 * const row = await updateTemplate({
 *     templateId: '22222222-2222-4000-8000-000000000001',
 *     subjectTemplate: 'Last chance: Black Friday',
 *     userId: '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f',
 * })
 * console.log(row.subject_template) // Output: 'Last chance: Black Friday'
 */
export const updateTemplate = async (command: UpdateTemplateCommand): Promise<TemplateRow> => {
    return runInTransaction(async (tx) => {
        const existing = await findTemplateRowForUpdate(tx, command.templateId);
        if (!existing) {
            throw new NotFoundError('template', command.templateId);
        }

        const updated = await updateTemplateRow(tx, command.templateId, {
            name: command.name,
            subjectTemplate: command.subjectTemplate,
            bodyHtml: command.bodyHtml,
            bodyText: command.bodyText,
        });

        // The row is locked, so a null result here is a driver defect.
        if (!updated) {
            throw new Error('template UPDATE after row lock produced no row');
        }

        await insertAuditRecord(tx, {
            userId: command.userId,
            action: 'update',
            entityType: 'template',
            entityId: command.templateId,
            changes: {
                before: _toTemplateAuditSnapshot(existing),
                after: _toTemplateAuditSnapshot(updated),
            },
        });

        return updated;
    });
};

/**
 * Deletes an **unused** template (docs/api-contract.md §2.2). A
 * template still referenced by a campaign answers 409: deleting it
 * would orphan dispatch history, and the FK is ON DELETE RESTRICT
 * (db/schema.sql).
 *
 * @param templateId - Template UUID from the path.
 * @param userId - Caller identity for the `delete` audit row.
 *
 * @throws NotFoundError When the template does not exist.
 * @throws ConflictError When at least one campaign references it.
 *
 * @example
 * await deleteTemplate('22222222-2222-4000-8000-000000000004', '9f1c2a34-56b7-4c8d-9e0f-1a2b3c4d5e6f')
 * console.log('deleted') // Output: 'deleted' — 204, or a 404/409 envelope
 */
export const deleteTemplate = async (
    templateId: string,
    userId: string,
): Promise<void> => {
    await runInTransaction(async (tx) => {
        const existing = await findTemplateRowForUpdate(tx, templateId);
        if (!existing) {
            throw new NotFoundError('template', templateId);
        }

        const usageCount = await countCampaignsUsingTemplate(templateId);
        if (usageCount > 0) {
            throw new ConflictError(
                `Template ${templateId} is used by ${usageCount} campaign(s) and cannot be deleted.`,
                { field: 'templateId', reason: 'template is still referenced by campaigns' },
            );
        }

        const deleted = await deleteTemplateRow(tx, templateId);
        if (!deleted) {
            throw new Error('template DELETE after row lock deleted no row');
        }

        await insertAuditRecord(tx, {
            userId,
            action: 'delete',
            entityType: 'template',
            entityId: templateId,
            changes: {
                before: _toTemplateAuditSnapshot(existing),
                after: null,
            },
        });
    });
};

export { mapTemplateRowToResponse };
