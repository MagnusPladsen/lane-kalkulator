export type LoanType = "annuity" | "serial"

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
  /** ISO date yyyy-mm-dd. Optional. */
  startDate?: string
  /** Balance today. Only meaningful together with startDate. */
  remainingBalance?: number
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
  extras: ExtraPayment[]
  interestOnly: InterestOnlyPeriod[]
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
}

export interface Analysis {
  /** Whole months elapsed since startDate (0 when unknown). */
  offsetMonths: number
  /** Balance the forward projection starts from. */
  startingBalance: number
  /** Original-plan rows from loan start up to today (empty without startDate). */
  pastRows: ScheduleRow[]
  baseline: ScheduleResult
  scenario: ScheduleResult
  delta: {
    months: number
    interest: number
    totalCost: number
  }
}
