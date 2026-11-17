import type { Queryable } from '#db/connection';




/**
 * Tables a repository caller may probe for existence. The union type is
 * the guard: unlike stringly-typed helpers, it makes it impossible to
 * smuggle request input into the SQL text.
 */
export type CatalogTable = 'templates' | 'segments';

const COLUMN_BY_TABLE: Record<CatalogTable, 'template_id' | 'segment_id'> = {
    templates: 'template_id',
    segments: 'segment_id',
};

/**
 * Plain existence probe for a catalog table — returns the answer instead
 * of throwing, so the service layer owns the 404 decision. Call inside a
 * transaction on purpose: FK rows are checked at write time so the
 * campaign and the missing reference cannot disagree between check and
 * insert.
 *
 * @param tx - Open transaction to run the probe on.
 * @param table - Which catalog table to probe ('templates' | 'segments').
 * @param id - Primary key to look for.
 *
 * @returns True when at least one row matches the id.
 *
 * @example
 * const templateExists = await checkCatalogExists(tx, 'templates', TEMPLATE_ID)
 * console.log(templateExists) // Output: true when the row exists
 *                             //         false when it does not
 */
export const checkCatalogExists = async (
    tx: Queryable,
    table: CatalogTable,
    id: string,
): Promise<boolean> => {
    const column = COLUMN_BY_TABLE[table];

    const sql = `SELECT 1 AS found
                 FROM ${table}
                 WHERE ${column} = $1`;

    const result = await tx.query(sql, [id]);

    return result.rows.length > 0;
};
