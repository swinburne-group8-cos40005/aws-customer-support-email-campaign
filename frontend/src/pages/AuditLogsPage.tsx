import { useCallback, useEffect, useState } from "react"
import {
  getAuditLogs,
  type AuditLog,
} from "@/services/auditLogs"
import { PageIntro } from "@/components/ui/PageIntro"

const PAGE_SIZE = 20

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

function ChangesView({ changes }: { changes: AuditLog["changes"] }) {
  if (!changes || Object.keys(changes).length === 0) {
    return (
      <p className="text-xs text-[#777382]">
        No change details were recorded.
      </p>
    )
  }

  const before = changes.before
  const after = changes.after

  if (!before && !after) {
    return (
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-[#F7F6F9] p-3 text-xs">
        {JSON.stringify(changes, null, 2)}
      </pre>
    )
  }

  const fields = Array.from(
    new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]),
  )

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const oldValue = before?.[field]
        const newValue = after?.[field]

        return (
          <div
            className="grid gap-2 rounded-lg bg-[#F7F6F9] p-3 sm:grid-cols-2"
            key={field}
          >
            <div>
              <p className="text-[10px] font-semibold uppercase text-[#777382]">
                {field} · Before
              </p>
              <p className="mt-1 break-words text-xs text-[#403C49]">
                {oldValue === undefined
                  ? "—"
                  : typeof oldValue === "object"
                    ? JSON.stringify(oldValue)
                    : String(oldValue)}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase text-[#777382]">
                {field} · After
              </p>
              <p className="mt-1 break-words text-xs text-[#403C49]">
                {newValue === undefined
                  ? "—"
                  : typeof newValue === "object"
                    ? JSON.stringify(newValue)
                    : String(newValue)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [entityType, setEntityType] = useState("")
  const [entityId, setEntityId] = useState("")
  const [userId, setUserId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])
  const [page, setPage] = useState(0)

  const loadLogs = useCallback(async (cursor?: string) => {
    setLoading(true)
    setError("")

    try {
      const result = await getAuditLogs({
        entityType: entityType || undefined,
        entityId: entityId.trim() || undefined,
        userId: userId.trim() || undefined,
        cursor,
        limit: PAGE_SIZE,
      })

      setLogs(result.data)
      setNextCursor(result.nextCursor)
    } catch (err) {
      setLogs([])
      setNextCursor(null)
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load audit logs.",
      )
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId, userId])

  useEffect(() => {
    setPage(0)
    setCursorHistory([])
    void loadLogs()
  }, [loadLogs])

  function goToNextPage() {
    if (!nextCursor) return

    setCursorHistory((history) => [...history, nextCursor])
    setPage((current) => current + 1)
    void loadLogs(nextCursor)
  }

  function goToPreviousPage() {
    if (page === 0) return

    const history = cursorHistory.slice(0, -1)
    const previousCursor = history[history.length - 1]

    setCursorHistory(history)
    setPage((current) => current - 1)
    void loadLogs(previousCursor)
  }

  function resetFilters() {
    setEntityType("")
    setEntityId("")
    setUserId("")
  }

  return (
    <main className="mx-auto max-w-[1060px] px-5 py-8 sm:px-8 sm:py-10">
      <PageIntro
        eyebrow="Compliance"
        title="Audit Logs"
        description="Review recorded changes to campaigns, templates, and customer preferences."
      />

      <section className="mt-7 rounded-2xl border border-[#E3E1E7] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#302D37]">
          Filter audit records
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-[#625E6B]">
            Entity type
            <select
              className="field mt-2"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
            >
              <option value="">All entity types</option>
              <option value="campaign">Campaign</option>
              <option value="template">Template</option>
              <option value="segment">Segment</option>
              <option value="customer_preference">
                Customer preference
              </option>
            </select>
          </label>

          <label className="text-xs font-medium text-[#625E6B]">
            Entity ID
            <input
              className="field mt-2"
              placeholder="Enter entity ID"
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
            />
          </label>

          <label className="text-xs font-medium text-[#625E6B]">
            User ID
            <input
              className="field mt-2"
              placeholder="Enter Cognito user ID"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              setPage(0)
              setCursorHistory([])
              void loadLogs()
            }}
          >
            Apply filters
          </button>

          <button
            className="rounded-lg border border-[#DEDCE3] px-4 py-2 text-xs font-semibold text-[#625E6B]"
            onClick={resetFilters}
          >
            Clear filters
          </button>

          <button
            className="rounded-lg border border-[#DEDCE3] px-4 py-2 text-xs font-semibold text-[#625E6B]"
            onClick={() => void loadLogs(
              cursorHistory[cursorHistory.length - 1],
            )}
          >
            Refresh
          </button>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#E3E1E7] bg-white">
        <div className="flex items-center justify-between border-b border-[#ECEAEF] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#302D37]">
              Recorded activities
            </h2>
            <p className="mt-1 text-xs text-[#777382]">
              {logs.length} records on this page
            </p>
          </div>
          <span className="text-xs text-[#777382]">
            Page {page + 1}
          </span>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-[#777382]">
            Loading audit records...
          </p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#777382]">
            No audit records found.
          </p>
        ) : (
          <div className="divide-y divide-[#ECEAEF]">
            {logs.map((log) => (
              <article className="p-5 sm:p-6" key={log.audit_log_id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#FEE2E2] px-3 py-1 text-[10px] font-bold uppercase text-[#B91C1C]">
                      {log.action}
                    </span>
                    <span className="text-xs font-semibold text-[#403C49]">
                      {log.entity_type}
                    </span>
                  </div>

                  <time className="text-xs text-[#777382]">
                    {formatDate(log.created_at)}
                  </time>
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <p className="break-all text-[#625E6B]">
                    <strong className="text-[#403C49]">User:</strong>{" "}
                    {log.user_id}
                  </p>
                  <p className="break-all text-[#625E6B]">
                    <strong className="text-[#403C49]">Entity ID:</strong>{" "}
                    {log.entity_id}
                  </p>
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold text-[#B91C1C]">
                    View changes
                  </summary>
                  <div className="mt-3">
                    <ChangesView changes={log.changes} />
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#ECEAEF] px-5 py-4">
          <button
            className="rounded-lg border border-[#DEDCE3] px-4 py-2 text-xs font-semibold text-[#625E6B] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page === 0 || loading}
            onClick={goToPreviousPage}
          >
            Previous
          </button>

          <button
            className="rounded-lg bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!nextCursor || loading}
            onClick={goToNextPage}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  )
}
