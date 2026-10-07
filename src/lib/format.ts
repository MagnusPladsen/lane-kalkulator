import { currentLang, INTL_LOCALE } from "@/i18n"

type Formatters = {
  money: Intl.NumberFormat
  num: Intl.NumberFormat
  monthYear: Intl.DateTimeFormat
  fullDate: Intl.DateTimeFormat
  dateTime: Intl.DateTimeFormat
}

const cache = new Map<string, Formatters>()

function f(): Formatters {
  const locale = INTL_LOCALE[currentLang()]
  let c = cache.get(locale)
  if (!c) {
    c = {
      money: new Intl.NumberFormat(locale, { style: "currency", currency: "NOK", maximumFractionDigits: 0 }),
      num: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      monthYear: new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }),
      fullDate: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }),
      dateTime: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    }
    cache.set(locale, c)
  }
  return c
}

export function fmtMoney(n: number): string {
  return f().money.format(Math.round(n) || 0)
}

export function fmtNumber(n: number): string {
  return f().num.format(Math.round(n) || 0)
}

export function fmtRate(pct: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[currentLang()], { maximumFractionDigits: 2 }).format(pct)
}

/** "+12 300 kr" / "−12 300 kr" / "±0 kr" */
export function fmtSignedMoney(n: number): string {
  const r = Math.round(n) || 0
  if (r === 0) return "±" + fmtMoney(0)
  return (r > 0 ? "+" : "−") + fmtMoney(Math.abs(r))
}

/** Translator shape we need; avoids importing react-i18next's full TFunction type here. */
export type Tr = (key: string, opts?: Record<string, unknown>) => string

/** 38 → "3 yrs 2 mo" in the current language. */
export function fmtDuration(months: number, t: Tr): string {
  const m = Math.abs(Math.round(months)) || 0
  const y = Math.floor(m / 12)
  const rest = m % 12
  const parts: string[] = []
  if (y) parts.push(t("duration.years", { count: y }))
  if (rest || !y) parts.push(t("duration.months", { count: rest }))
  return parts.join(" ")
}

function toDate(iso: string): Date | undefined {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function fmtMonthYear(iso: string): string {
  const d = toDate(iso)
  return d ? f().monthYear.format(d) : "–"
}

export function fmtDate(iso: string): string {
  const d = toDate(iso)
  return d ? f().fullDate.format(d) : "–"
}

/** Local date and time of an ISO timestamp. */
export function fmtDateTime(iso: string): string {
  const d = toDate(iso)
  return d ? f().dateTime.format(d) : "–"
}
