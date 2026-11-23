const numberFormat = new Intl.NumberFormat("en-US")

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** 0.0213 -> "2.13%"; null ("no data yet") -> "—" so it never looks like 0%. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(2)}%`
}

/** Threshold labels: 0.0005 -> "0.05%", 0.02 -> "2%". */
export function formatThreshold(rate: number): string {
  return `${Number((rate * 100).toFixed(2))}%`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
