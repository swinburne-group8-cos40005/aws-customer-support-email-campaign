import { useCallback, useEffect, useState } from "react"
import { ApiRequestError } from "@/api/client"

export type ApiResource<T> = {
  data: T | null
  error: ApiRequestError | null
  loading: boolean
  reload: () => void
}

/**
 * Loads one API resource and exposes loading / error / reload.
 * `load` must be stable (wrap it in useCallback); a change refetches and
 * aborts the request still in flight. `enabled: false` keeps it idle.
 */
export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiRequestError | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    load(controller.signal)
      .then((result) => {
        setData(result)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(
          err instanceof ApiRequestError
            ? err
            : new ApiRequestError(0, "UNKNOWN", "Something went wrong while loading the data."),
        )
        setLoading(false)
      })
    return () => controller.abort()
  }, [load, enabled, reloadKey])

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  return { data, error, loading, reload }
}
