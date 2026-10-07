import { uid } from "./ids"
import { isValidIsoDate } from "./loan/engine"
import type { AfterInterestOnly, CustomPeriod, ExtraPayment, LoanInput, Scenario } from "./loan/types"

export type Action =
  | { type: "loan"; patch: Partial<LoanInput> }
  | { type: "extra/add"; kind: ExtraPayment["kind"] }
  | { type: "extra/addAmount"; amount: number }
  | { type: "extra/update"; id: string; patch: Partial<ExtraPayment> }
  | { type: "extra/remove"; id: string }
  | { type: "period/add"; period: CustomPeriod }
  | { type: "period/update"; id: string; patch: Partial<Omit<CustomPeriod, "id">> }
  | { type: "period/remove"; id: string }
  | { type: "afterIo"; value: AfterInterestOnly }
  | { type: "load"; scenario: Scenario }
  | { type: "reset"; scenario: Scenario }

export function scenarioReducer(state: Scenario, action: Action): Scenario {
  switch (action.type) {
    case "loan":
      return { ...state, loan: { ...state.loan, ...action.patch } }
    case "extra/add":
      return {
        ...state,
        extras: [
          ...state.extras,
          {
            id: uid(),
            kind: action.kind,
            amount: action.kind === "oneoff" ? 50_000 : 1_000,
            fromMonth: 1,
          },
        ],
      }
    case "extra/addAmount":
      return {
        ...state,
        extras: [...state.extras, { id: uid(), kind: "recurring", amount: action.amount, fromMonth: 1 }],
      }
    case "extra/update":
      return {
        ...state,
        extras: state.extras.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      }
    case "extra/remove":
      return { ...state, extras: state.extras.filter((e) => e.id !== action.id) }
    case "period/add":
      return { ...state, periods: [...state.periods, action.period] }
    case "period/update":
      return {
        ...state,
        periods: state.periods.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      }
    case "period/remove":
      return { ...state, periods: state.periods.filter((p) => p.id !== action.id) }
    case "afterIo":
      return { ...state, afterInterestOnly: action.value }
    case "load":
    case "reset":
      return action.scenario
  }
}

export interface LoanValidation {
  ok: boolean
  errors: Partial<Record<keyof LoanInput, string>>
}

export const LIMITS = {
  principalMax: 1_000_000_000,
  rateMax: 100,
  termMax: 480,
  feeMax: 100_000,
} as const

/** Error values are i18n keys under "validation". */
export function validateLoan(l: LoanInput): LoanValidation {
  const errors: LoanValidation["errors"] = {}
  const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n)
  if (!fin(l.principal) || l.principal <= 0 || l.principal > LIMITS.principalMax) errors.principal = "principal"
  if (!fin(l.annualRatePct) || l.annualRatePct < 0 || l.annualRatePct > LIMITS.rateMax) errors.annualRatePct = "rate"
  if (!fin(l.termMonths) || !Number.isInteger(l.termMonths) || l.termMonths < 1 || l.termMonths > LIMITS.termMax)
    errors.termMonths = "term"
  if (!fin(l.monthlyFee) || l.monthlyFee < 0 || l.monthlyFee > LIMITS.feeMax) errors.monthlyFee = "fee"
  if (l.startDate !== undefined && !isValidIsoDate(l.startDate)) errors.startDate = "startDate"
  if (l.remainingBalance !== undefined) {
    if (!l.startDate) errors.remainingBalance = "remainingNeedsStart"
    else if (!fin(l.remainingBalance) || l.remainingBalance < 0) errors.remainingBalance = "remainingNegative"
    else if (fin(l.principal) && l.remainingBalance > l.principal) errors.remainingBalance = "remainingTooHigh"
  }
  return { ok: Object.keys(errors).length === 0, errors }
}
