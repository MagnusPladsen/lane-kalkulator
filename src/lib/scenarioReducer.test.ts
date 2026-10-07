import { describe, expect, it } from "vitest"
import { scenarioReducer, validateLoan } from "./scenarioReducer"
import { newScenario } from "./storage"
import type { LoanInput } from "./loan/types"

const ok: LoanInput = {
  name: "x",
  principal: 1_000_000,
  annualRatePct: 5,
  termMonths: 120,
  loanType: "annuity",
  monthlyFee: 0,
}

describe("validateLoan", () => {
  it("accepts a sane loan", () => {
    expect(validateLoan(ok).ok).toBe(true)
  })
  it("rejects NaN and non-finite numbers", () => {
    expect(validateLoan({ ...ok, monthlyFee: NaN }).ok).toBe(false)
    expect(validateLoan({ ...ok, principal: Infinity }).ok).toBe(false)
    expect(validateLoan({ ...ok, termMonths: 12.5 }).ok).toBe(false)
  })
  it("rejects impossible dates and years outside 1900–2100", () => {
    expect(validateLoan({ ...ok, startDate: "2026-02-31" }).errors.startDate).toBeDefined()
    expect(validateLoan({ ...ok, startDate: "0002-10-07" }).errors.startDate).toBeDefined()
    expect(validateLoan({ ...ok, startDate: "2024-10-07" }).ok).toBe(true)
  })
  it("requires a start date for remaining balance and allows 0", () => {
    expect(validateLoan({ ...ok, remainingBalance: 5 }).errors.remainingBalance).toBeDefined()
    expect(validateLoan({ ...ok, startDate: "2024-10-07", remainingBalance: 0 }).ok).toBe(true)
  })
})

describe("scenarioReducer periods", () => {
  it("adds, updates and removes a period without touching others", () => {
    let s = newScenario()
    s = scenarioReducer(s, {
      type: "period/add",
      period: { id: "a", kind: "interest-only", from: "2027-01", to: "2027-06", annualRatePct: 0 },
    })
    s = scenarioReducer(s, {
      type: "period/add",
      period: { id: "b", kind: "rate", from: "2028-01", to: "2028-03", annualRatePct: 0 },
    })
    s = scenarioReducer(s, { type: "period/update", id: "a", patch: { kind: "rate", annualRatePct: 1.5 } })
    expect(s.periods[0]).toMatchObject({ id: "a", kind: "rate", annualRatePct: 1.5, from: "2027-01" })
    expect(s.periods[1].id).toBe("b")
    s = scenarioReducer(s, { type: "period/remove", id: "b" })
    expect(s.periods.map((p) => p.id)).toEqual(["a"])
  })
})

describe("validateLoan term limit", () => {
  it("accepts up to 50 years", () => {
    const ok = (termMonths: number) => validateLoan({ name: "", principal: 1_000_000, annualRatePct: 5, termMonths, loanType: "annuity", monthlyFee: 0 }).ok
    expect(ok(514)).toBe(true)
    expect(ok(600)).toBe(true)
    expect(ok(601)).toBe(false)
  })
})
