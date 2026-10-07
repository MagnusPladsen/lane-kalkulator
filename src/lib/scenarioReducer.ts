import { uid } from "./ids"
import type {
  AfterInterestOnly,
  ExtraPayment,
  InterestOnlyPeriod,
  LoanInput,
  Scenario,
} from "./loan/types"

export type Action =
  | { type: "loan"; patch: Partial<LoanInput> }
  | { type: "extra/add"; kind: ExtraPayment["kind"] }
  | { type: "extra/update"; id: string; patch: Partial<ExtraPayment> }
  | { type: "extra/remove"; id: string }
  | { type: "io/add" }
  | { type: "io/update"; id: string; patch: Partial<InterestOnlyPeriod> }
  | { type: "io/remove"; id: string }
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
    case "extra/update":
      return {
        ...state,
        extras: state.extras.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      }
    case "extra/remove":
      return { ...state, extras: state.extras.filter((e) => e.id !== action.id) }
    case "io/add":
      return {
        ...state,
        interestOnly: [...state.interestOnly, { id: uid(), fromMonth: 1, months: 6 }],
      }
    case "io/update":
      return {
        ...state,
        interestOnly: state.interestOnly.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      }
    case "io/remove":
      return { ...state, interestOnly: state.interestOnly.filter((p) => p.id !== action.id) }
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

export function validateLoan(l: LoanInput): LoanValidation {
  const errors: LoanValidation["errors"] = {}
  if (!(l.principal > 0)) errors.principal = "Enter the loan amount"
  if (!(l.annualRatePct >= 0) || l.annualRatePct > 100) errors.annualRatePct = "0–100 %"
  if (!(l.termMonths >= 1) || l.termMonths > 480) errors.termMonths = "1–40 years"
  if (l.monthlyFee < 0) errors.monthlyFee = "Cannot be negative"
  if (l.remainingBalance !== undefined && l.remainingBalance > l.principal)
    errors.remainingBalance = "Cannot exceed the loan amount"
  if (l.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(l.startDate)) errors.startDate = "Invalid date"
  return { ok: Object.keys(errors).length === 0, errors }
}
