export type LoanType = "annuity" | "serial"

/**
 * How interest days are counted (rentedager).
 * 30/360: every month is 1/12 of a year (often fixed-rate loans).
 * act/act: actual days / 365, or 366 in leap years (usual for floating-rate loans).
 * act/360: actual days / 360, slightly dearer.
 */
export type DayCount = "30/360" | "act/act" | "act/360"

export interface LoanInput {
  name: string
  /** Original loan amount. */
  principal: number
  /** Nominal annual interest rate in percent, e.g. 5.4 */
  annualRatePct: number
  /** Original term in months. */
  termMonths: number
  loanType: LoanType
  /** Fixed fee per payment (termingebyr). */
  monthlyFee: number
  /** Interest day count. Undefined means 30/360. */
  dayCount?: DayCount
  /** ISO date yyyy-mm-dd. Optional. */
  startDate?: string
  /** Balance today. Only meaningful together with startDate. */
  remainingBalance?: number
  /** One-off fee when the loan was set up (etableringsgebyr). */
  setupFee?: number
  /** Effective rate quoted by the bank, used only to check the inputs. */
  effectiveRatePct?: number
  /**
   * Special terms from the first payment that are part of the loan itself, e.g.
   * "first 3 years interest-only" or "first 3 years at 0 %". Counted in both plans.
   */
  intro?: LoanIntro
}

export interface LoanIntro {
  kind: PeriodKind
  months: number
  /** Kind "rate" only. */
  annualRatePct: number
}

export interface Totals {
  interest: number
  fees: number
  /** Everything paid: principal, interest, extras and fees. */
  paid: number
}

export interface ExtraPayment {
  id: string
  kind: "recurring" | "oneoff"
  amount: number
  /** 1-based month index counted from "now". */
  fromMonth: number
  /** Recurring only. Inclusive. Undefined = until paid off. */
  toMonth?: number
}

export interface InterestOnlyPeriod {
  id: string
  /** 1-based month index counted from "now". */
  fromMonth: number
  months: number
  /** Overrides the scenario-wide choice for what happens after this period. */
  after?: AfterInterestOnly
}

/** A stretch of months with a different nominal rate, e.g. a fixed-rate deal or a stress test. */
export interface RatePeriod {
  id: string
  /** 1-based month index counted from "now". */
  fromMonth: number
  months: number
  annualRatePct: number
}

/**
 * An extra payment as the user enters it, pinned to calendar months ("YYYY-MM")
 * so a saved loan keeps its dates as time passes.
 */
export interface CalendarExtra {
  id: string
  kind: "recurring" | "oneoff"
  amount: number
  /** First month (recurring) or the month (one-off), "YYYY-MM". */
  from: string
  /** Recurring only: last month, inclusive. Undefined = until paid off. */
  to?: string
}

export type PeriodKind = "interest-only" | "rate"

/**
 * A stretch of calendar months that differs from the normal plan, entered by the user.
 * Stored as real months ("YYYY-MM") so a saved loan keeps its dates as time passes.
 */
export interface CustomPeriod {
  id: string
  kind: PeriodKind
  /** First month, inclusive, "YYYY-MM". */
  from: string
  /** Last month, inclusive, "YYYY-MM". */
  to: string
  /** Kind "rate" only: nominal annual rate during the period, e.g. 0. */
  annualRatePct: number
}

/**
 * keep-term:    after an interest-only period, recompute the payment so the original end date holds.
 * keep-payment: keep the old payment; the loan runs longer.
 */
export type AfterInterestOnly = "keep-term" | "keep-payment"

export interface Scenario {
  id: string
  savedAt: string
  loan: LoanInput
  extras: CalendarExtra[]
  periods: CustomPeriod[]
  afterInterestOnly: AfterInterestOnly
}

export interface ScheduleRow {
  /** 1-based month index within this schedule. */
  month: number
  interest: number
  principal: number
  extra: number
  fee: number
  /** interest + principal + extra + fee */
  payment: number
  /** Balance after this month's payment. */
  balance: number
  cumInterest: number
  cumPaid: number
  interestOnly: boolean
  /** Nominal annual rate in percent applied this month. */
  ratePct: number
}

export interface ScheduleResult {
  rows: ScheduleRow[]
  totalInterest: number
  totalFees: number
  totalPaid: number
  months: number
  /** Base monthly payment (interest + principal + fee) in the first month. */
  monthlyPayment: number
  /** Highest base payment seen (relevant for keep-term after interest-only). */
  maxMonthlyPayment: number
  payoffDate?: string
  /** True when the schedule hit the row guard before the balance reached zero. */
  truncated: boolean
}

export interface Analysis {
  /** Whole months elapsed since startDate (0 when unknown). */
  offsetMonths: number
  /** Balance the forward projection starts from. */
  startingBalance: number
  /** Balance the plan without changes starts from today. */
  baselineStartingBalance: number
  /** Today's balance was typed in by the user rather than simulated. */
  balancePinned: boolean
  /** Simulated history with the user's changes, loan start up to today (empty without startDate). */
  pastRows: ScheduleRow[]
  /** Simulated history without changes. */
  baselinePastRows: ScheduleRow[]
  past: { baseline: Totals; scenario: Totals }
  /** Whole loan: history + forward plan + setup fee. */
  lifetime: { baseline: Totals; scenario: Totals }
  /** Nothing left to pay as of today. */
  paidOff: boolean
  baseline: ScheduleResult
  scenario: ScheduleResult
  delta: {
    months: number
    interest: number
    totalCost: number
  }
}
