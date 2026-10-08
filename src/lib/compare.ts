import { analyze, planEffectiveRate, todayIso } from "./loan/engine"
import type { DayCount, LoanInput, LoanType, Scenario } from "./loan/types"

/** A loan offer as a bank presents it. */
export interface Offer {
  name: string
  principal: number
  annualRatePct: number
  termMonths: number
  loanType: LoanType
  monthlyFee: number
  setupFee: number
  dayCount?: DayCount
}

export interface OfferResult {
  /** First regular payment, fees included. */
  firstPayment: number
  totalInterest: number
  /** Monthly fees over the life plus the setup fee. */
  totalFees: number
  /** Everything paid back, setup fee included. */
  totalCost: number
  effectiveRatePct?: number
  months: number
}

function scenarioOf(loan: LoanInput): Scenario {
  return { id: "compare", savedAt: "", loan, extras: [], periods: [], afterInterestOnly: "keep-term" }
}

export function offerLoan(o: Offer): LoanInput {
  return {
    name: o.name,
    principal: o.principal,
    annualRatePct: o.annualRatePct,
    termMonths: o.termMonths,
    loanType: o.loanType,
    monthlyFee: o.monthlyFee,
    setupFee: o.setupFee || undefined,
    dayCount: o.dayCount ?? "act/act",
  }
}

/** Runs an offer from today through the same engine as the calculator. */
export function evaluateOffer(o: Offer, today: string = todayIso()): OfferResult {
  const loan = offerLoan(o)
  const a = analyze(scenarioOf(loan), today)
  const r = a.scenario.rows[0]
  return {
    firstPayment: r ? r.interest + r.principal + r.fee : 0,
    totalInterest: a.lifetime.scenario.interest,
    totalFees: a.lifetime.scenario.fees,
    totalCost: a.lifetime.scenario.paid,
    effectiveRatePct: planEffectiveRate(loan, today),
    months: a.scenario.months,
  }
}

/** Today's loan and a new offer for the same balance. */
export interface RefinanceInput {
  balance: number
  remainingMonths: number
  current: { annualRatePct: number; monthlyFee: number; loanType: LoanType; dayCount?: DayCount }
  next: { annualRatePct: number; monthlyFee: number; loanType: LoanType; termMonths: number; dayCount?: DayCount }
  /** One-off cost of moving: setup fee, registration (tinglysing) and similar. */
  switchCost: number
}

export interface RefinanceResult {
  currentPayment: number
  newPayment: number
  /** currentPayment − newPayment; positive means the new loan is cheaper per month. */
  monthlySaving: number
  /** Everything still to pay on today's loan. */
  currentTotal: number
  /** Everything to pay on the new loan, moving costs included. */
  newTotal: number
  /** currentTotal − newTotal; positive means moving saves money overall. */
  totalSaving: number
  /** Month (1-based) from which moving has paid for itself; undefined if it never does. */
  breakEvenMonth?: number
  newEffectiveRatePct?: number
}

export function refinance(input: RefinanceInput, today: string = todayIso()): RefinanceResult {
  const cur = analyze(
    scenarioOf({
      name: "",
      principal: input.balance,
      annualRatePct: input.current.annualRatePct,
      termMonths: input.remainingMonths,
      loanType: input.current.loanType,
      monthlyFee: input.current.monthlyFee,
      dayCount: input.current.dayCount ?? "act/act",
    }),
    today,
  )
  const nextLoan: LoanInput = {
    name: "",
    principal: input.balance,
    annualRatePct: input.next.annualRatePct,
    termMonths: input.next.termMonths,
    loanType: input.next.loanType,
    monthlyFee: input.next.monthlyFee,
    setupFee: input.switchCost || undefined,
    dayCount: input.next.dayCount ?? "act/act",
  }
  const nxt = analyze(scenarioOf(nextLoan), today)
  const pay = (rows: { interest: number; principal: number; fee: number }[]) => (rows[0] ? rows[0].interest + rows[0].principal + rows[0].fee : 0)

  // Month by month: money kept by moving, after paying the moving cost up front.
  let ahead = -input.switchCost
  let breakEvenMonth: number | undefined
  const n = Math.max(cur.scenario.rows.length, nxt.scenario.rows.length)
  for (let m = 0; m < n; m++) {
    ahead += (cur.scenario.rows[m]?.payment ?? 0) - (nxt.scenario.rows[m]?.payment ?? 0)
    if (breakEvenMonth === undefined && ahead >= 0) breakEvenMonth = m + 1
    if (ahead < 0) breakEvenMonth = undefined
  }

  const currentTotal = cur.scenario.totalPaid
  const newTotal = nxt.scenario.totalPaid + input.switchCost
  return {
    currentPayment: pay(cur.scenario.rows),
    newPayment: pay(nxt.scenario.rows),
    monthlySaving: pay(cur.scenario.rows) - pay(nxt.scenario.rows),
    currentTotal,
    newTotal,
    totalSaving: currentTotal - newTotal,
    breakEvenMonth: currentTotal - newTotal >= 0 ? breakEvenMonth : undefined,
    newEffectiveRatePct: planEffectiveRate(nextLoan, today),
  }
}
