import { describe, expect, it } from "vitest"
import {
  addMonths,
  analyze,
  annuityPayment,
  buildSchedule,
  monthsElapsed,
} from "./engine"
import type { Scenario } from "./types"

const base = (over: Partial<Scenario["loan"]> = {}): Scenario => ({
  id: "t",
  savedAt: "2026-10-07T00:00:00.000Z",
  loan: {
    name: "Test",
    principal: 1_000_000,
    annualRatePct: 6,
    termMonths: 120,
    loanType: "annuity",
    monthlyFee: 0,
    ...over,
  },
  extras: [],
  interestOnly: [],
  afterInterestOnly: "keep-term",
})

describe("annuityPayment", () => {
  it("matches the textbook value", () => {
    // 1 000 000 at 6 % over 10 years → 11 102.05 / month
    expect(annuityPayment(1_000_000, 0.06 / 12, 120)).toBeCloseTo(11_102.05, 1)
  })
  it("handles zero rate", () => {
    expect(annuityPayment(120_000, 0, 120)).toBe(1000)
  })
})

describe("date helpers", () => {
  it("adds months without drifting day-of-month past month end", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28")
    expect(addMonths("2026-10-07", 14)).toBe("2027-12-07")
  })
  it("counts whole months elapsed, never negative", () => {
    expect(monthsElapsed("2024-10-07", "2026-10-07")).toBe(24)
    expect(monthsElapsed("2024-10-20", "2026-10-07")).toBe(23)
    expect(monthsElapsed("2030-01-01", "2026-10-07")).toBe(0)
    expect(monthsElapsed(undefined, "2026-10-07")).toBe(0)
  })
})

