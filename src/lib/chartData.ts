import { currentLang, INTL_LOCALE } from "@/i18n"
import type { Analysis, ScheduleRow } from "./loan/types"

export interface BalancePoint {
  i: number
  date: string
  history?: number
  baseline?: number
  scenario?: number
}

export interface CumPoint {
  i: number
  date: string
  baseline?: number
  scenario?: number
}

export interface YearPoint {
  year: string
  interest: number
  principal: number
  extra: number
  fee: number
  interestOnlyMonths: number
}

export type DateForIndex = (i: number) => string

/** Index 0 = loan start (or today when no start date). Forward row m sits at offset + m. */
export function balanceSeries(a: Analysis, dateFor: DateForIndex, principal: number): BalancePoint[] {
  const off = a.offsetMonths
  const len = off + Math.max(a.baseline.months, a.scenario.months) + 1
  // When changes before today moved the history, draw the unchanged plan's history too.
  const historyDiffers = a.pastRows.some((r, k) => Math.abs(r.balance - (a.baselinePastRows[k]?.balance ?? 0)) > 0.5)
  const out: BalancePoint[] = []
  for (let i = 0; i < len; i++) {
    const p: BalancePoint = { i, date: dateFor(i) }
    if (off > 0 && i <= off) {
      p.history = i === 0 ? principal : (a.pastRows[i - 1]?.balance ?? 0)
      if (historyDiffers) p.baseline = i === 0 ? principal : (a.baselinePastRows[i - 1]?.balance ?? 0)
    }
    if (i >= off) {
      const m = i - off
      if (m === 0) {
        p.baseline = a.baselineStartingBalance
        p.scenario = a.startingBalance
      } else {
        const b = a.baseline.rows[m - 1]
        const s = a.scenario.rows[m - 1]
        if (b) p.baseline = b.balance
        if (s) p.scenario = s.balance
      }
    }
    out.push(p)
  }
  return out
}

export function cumulativeSeries(a: Analysis, dateFor: DateForIndex): CumPoint[] {
  const off = a.offsetMonths
  const len = Math.max(a.baseline.months, a.scenario.months) + 1
  // Start each line at what was already paid in interest and fees (history + setup fee).
  const startB = a.lifetime.baseline.interest + a.lifetime.baseline.fees - a.baseline.totalInterest - a.baseline.totalFees
  const startS = a.lifetime.scenario.interest + a.lifetime.scenario.fees - a.scenario.totalInterest - a.scenario.totalFees
  const out: CumPoint[] = []
  for (let m = 0; m < len; m++) {
    const p: CumPoint = { i: off + m, date: dateFor(off + m) }
    if (m === 0) {
      p.baseline = startB
      p.scenario = startS
    } else {
      const b = a.baseline.rows[m - 1]
      const s = a.scenario.rows[m - 1]
      if (b) p.baseline = startB + b.cumInterest + b.fee * m
      if (s) p.scenario = startS + s.cumInterest + s.fee * m
    }
    out.push(p)
  }
  return out
}

export function yearlySeries(rows: ScheduleRow[], offset: number, dateFor: DateForIndex): YearPoint[] {
  const map = new Map<string, YearPoint>()
  rows.forEach((r, idx) => {
    const year = dateFor(offset + idx + 1).slice(0, 4)
    let y = map.get(year)
    if (!y) {
      y = { year, interest: 0, principal: 0, extra: 0, fee: 0, interestOnlyMonths: 0 }
      map.set(year, y)
    }
    y.interest += r.interest
    y.principal += r.principal
    y.extra += r.extra
    y.fee += r.fee
    if (r.interestOnly) y.interestOnlyMonths += 1
  })
  return [...map.values()]
}

/** Axis labels: "1,5 mill." / "750k" style, in the UI language. */
export function compactKr(n: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[currentLang()], {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

export function yearTicks(points: { i: number; date: string }[]): number[] {
  const ticks: number[] = []
  let last = ""
  for (const p of points) {
    const y = p.date.slice(0, 4)
    if (y !== last) {
      ticks.push(p.i)
      last = y
    }
  }
  const step = Math.max(1, Math.ceil(ticks.length / 10))
  return ticks.filter((_, idx) => idx % step === 0)
}
