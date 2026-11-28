export function localDateTimeToUtcIso(date: string, time: string): string {
  if (!date || !time) throw new Error("Choose both a date and a time.")
  const localDate = new Date(`${date}T${time}`)
  if (Number.isNaN(localDate.getTime())) {
    throw new Error("The selected schedule date or time is invalid.")
  }
  return localDate.toISOString()
}

/** Convert an API UTC timestamp into values suitable for local date/time inputs. */
export function utcIsoToLocalDateTime(value: string): { date: string; time: string } {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" }
  const pad = (part: number) => String(part).padStart(2, "0")
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  }
}

export function getTomorrowDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
