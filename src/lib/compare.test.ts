import { describe, expect, it } from "vitest"
import { evaluateOffer, refinance, type Offer } from "./compare"

const today = "2026-10-08"
const offer = (over: Partial<Offer> = {}): Offer => ({
  name: "A", principal: 3_000_000, annualRatePct: 5.5, termMonths: 300, loanType: "annuity", monthlyFee: 50, setupFee: 0, dayCount: "30/360", ...over,
})

describe("evaluateOffer", () => {
  it("total cost is principal + interest + fees", () => {
    const r = evaluateOffer(offer({ setupFee: 2_500 }), today)
    expect(r.totalCost).toBeCloseTo(3_000_000 + r.totalInterest + r.totalFees, 2)
    expect(r.totalFees).toBeCloseTo(300 * 50 + 2_500, 6)
    expect(r.months).toBe(300)
  })
  it("a lower rate wins even with a higher fee, and the effective rate shows the fee", () => {
    const a = evaluateOffer(offer({ annualRatePct: 5.5, monthlyFee: 0 }), today)
    const b = evaluateOffer(offer({ annualRatePct: 5.2, monthlyFee: 75 }), today)
    expect(b.totalCost).toBeLessThan(a.totalCost)
    expect(b.effectiveRatePct!).toBeGreaterThan(5.2 * 1.0)
  })
})

describe("refinance", () => {
  const base = {
    balance: 2_000_000,
    remainingMonths: 240,
    current: { annualRatePct: 5.5, monthlyFee: 50, loanType: "annuity" as const, dayCount: "30/360" as const },
    next: { annualRatePct: 4.9, monthlyFee: 50, loanType: "annuity" as const, termMonths: 240, dayCount: "30/360" as const },
    switchCost: 2_500,
  }
  it("a lower rate saves money and pays for the move within months", () => {
    const r = refinance(base, today)
    expect(r.monthlySaving).toBeGreaterThan(0)
    expect(r.totalSaving).toBeGreaterThan(0)
    expect(r.breakEvenMonth).toBeGreaterThanOrEqual(1)
    // monthly saving ≈ 680 kr, so 2 500 kr is recovered in the 4th month
    expect(r.breakEvenMonth).toBe(Math.ceil(2_500 / r.monthlySaving))
    expect(r.newTotal).toBeCloseTo(r.currentTotal - r.totalSaving, 6)
  })
  it("never pays off when the new rate is not lower", () => {
    const r = refinance({ ...base, next: { ...base.next, annualRatePct: 5.5 } }, today)
    expect(r.totalSaving).toBeLessThan(0)
    expect(r.breakEvenMonth).toBeUndefined()
  })
  it("a longer new term lowers the payment but can cost more overall", () => {
    const r = refinance({ ...base, next: { ...base.next, annualRatePct: 5.3, termMonths: 360 } }, today)
    expect(r.monthlySaving).toBeGreaterThan(0)
    expect(r.totalSaving).toBeLessThan(0)
    expect(r.breakEvenMonth).toBeUndefined()
  })
})
