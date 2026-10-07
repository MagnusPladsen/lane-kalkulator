import { describe, expect, it } from "vitest"
import {
  periodToMonths,
  periodsToSchedule,
  addMonths,
  analyze,
  annuityPayment,
  buildSchedule,
  monthsElapsed,
  solveForTarget,
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
  periods: [],
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

describe("review fixes — dates", () => {
  it("zero-pads short years so Intl never sees an invalid date", () => {
    expect(addMonths("0002-10-07", 1)).toBe("0002-11-07")
    expect(addMonths("0999-12-31", 1)).toBe("1000-01-31")
  })
  it("monthsElapsed agrees with addMonths at month end", () => {
    expect(monthsElapsed("2026-01-31", "2026-02-28")).toBe(1)
    expect(monthsElapsed("2026-01-31", "2026-02-27")).toBe(0)
  })
})

describe("review fixes — engine edge cases", () => {
  const common = {
    monthlyRate: 0.06 / 12,
    loanType: "annuity" as const,
    fee: 0,
    extras: [],
  }
  it("caps interest-only months at the row guard instead of looping forever", () => {
    const t0 = performance.now()
    const r = buildSchedule({
      ...common,
      balance: 1_000_000,
      months: 120,
      interestOnly: [{ id: "p", fromMonth: 1, months: 30_000_000 }],
      afterInterestOnly: "keep-payment",
    })
    expect(performance.now() - t0).toBeLessThan(500)
    expect(r.months).toBe(1200)
    expect(r.truncated).toBe(true)
  })
  it("does not balloon when an interest-only period runs past the term under keep-term", () => {
    const r = buildSchedule({
      ...common,
      balance: 1_000_000,
      months: 12,
      interestOnly: [{ id: "p", fromMonth: 1, months: 12 }],
      afterInterestOnly: "keep-term",
    })
    expect(r.rows[12].principal).toBeLessThan(200_000)
    expect(r.months).toBe(24)
    expect(r.truncated).toBe(false)
  })
  it("remaining balance of 0 with a start date means paid off", () => {
    const a = analyze(base({ startDate: "2024-10-07", remainingBalance: 0 }), "2026-10-07")
    expect(a.paidOff).toBe(true)
    expect(a.scenario.months).toBe(0)
    expect(a.scenario.totalInterest).toBe(0)
  })
  it("a start date older than the term means paid off, with the full history", () => {
    const a = analyze(base({ startDate: "1990-01-01" }), "2026-10-07")
    expect(a.paidOff).toBe(true)
    expect(a.pastRows).toHaveLength(120)
    expect(a.offsetMonths).toBe(120)
    expect(a.baseline.months).toBe(0)
  })
  it("ignores remainingBalance when there is no start date", () => {
    const a = analyze(base({ remainingBalance: 400_000 }), "2026-10-07")
    expect(a.startingBalance).toBe(1_000_000)
  })
})

describe("rate periods", () => {
  const common = {
    balance: 1_000_000,
    monthlyRate: 0.06 / 12,
    months: 120,
    loanType: "annuity" as const,
    fee: 0,
    extras: [],
    interestOnly: [],
    afterInterestOnly: "keep-term" as const,
  }
  it("charges the period's rate for its months and recomputes the payment to hold the term", () => {
    const plain = buildSchedule({ ...common, ratePeriods: [] })
    const r = buildSchedule({
      ...common,
      ratePeriods: [{ id: "r", fromMonth: 13, months: 12, annualRatePct: 9 }],
    })
    expect(r.rows[12].interest).toBeCloseTo(r.rows[11].balance * 0.09 / 12, 6)
    expect(r.rows[12].interest + r.rows[12].principal).toBeGreaterThan(plain.monthlyPayment)
    expect(r.rows[24].interest).toBeCloseTo(r.rows[23].balance * 0.06 / 12, 6)
    expect(r.months).toBe(120)
    expect(r.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    expect(r.totalInterest).toBeGreaterThan(plain.totalInterest)
    expect(r.maxMonthlyPayment).toBeGreaterThan(plain.monthlyPayment)
  })
  it("a lower rate lowers the payment and interest, serial loans just pay less interest", () => {
    const r = buildSchedule({
      ...common,
      loanType: "serial",
      ratePeriods: [{ id: "r", fromMonth: 1, months: 120, annualRatePct: 3 }],
    })
    expect(r.rows[0].interest).toBeCloseTo(1_000_000 * 0.03 / 12, 6)
    expect(r.rows[0].principal).toBeCloseTo(1_000_000 / 120, 6)
    expect(r.months).toBe(120)
  })
  it("analyze keeps the baseline on the base rate", () => {
    const s = base()
    s.periods = [{ id: "r", kind: "rate", from: "2026-11", to: "2028-10", annualRatePct: 10 }]
    const a = analyze(s, "2026-10-07")
    expect(a.baseline.rows[0].interest).toBeCloseTo(5000, 6)
    expect(a.scenario.rows[0].interest).toBeCloseTo(1_000_000 * 0.1 / 12, 6)
    expect(a.delta.interest).toBeGreaterThan(0)
  })
})

describe("solveForTarget", () => {
  it("finds the smallest monthly extra (to 10 kr) that hits the target", () => {
    const s = base()
    const sol = solveForTarget(s, "2026-10-07", 60, "recurring")!
    expect(sol.amount).toBeGreaterThan(0)
    expect(sol.amount % 10).toBe(0)
    const hit = analyze({ ...s, extras: [{ id: "g", kind: "recurring", amount: sol.amount, fromMonth: 1 }] }, "2026-10-07")
    expect(hit.scenario.months).toBeLessThanOrEqual(60)
    const miss = analyze({ ...s, extras: [{ id: "g", kind: "recurring", amount: sol.amount - 10, fromMonth: 1 }] }, "2026-10-07")
    expect(miss.scenario.months).toBeGreaterThan(60)
    expect(sol.interestSaved).toBeGreaterThan(0)
  })
  it("one-off variant pays a lump sum in month 1", () => {
    const sol = solveForTarget(base(), "2026-10-07", 60, "oneoff")!
    const hit = analyze({ ...base(), extras: [{ id: "g", kind: "oneoff", amount: sol.amount, fromMonth: 1 }] }, "2026-10-07")
    expect(hit.scenario.months).toBeLessThanOrEqual(60)
  })
  it("returns 0 when already on track, and undefined when paid off", () => {
    expect(solveForTarget(base(), "2026-10-07", 120, "recurring")!.amount).toBe(0)
    expect(solveForTarget(base({ startDate: "1990-01-01" }), "2026-10-07", 12, "recurring")).toBeUndefined()
  })
  it("solves on top of the user's existing changes", () => {
    const s = base()
    s.extras = [{ id: "x", kind: "recurring", amount: 3000, fromMonth: 1 }]
    const withExisting = solveForTarget(s, "2026-10-07", 60, "recurring")!
    const without = solveForTarget(base(), "2026-10-07", 60, "recurring")!
    expect(withExisting.amount).toBeLessThan(without.amount)
  })
})

describe("calendar periods", () => {
  // No start date: anchor is today (2026-10-07), so month 1 is Nov 2026.
  it("maps calendar months to forward-plan months", () => {
    expect(periodToMonths({ from: "2026-11", to: "2027-04" }, "2026-10-07", 0)).toEqual({ fromMonth: 1, months: 6 })
    expect(periodToMonths({ from: "2027-01", to: "2027-01" }, "2026-10-07", 0)).toEqual({ fromMonth: 3, months: 1 })
  })
  it("respects payments already made", () => {
    // Loan started 2024-10-07, 24 payments made, next payment Nov 2026.
    expect(periodToMonths({ from: "2026-11", to: "2026-12" }, "2024-10-07", 24)).toEqual({ fromMonth: 1, months: 2 })
  })
  it("clips a period that started in the past and drops one that is over", () => {
    expect(periodToMonths({ from: "2026-01", to: "2027-01" }, "2026-10-07", 0)).toEqual({ fromMonth: 1, months: 3 })
    expect(periodToMonths({ from: "2025-01", to: "2026-10" }, "2026-10-07", 0)).toBeUndefined()
  })
  it("rejects malformed months", () => {
    expect(periodToMonths({ from: "2026-13", to: "2027-01" }, "2026-10-07", 0)).toBeUndefined()
    expect(periodToMonths({ from: "26-11", to: "2027-01" }, "2026-10-07", 0)).toBeUndefined()
  })
  it("splits kinds into the engine's lists", () => {
    const r = periodsToSchedule(
      [
        { id: "a", kind: "interest-only", from: "2026-11", to: "2027-01", annualRatePct: 0 },
        { id: "b", kind: "rate", from: "2027-02", to: "2027-07", annualRatePct: 0 },
      ],
      "2026-10-07",
      0,
    )
    expect(r.interestOnly).toEqual([{ id: "a", fromMonth: 1, months: 3 }])
    expect(r.ratePeriods).toEqual([{ id: "b", fromMonth: 4, months: 6, annualRatePct: 0 }])
  })
  it("a 0 % period charges no interest in exactly those months and saves money", () => {
    const s = base()
    s.periods = [{ id: "z", kind: "rate", from: "2027-01", to: "2027-06", annualRatePct: 0 }]
    const a = analyze(s, "2026-10-07")
    const rows = a.scenario.rows
    expect(rows[1].interest).toBeGreaterThan(0) // Dec 2026
    for (let i = 2; i <= 7; i++) expect(rows[i].interest).toBe(0) // Jan–Jun 2027
    expect(rows[8].interest).toBeGreaterThan(0) // Jul 2027
    expect(a.delta.interest).toBeLessThan(0)
    expect(rows.at(-1)!.balance).toBeCloseTo(0, 2)
  })
  it("an interest-only calendar period pays no principal in those months", () => {
    const s = base({ startDate: "2024-10-07" })
    s.periods = [{ id: "p", kind: "interest-only", from: "2027-03", to: "2027-05", annualRatePct: 0 }]
    const a = analyze(s, "2026-10-07")
    const due = (i: number) => addMonths("2024-10-07", a.offsetMonths + i + 1).slice(0, 7)
    a.scenario.rows.slice(0, 12).forEach((r, i) => {
      const inside = due(i) >= "2027-03" && due(i) <= "2027-05"
      expect(r.interestOnly).toBe(inside)
      if (inside) expect(r.principal).toBe(0)
    })
  })
})
