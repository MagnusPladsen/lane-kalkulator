import { addMonths, analyze, yearMonthOf } from "./loan/engine"
import type { Analysis, Scenario } from "./loan/types"
import { uid } from "./ids"

/** One saved loan as it stands today, on its own plan (including its own extras and periods). */
export interface LoanNow {
  scenario: Scenario
  analysis: Analysis
  /** Balance today. */
  balance: number
  /** Regular payment now, fees included. */
  payment: number
  /** Interest still to pay on the current plan. */
  interestLeft: number
  /** "YYYY-MM" of the last payment on the current plan. */
  payoff: string
  /** "YYYY-MM" of the next payment. */
  nextMonth: string
}

/** Calendar month of forward payment m (1 = next) for a loan. */
function monthOf(s: Scenario, a: Analysis, today: string, m: number): string {
  return yearMonthOf(addMonths(s.loan.startDate ?? today, a.offsetMonths + m))
}

export function loanNow(scenario: Scenario, today: string): LoanNow | undefined {
  const a = analyze(scenario, today)
  if (a.paidOff || a.scenario.rows.length === 0) return undefined
  const first = a.scenario.rows.find((r) => !r.interestOnly) ?? a.scenario.rows[0]
  return {
    scenario,
    analysis: a,
    balance: a.startingBalance,
    payment: first.interest + first.principal + first.fee,
    interestLeft: a.scenario.totalInterest,
    payoff: monthOf(scenario, a, today, a.scenario.months),
    nextMonth: monthOf(scenario, a, today, 1),
  }
}

export type Strategy = "avalanche" | "snowball"

export interface StrategyResult {
  strategy: Strategy
  /** Interest still to pay across all loans with the strategy. */
  interestLeft: number
  /** Interest saved against each loan's current plan. */
  saved: number
  /** "YYYY-MM" when the last loan is paid. */
  debtFree: string
  /** The loans in the order the extra money goes to them, with their new payoff month. */
  order: { id: string; name: string; payoff: string; was: string }[]
}

const nextYm = (ym: string) => yearMonthOf(addMonths(`${ym}-15`, 1))

/**
 * Put `extra` kroner a month on one loan at a time. When it is paid off, its payment plus
 * the extra moves on to the next loan ("debt snowball" rollover). Avalanche targets the
 * highest rate first (least interest); snowball the smallest balance first (quick wins).
 * Each loan keeps its own saved extras and periods; the freed payment is its current one.
 */
export function payDownPlan(loans: LoanNow[], extra: number, strategy: Strategy, today: string): StrategyResult {
  const order = [...loans].sort((x, y) =>
    strategy === "avalanche"
      ? y.scenario.loan.annualRatePct - x.scenario.loan.annualRatePct || x.balance - y.balance
      : x.balance - y.balance || y.scenario.loan.annualRatePct - x.scenario.loan.annualRatePct,
  )
  let pool = Math.max(0, extra)
  // The first loan gets the extra from its next payment; later ones from when the previous is done.
  let from: string | undefined
  let interestLeft = 0
  let debtFree = ""
  const out: StrategyResult["order"] = []
  for (const l of order) {
    const start = from && from > l.nextMonth ? from : l.nextMonth
    const withExtra: Scenario =
      pool > 0
        ? { ...l.scenario, extras: [...l.scenario.extras, { id: uid(), kind: "recurring", amount: Math.round(pool), from: start }] }
        : l.scenario
    const a = analyze(withExtra, today)
    const payoff = monthOf(withExtra, a, today, a.scenario.months)
    interestLeft += a.scenario.totalInterest
    if (payoff > debtFree) debtFree = payoff
    out.push({ id: l.scenario.id, name: l.scenario.loan.name, payoff, was: l.payoff })
    // Its regular payment is free from the month after it is paid off.
    pool += l.payment
    from = nextYm(payoff)
  }
  const before = loans.reduce((sum, l) => sum + l.interestLeft, 0)
  return { strategy, interestLeft, saved: before - interestLeft, debtFree, order: out }
}
