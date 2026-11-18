import type { Queryable } from '#db/connection';
import { runReadQuery } from '#db/connection';




/** Shape of the `templates` table row this repository reads/writes. */
export interface TemplateRow {
    template_id: string;
    name: string;
    subject_template: string;
    body_text: string | null;
    body_html: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateTemplateInput {
    name: string;
    subjectTemplate: string;
    bodyHtml?: string;
    bodyText?: string;
}

export interface UpdateTemplateInput {
    name?: string;
    subjectTemplate?: string;
    bodyHtml?: string;
    bodyText?: string;
}

const _TEMPLATE_COLUMNS = `template_id, name, subject_template, body_text, body_html,
                           created_at, updated_at`;

/**
 * Inserts one email template. No state gate exists for templates —
 * they are editable content, unlike campaigns (docs/email-state-machine.md).
 *
 * @param tx - Open transaction to run the INSERT on.
 * @param input - Validated template content.
 *
 * @returns The stored row as promised by the RETURNING clause.
 *
 * @throws Error When RETURNING yields no row — a driver/PG defect.
 *
 * @example
 * const row = await insertTemplateRow(tx, {
 *     name: 'Black Friday Announcement',
 *     subjectTemplate: 'Black Friday starts now',
 *     bodyHtml: '<p>Hello {{firstName}}</p>',
 * })
 * console.log(row.name) // Output: 'Black Friday Announcement'
 */
export const insertTemplateRow = async (
    tx: Queryable,
    input: CreateTemplateInput,
): Promise<TemplateRow> => {
    const result = await tx.query(
        `INSERT INTO templates (name, subject_template, body_html, body_text)
         VALUES ($1, $2, $3, $4)
         RETURNING ${_TEMPLATE_COLUMNS}`,
        [input.name, input.subjectTemplate, input.bodyHtml ?? null, input.bodyText ?? null],
    );

    const row = result.rows[0];
    if (!row) {
        throw new Error('template INSERT RETURNING produced no row');
    }

    return row as unknown as TemplateRow;
};

/**
 * Reads one template and locks it until the transaction ends, so an
 * update or delete cannot interleave with another writer.
 *
 * @param tx - Open transaction performing the mutation.
 * @param templateId - Primary key to lock.
 *
 * @returns The stored row, or null when the id does not exist.
 *
 * @example
 * const row = await findTemplateRowForUpdate(tx, templateId)
 * console.log(row?.name) // Output: 'Black Friday Announcement'
 */
export const findTemplateRowForUpdate = async (
    tx: Queryable,
    templateId: string,
): Promise<TemplateRow | null> => {
    const result = await tx.query(
        `SELECT ${_TEMPLATE_COLUMNS}
         FROM templates
         WHERE template_id = $1
         FOR UPDATE`,
        [templateId],
    );

    return (result.rows[0] as unknown as TemplateRow | undefined) ?? null;
};

/**
 * Reads one template without locking — GET /v1/templates/{id}.
 *
 * @param templateId - Primary key to look for.
 *
 * @returns The stored row, or null when it does not exist.
 *
 * @example
 * const row = await findTemplateRowById(templateId)
 * console.log(row?.subject_template) // Output: 'Black Friday starts now'
 */
export const findTemplateRowById = async (templateId: string): Promise<TemplateRow | null> => {
    const result = await runReadQuery(
        `SELECT ${_TEMPLATE_COLUMNS}
         FROM templates
         WHERE template_id = $1`,
        [templateId],
    );

    return (result.rows[0] as unknown as TemplateRow | undefined) ?? null;
};

/**
 * Lists every template, newest first. The contract asks for "all
 * templates" (docs/api-contract.md §2.2) — no pagination block — so the
 * table is read in one statement.
 *
 * @returns Every template row, possibly empty.
 *
 * @example
 * const rows = await listTemplateRows()
 * console.log(rows.length) // Output: 4
 */
export const listTemplateRows = async (): Promise<TemplateRow[]> => {
    const result = await runReadQuery(
        `SELECT ${_TEMPLATE_COLUMNS}
         FROM templates
         ORDER BY created_at DESC, template_id DESC`,
    );

    return result.rows as unknown as TemplateRow[];
};

/**
 * Applies a partial update to a template. Omitted fields keep their
 * stored value; an empty string clears a body but not the name/subject
 * (validation already rejects blank values for those two).
 *
 * @param tx - Open transaction holding the row lock.
 * @param templateId - Primary key to update.
 * @param input - Fields to change; undefined entries are left untouched.
 *
 * @returns The updated row, or null when the template disappeared.
 *
 * @example
 * const row = await updateTemplateRow(tx, templateId, { subjectTemplate: 'Last chance' })
 * console.log(row?.subject_template) // Output: 'Last chance'
 */
export const updateTemplateRow = async (
    tx: Queryable,
    templateId: string,
    input: UpdateTemplateInput,
): Promise<TemplateRow | null> => {
    const result = await tx.query(
        `UPDATE templates
         SET name = COALESCE($2::varchar, name),
             subject_template = COALESCE($3::varchar, subject_template),
             body_html = COALESCE($4::text, body_html),
             body_text = COALESCE($5::text, body_text)
         WHERE template_id = $1
         RETURNING ${_TEMPLATE_COLUMNS}`,
        [
            templateId,
            input.name ?? null,
            input.subjectTemplate ?? null,
            input.bodyHtml ?? null,
            input.bodyText ?? null,
        ],
    );

    return (result.rows[0] as unknown as TemplateRow | undefined) ?? null;
};

/**
 * Deletes one template. The caller must already have checked that no
 * campaign references it — the FK is ON DELETE RESTRICT (db/schema.sql),
 * so a referenced template would raise instead of silently cascading.
 *
 * @param tx - Open transaction holding the row lock.
 * @param templateId - Primary key to delete.
 *
 * @returns True when a row was deleted.
 *
 * @example
 * const deleted = await deleteTemplateRow(tx, templateId)
 * console.log(deleted) // Output: true
 */
export const deleteTemplateRow = async (
    tx: Queryable,
    templateId: string,
): Promise<boolean> => {
    const result = await tx.query(
        `DELETE FROM templates
         WHERE template_id = $1`,
        [templateId],
    );

    return (result.rowCount ?? 0) > 0;
};

/**
 * Counts campaigns that still reference a template. DELETE
 * /v1/templates/{id} is specified as "delete unused template", so a
 * non-zero count answers 409 instead of hitting the FK restriction.
 *
 * @param templateId - Template whose usage to count.
 *
 * @returns Number of campaigns pointing at the template.
 *
 * @example
 * const usage = await countCampaignsUsingTemplate(templateId)
 * console.log(usage) // Output: 2 — the template cannot be deleted
 */
export const countCampaignsUsingTemplate = async (templateId: string): Promise<number> => {
    const result = await runReadQuery(
        `SELECT COUNT(*) AS count
         FROM campaigns
         WHERE template_id = $1`,
        [templateId],
    );

    const row = result.rows[0];
    return row ? Number(row.count) : 0;
};

/**
 * Maps a template row onto the camelCase contract body
 * (docs/api-contract.md §2.2).
 *
 * @param row - Row read from the templates table.
 *
 * @returns Template fields exactly as the contract names them.
 *
 * @example
 * const body = mapTemplateRowToResponse(row)
 * console.log(body.subjectTemplate) // Output: 'Black Friday starts now'
 */
export const mapTemplateRowToResponse = (row: TemplateRow) => ({
    templateId: row.template_id,
    name: row.name,
    subjectTemplate: row.subject_template,
    bodyHtml: row.body_html,
    bodyText: row.body_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
