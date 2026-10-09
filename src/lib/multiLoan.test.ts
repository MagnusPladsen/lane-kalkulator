import { describe, expect, it } from "vitest"
import { loanNow, payDownPlan, type LoanNow } from "./multiLoan"
import type { Scenario } from "./loan/types"

const today = "2026-10-09"
const mk = (id: string, principal: number, rate: number, termMonths: number): Scenario => ({
  id, savedAt: "", extras: [], periods: [], afterInterestOnly: "keep-term",
  loan: { name: id, principal, annualRatePct: rate, termMonths, loanType: "annuity", monthlyFee: 0 },
})
const small = loanNow(mk("small-cheap", 100_000, 4, 120), today)!
const big = loanNow(mk("big-dear", 400_000, 9, 120), today)!
const loans: LoanNow[] = [small, big]

describe("payDownPlan", () => {
  it("avalanche pays the highest rate first, snowball the smallest balance first", () => {
    expect(payDownPlan(loans, 2000, "avalanche", today).order.map((o) => o.id)).toEqual(["big-dear", "small-cheap"])
    expect(payDownPlan(loans, 2000, "snowball", today).order.map((o) => o.id)).toEqual(["small-cheap", "big-dear"])
  })
  it("extra money saves interest and avalanche saves the most", () => {
    const av = payDownPlan(loans, 2000, "avalanche", today)
    const sn = payDownPlan(loans, 2000, "snowball", today)
    expect(av.saved).toBeGreaterThan(0)
    expect(sn.saved).toBeGreaterThan(0)
    expect(av.interestLeft).toBeLessThan(sn.interestLeft)
  })
  it("rolls a paid-off loan's payment into the next one", () => {
    const av = payDownPlan(loans, 2000, "avalanche", today)
    const second = av.order[1]
    expect(second.payoff < second.was).toBe(true)
    expect(av.debtFree <= [small.payoff, big.payoff].sort().at(-1)!).toBe(true)
  })
  it("with no extra money, only the rollover helps and nothing gets worse", () => {
    const r = payDownPlan(loans, 0, "avalanche", today)
    expect(r.saved).toBeGreaterThanOrEqual(0)
  })
})
