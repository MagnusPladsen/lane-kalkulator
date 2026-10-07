const nok = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  maximumFractionDigits: 0,
})
const num = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 })
const compactNum = new Intl.NumberFormat("nb-NO", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function fmtMoney(n: number): string {
  return nok.format(Math.round(n))
}

export function fmtNumber(n: number): string {
  return num.format(Math.round(n))
}

export function fmtCompact(n: number): string {
  return compactNum.format(n)
}

/** "+12 300 kr" / "−12 300 kr" */
export function fmtSignedMoney(n: number): string {
  const r = Math.round(n)
  if (r === 0) return "±0 kr"
  return (r > 0 ? "+" : "−") + nok.format(Math.abs(r))
}

/** 38 → "3 yrs 2 mo", 12 → "1 yr", 0 → "0 mo" */
export function fmtDuration(months: number): string {
  const m = Math.abs(Math.round(months))
  const y = Math.floor(m / 12)
  const rest = m % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? "yr" : "yrs"}`)
  if (rest || !y) parts.push(`${rest} mo`)
  return parts.join(" ")
}

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" })
const fullDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })

export function fmtMonthYear(iso: string): string {
  return monthYear.format(new Date(iso + "T00:00:00"))
}

export function fmtDate(iso: string): string {
  return fullDate.format(new Date(iso + "T00:00:00"))
}