describe("buildSchedule — annuity", () => {
  it("pays off exactly at term with fixed payment", () => {
    const r = buildSchedule({
      balance: 1_000_000,
      monthlyRate: 0.06 / 12,
      months: 120,
      loanType: "annuity",
      fee: 0,
      extras: [],
      interestOnly: [],
      afterInterestOnly: "keep-term",
    })
    expect(r.months).toBe(120)
    expect(r.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    expect(r.monthlyPayment).toBeCloseTo(11_102.05, 1)
    expect(r.totalInterest).toBeCloseTo(332_246, -1)
    expect(r.rows[0].interest).toBeCloseTo(5000, 2)
  })

  it("includes the fee in payment and totals", () => {
    const r = buildSchedule({
      balance: 100_000,
      monthlyRate: 0,
      months: 10,
      loanType: "annuity",
      fee: 50,
      extras: [],
      interestOnly: [],
      afterInterestOnly: "keep-term",
    })
    expect(r.rows[0].payment).toBe(10_050)
    expect(r.totalFees).toBe(500)
    expect(r.totalPaid).toBe(100_500)
  })
})

describe("buildSchedule — serial", () => {
  it("pays equal principal each month, declining interest", () => {
    const r = buildSchedule({
      balance: 120_000,
      monthlyRate: 0.12 / 12,
      months: 12,
      loanType: "serial",
      fee: 0,
      extras: [],
      interestOnly: [],
      afterInterestOnly: "keep-term",
    })
    expect(r.months).toBe(12)
    expect(r.rows[0].principal).toBeCloseTo(10_000, 6)
    expect(r.rows[0].interest).toBeCloseTo(1200, 6)
    expect(r.rows[11].interest).toBeCloseTo(100, 6)
    expect(r.rows.at(-1)!.balance).toBeCloseTo(0, 6)
  })
})

describe("extra payments", () => {
  const common = {
    balance: 1_000_000,
    monthlyRate: 0.06 / 12,
    months: 120,
    loanType: "annuity" as const,
    fee: 0,
    interestOnly: [],
    afterInterestOnly: "keep-term" as const,
  }
  it("recurring extra shortens the term and reduces interest", () => {
    const plain = buildSchedule({ ...common, extras: [] })
    const r = buildSchedule({
      ...common,
      extras: [{ id: "a", kind: "recurring", amount: 2000, fromMonth: 1 }],
    })
    expect(r.months).toBeLessThan(plain.months)
    expect(r.totalInterest).toBeLessThan(plain.totalInterest)
    expect(r.rows[0].extra).toBe(2000)
    expect(r.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    // last payment never exceeds what is owed
    const last = r.rows.at(-1)!
    expect(last.principal + last.extra).toBeCloseTo(r.rows.at(-2)!.balance, 2)
  })
  it("respects fromMonth / toMonth window", () => {
    const r = buildSchedule({
      ...common,
      extras: [{ id: "a", kind: "recurring", amount: 1000, fromMonth: 3, toMonth: 4 }],
    })
    expect(r.rows[1].extra).toBe(0)
    expect(r.rows[2].extra).toBe(1000)
    expect(r.rows[3].extra).toBe(1000)
    expect(r.rows[4].extra).toBe(0)
  })
  it("one-off extra lands in a single month", () => {
    const r = buildSchedule({
      ...common,
      extras: [{ id: "a", kind: "oneoff", amount: 100_000, fromMonth: 6 }],
    })
    expect(r.rows[4].extra).toBe(0)
    expect(r.rows[5].extra).toBe(100_000)
    expect(r.rows[6].extra).toBe(0)
    expect(r.months).toBeLessThan(120)
  })
})

describe("interest-only periods", () => {
  const common = {
    balance: 1_000_000,
    monthlyRate: 0.06 / 12,
    months: 120,
    loanType: "annuity" as const,
    fee: 0,
    extras: [],
  }
  it("charges only interest during the period", () => {
    const r = buildSchedule({
      ...common,
      interestOnly: [{ id: "p", fromMonth: 2, months: 3 }],
      afterInterestOnly: "keep-payment",
    })
    expect(r.rows[0].interestOnly).toBe(false)
    for (const i of [1, 2, 3]) {
      expect(r.rows[i].interestOnly).toBe(true)
      expect(r.rows[i].principal).toBe(0)
      expect(r.rows[i].payment).toBeCloseTo(r.rows[i].interest, 6)
    }
    expect(r.rows[4].interestOnly).toBe(false)
  })
  it("keep-payment extends the loan and costs more interest", () => {
    const plain = buildSchedule({ ...common, interestOnly: [], afterInterestOnly: "keep-payment" })
    const r = buildSchedule({
      ...common,
      interestOnly: [{ id: "p", fromMonth: 1, months: 12 }],
      afterInterestOnly: "keep-payment",
    })
    expect(r.months).toBe(132)
    expect(r.totalInterest).toBeGreaterThan(plain.totalInterest)
    expect(r.rows[12].principal + r.rows[12].interest).toBeCloseTo(plain.monthlyPayment, 2)
  })
  it("keep-term keeps the end date and raises the payment", () => {
    const plain = buildSchedule({ ...common, interestOnly: [], afterInterestOnly: "keep-term" })
    const r = buildSchedule({
      ...common,
      interestOnly: [{ id: "p", fromMonth: 1, months: 12 }],
      afterInterestOnly: "keep-term",
    })
    expect(r.months).toBe(120)
    expect(r.rows[12].principal + r.rows[12].interest).toBeGreaterThan(plain.monthlyPayment)
    expect(r.maxMonthlyPayment).toBeGreaterThan(plain.monthlyPayment)
    expect(r.rows.at(-1)!.balance).toBeCloseTo(0, 2)
  })
})

describe("analyze", () => {
  it("no start date → no past rows, baseline equals original plan", () => {
    const a = analyze(base(), "2026-10-07")
    expect(a.offsetMonths).toBe(0)
    expect(a.pastRows).toHaveLength(0)
    expect(a.baseline.months).toBe(120)
    expect(a.scenario.months).toBe(120)
    expect(a.delta.months).toBe(0)
    expect(a.delta.interest).toBeCloseTo(0, 6)
    expect(a.baseline.payoffDate).toBeUndefined()
  })
  it("start date → offset, past rows, payoff date", () => {
    const a = analyze(base({ startDate: "2024-10-07" }), "2026-10-07")
    expect(a.offsetMonths).toBe(24)
    expect(a.pastRows).toHaveLength(24)
    expect(a.baseline.months).toBe(96)
    expect(a.baseline.payoffDate).toBe("2034-10-07")
    expect(a.startingBalance).toBeCloseTo(a.pastRows.at(-1)!.balance, 6)
  })
  it("remaining balance overrides the computed balance", () => {
    const a = analyze(
      base({ startDate: "2024-10-07", remainingBalance: 500_000 }),
      "2026-10-07",
    )
    expect(a.startingBalance).toBe(500_000)
    expect(a.baseline.rows[0].interest).toBeCloseTo(2500, 6)
  })
  it("delta is negative when extras save money and time", () => {
    const s = base()
    s.extras = [{ id: "x", kind: "recurring", amount: 3000, fromMonth: 1 }]
    const a = analyze(s, "2026-10-07")
    expect(a.delta.months).toBeLessThan(0)
    expect(a.delta.interest).toBeLessThan(0)
    expect(a.delta.totalCost).toBeLessThan(0)
  })
  it("survives a start date in the future", () => {
    const a = analyze(base({ startDate: "2030-01-01" }), "2026-10-07")
    expect(a.offsetMonths).toBe(0)
    expect(a.baseline.payoffDate).toBe("2040-01-01")
  })
})
