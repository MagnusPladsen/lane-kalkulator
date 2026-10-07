import { uid } from "../ids"
import { addMonths, isValidIsoDate, isValidYearMonth, monthsElapsed, todayIso, yearMonthOf } from "./engine"
import type { AfterInterestOnly, CalendarExtra, CustomPeriod, LoanIntro, LoanType, Scenario } from "./types"

const MAX_LIST = 50
const MAX_NAME = 80
const MAX_MONTH = 1200
const LAST_MONTH = "2100-12"

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function optNum(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined
  const n = typeof v === "string" ? Number(v) : v
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined
  return Math.min(max, Math.max(min, n))
}

function str(v: unknown, fallback: string, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : fallback
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Extra payments in the current calendar format, or the older "month N from today"
 * format, which is pinned to the calendar month it meant on the day it is read.
 */
function sanitizeExtra(v: unknown, anchor: string, offset: number): CalendarExtra | undefined {
  if (!isRecord(v)) return undefined
  const kind: CalendarExtra["kind"] = v.kind === "oneoff" ? "oneoff" : "recurring"
  const amount = optNum(v.amount, 0, 1_000_000_000)
  if (amount === undefined) return undefined
  const id = str(v.id, "", 64) || uid()

  if (isValidYearMonth(v.from)) {
    const to = kind === "recurring" && isValidYearMonth(v.to) ? (v.to < v.from ? v.from : v.to) : undefined
    return { id, kind, amount, from: v.from, to }
  }

  const fromMonth = optNum(v.fromMonth, 1, MAX_MONTH)
  if (fromMonth === undefined) return undefined
  const from = yearMonthOf(addMonths(anchor, offset + Math.round(fromMonth)))
  if (!isValidYearMonth(from)) return undefined
  const toMonth = kind === "recurring" ? optNum(v.toMonth, 1, MAX_MONTH) : undefined
  let to: string | undefined
  if (toMonth !== undefined) {
    const t = yearMonthOf(addMonths(anchor, offset + Math.max(Math.round(fromMonth), Math.round(toMonth))))
    to = isValidYearMonth(t) ? t : LAST_MONTH
  }
  return { id, kind, amount, from, to }
}

function sanitizeIntro(v: unknown): LoanIntro | undefined {
  if (!isRecord(v)) return undefined
  const months = optNum(v.months, 1, 600)
  if (months === undefined) return undefined
  return {
    kind: v.kind === "rate" ? "rate" : "interest-only",
    months: Math.round(months),
    annualRatePct: num(v.annualRatePct, 0, 0, 100),
  }
}

function sanitizeCustomPeriod(v: unknown): CustomPeriod | undefined {
  if (!isRecord(v)) return undefined
  if (!isValidYearMonth(v.from) || !isValidYearMonth(v.to)) return undefined
  const [from, to] = v.from <= v.to ? [v.from, v.to] : [v.to, v.from]
  return {
    id: str(v.id, "", 64) || uid(),
    kind: v.kind === "rate" ? "rate" : "interest-only",
    from,
    to,
    annualRatePct: num(v.annualRatePct, 0, 0, 100),
  }
}

/**
 * Older saves stored periods as "month N from today, for M months". Pin them to the
 * calendar months they meant on the day they are read, so they stop drifting.
 */
function migrateLegacyPeriods(
  raw: Record<string, unknown>,
  startDate: string | undefined,
  today: string,
): CustomPeriod[] {
  const anchor = startDate ?? today
  const offset = monthsElapsed(startDate, today)
  const toCalendar = (v: unknown, kind: CustomPeriod["kind"]): CustomPeriod | undefined => {
    if (!isRecord(v)) return undefined
    const fromMonth = optNum(v.fromMonth, 1, MAX_MONTH)
    const months = optNum(v.months, 1, MAX_MONTH)
    if (fromMonth === undefined || months === undefined) return undefined
    const first = Math.round(fromMonth)
    const last = Math.min(MAX_MONTH, first + Math.round(months) - 1)
    const from = yearMonthOf(addMonths(anchor, offset + first))
    if (!isValidYearMonth(from)) return undefined
    const to = yearMonthOf(addMonths(anchor, offset + last))
    return {
      id: str(v.id, "", 64) || uid(),
      kind,
      from,
      to: isValidYearMonth(to) ? to : LAST_MONTH,
      annualRatePct: kind === "rate" ? num(v.annualRatePct, 0, 0, 100) : 0,
    }
  }
  return [
    ...list(raw.interestOnly, (v) => toCalendar(v, "interest-only")),
    ...list(raw.ratePeriods, (v) => toCalendar(v, "rate")),
  ].slice(0, MAX_LIST)
}

function list<T>(v: unknown, f: (x: unknown) => T | undefined): T[] {
  if (!Array.isArray(v)) return []
  const out: T[] = []
  for (const item of v.slice(0, MAX_LIST)) {
    const s = f(item)
    if (s) out.push(s)
  }
  return out
}

/**
 * Turns untrusted JSON (import file, share link, old localStorage) into a Scenario
 * the engine can run without throwing. Returns undefined when there is no usable loan.
 */
export function sanitizeScenario(raw: unknown, today: string = todayIso()): Scenario | undefined {
  if (!isRecord(raw) || !isRecord(raw.loan)) return undefined
  const l = raw.loan
  const principal = optNum(l.principal, 0, 1_000_000_000)
  if (principal === undefined || principal <= 0) return undefined

  const loanType: LoanType = l.loanType === "serial" ? "serial" : "annuity"
  const startDate = isValidIsoDate(l.startDate) ? l.startDate : undefined
  const remainingBalance = startDate ? optNum(l.remainingBalance, 0, principal) : undefined
  const after: AfterInterestOnly = raw.afterInterestOnly === "keep-payment" ? "keep-payment" : "keep-term"

  const savedAt =
    typeof raw.savedAt === "string" && !Number.isNaN(new Date(raw.savedAt).getTime())
      ? raw.savedAt
      : new Date().toISOString()

  return {
    id: str(raw.id, "", 64) || uid(),
    savedAt,
    loan: {
      name: str(l.name, "", MAX_NAME),
      principal,
      annualRatePct: num(l.annualRatePct, 0, 0, 100),
      termMonths: Math.round(num(l.termMonths, 300, 1, 600)),
      loanType,
      monthlyFee: num(l.monthlyFee, 0, 0, 100_000),
      // Older saves have no day count; actual days is what floating-rate loans use.
      dayCount: l.dayCount === "30/360" || l.dayCount === "act/360" ? l.dayCount : "act/act",
      startDate,
      remainingBalance,
      setupFee: optNum(l.setupFee, 0, Math.min(1_000_000, principal)),
      effectiveRatePct: optNum(l.effectiveRatePct, 0, 100),
      intro: sanitizeIntro(l.intro),
    },
    extras: list(raw.extras, (v) =>
      sanitizeExtra(v, startDate ?? today, monthsElapsed(startDate, today)),
    ),
    periods: Array.isArray(raw.periods)
      ? list(raw.periods, sanitizeCustomPeriod)
      : migrateLegacyPeriods(raw, startDate, today),
    afterInterestOnly: after,
  }
}
