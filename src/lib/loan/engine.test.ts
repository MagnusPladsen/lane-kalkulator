import { describe, expect, it } from "vitest"
import {
  yearFraction,
  planEffectiveRate,
  solveMonthlyFee,
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
    s.extras = [{ id: "x", kind: "recurring", amount: 3000, from: "2026-11" }]
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
    const hit = analyze({ ...s, extras: [{ id: "g", kind: "recurring", amount: sol.amount, from: "2026-11" }] }, "2026-10-07")
    expect(hit.scenario.months).toBeLessThanOrEqual(60)
    const miss = analyze({ ...s, extras: [{ id: "g", kind: "recurring", amount: sol.amount - 10, from: "2026-11" }] }, "2026-10-07")
    expect(miss.scenario.months).toBeGreaterThan(60)
    expect(sol.interestSaved).toBeGreaterThan(0)
  })
  it("one-off variant pays a lump sum in month 1", () => {
    const sol = solveForTarget(base(), "2026-10-07", 60, "oneoff")!
    const hit = analyze({ ...base(), extras: [{ id: "g", kind: "oneoff", amount: sol.amount, from: "2026-11" }] }, "2026-10-07")
    expect(hit.scenario.months).toBeLessThanOrEqual(60)
  })
  it("returns 0 when already on track, and undefined when paid off", () => {
    expect(solveForTarget(base(), "2026-10-07", 120, "recurring")!.amount).toBe(0)
    expect(solveForTarget(base({ startDate: "1990-01-01" }), "2026-10-07", 12, "recurring")).toBeUndefined()
  })
  it("solves on top of the user's existing changes", () => {
    const s = base()
    s.extras = [{ id: "x", kind: "recurring", amount: 3000, from: "2026-11" }]
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

describe("calculation review: closed-form checks", () => {
  // Independent formulas, not the engine's own loop.
  const P = 3_000_000
  const r = 0.0615 / 12
  const n = 300
  const A = (P * r) / (1 - Math.pow(1 + r, -n))
  const balanceAfter = (k: number) => P * Math.pow(1 + r, k) - (A * (Math.pow(1 + r, k) - 1)) / r

  it("annuity payment and balance match the textbook formulas every month", () => {
    const s = buildSchedule({
      balance: P, monthlyRate: r, months: n, loanType: "annuity", fee: 0,
      extras: [], interestOnly: [], afterInterestOnly: "keep-term",
    })
    expect(s.months).toBe(n)
    expect(s.monthlyPayment).toBeCloseTo(A, 6)
    for (const k of [1, 12, 60, 150, 299]) expect(s.rows[k - 1].balance).toBeCloseTo(balanceAfter(k), 4)
    expect(s.totalInterest).toBeCloseTo(A * n - P, 2)
  })
  it("serial loan interest totals r·P·(n+1)/2", () => {
    const s = buildSchedule({
      balance: P, monthlyRate: r, months: n, loanType: "serial", fee: 0,
      extras: [], interestOnly: [], afterInterestOnly: "keep-term",
    })
    expect(s.totalInterest).toBeCloseTo((r * P * (n + 1)) / 2, 2)
  })
  it("today's balance from a start date equals the closed form after the elapsed payments", () => {
    const a = analyze(
      { ...base({ principal: P, annualRatePct: 6.15, termMonths: n, startDate: "2022-03-01" }) },
      "2026-10-07",
    )
    // Mar 2022 → Oct 2026: 55 payments made.
    expect(a.offsetMonths).toBe(55)
    expect(a.startingBalance).toBeCloseTo(balanceAfter(55), 4)
  })
})

describe("effective rate", () => {
  const loan = (over: Partial<Scenario["loan"]> = {}) => base({ principal: 3_000_000, annualRatePct: 6.15, termMonths: 300, ...over }).loan
  it("without fees it is just monthly compounding, (1 + i/12)^12 − 1", () => {
    expect(planEffectiveRate(loan())!).toBeCloseTo((Math.pow(1 + 0.0615 / 12, 12) - 1) * 100, 6)
  })
  it("fees raise it, and the payments discounted at that rate give back the payout", () => {
    const l = loan({ monthlyFee: 75, setupFee: 2_500 })
    const eff = planEffectiveRate(l)!
    expect(eff).toBeGreaterThan(6.333)
    const m = Math.pow(1 + eff / 100, 1 / 12) - 1
    const plan = buildSchedule({
      balance: l.principal, monthlyRate: 0.0615 / 12, months: 300, loanType: "annuity", fee: 75,
      extras: [], interestOnly: [], afterInterestOnly: "keep-term",
    })
    const pv = plan.rows.reduce((sum, row, k) => sum + row.payment / Math.pow(1 + m, k + 1), 0)
    expect(pv).toBeCloseTo(3_000_000 - 2_500, 0)
  })
  it("solving for the monthly fee recovers a known fee", () => {
    const target = planEffectiveRate(loan({ monthlyFee: 75, setupFee: 2_500 }))!
    expect(solveMonthlyFee(loan({ monthlyFee: 0, setupFee: 2_500 }), target)).toBe(75)
  })
  it("gives up when no fee can reach the target", () => {
    expect(solveMonthlyFee(loan(), 5)).toBeUndefined()
  })
})

describe("history follows past periods and extras", () => {
  const start = "2024-10-07"
  const today = "2026-10-07" // 24 payments made; first payment Nov 2024
  it("a 0 % period at the start lowers today's balance and lifetime interest", () => {
    const s = base({ startDate: start })
    s.periods = [{ id: "z", kind: "rate", from: "2024-11", to: "2025-10", annualRatePct: 0 }]
    const a = analyze(s, today)
    for (let i = 0; i < 12; i++) expect(a.pastRows[i].interest).toBe(0)
    expect(a.pastRows[12].interest).toBeGreaterThan(0)
    expect(a.baselinePastRows[0].interest).toBeGreaterThan(0)
    expect(a.startingBalance).toBeLessThan(a.baselineStartingBalance)
    expect(a.past.scenario.interest).toBeLessThan(a.past.baseline.interest)
    expect(a.delta.interest).toBeLessThan(a.past.scenario.interest - a.past.baseline.interest + 1)
    expect(a.delta.interest).toBeLessThan(0)
    expect(a.scenario.rows.at(-1)!.balance).toBeCloseTo(0, 2)
  })
  it("with a typed-in balance, past changes only move history and interest so far", () => {
    const s = base({ startDate: start, remainingBalance: 800_000 })
    s.periods = [{ id: "z", kind: "rate", from: "2024-11", to: "2025-10", annualRatePct: 0 }]
    const a = analyze(s, today)
    expect(a.balancePinned).toBe(true)
    expect(a.startingBalance).toBe(800_000)
    expect(a.baselineStartingBalance).toBe(800_000)
    expect(a.delta.months).toBe(0)
    expect(a.delta.interest).toBeCloseTo(a.past.scenario.interest - a.past.baseline.interest, 6)
  })
  it("a past one-off extra pays the loan down in history", () => {
    const s = base({ startDate: start })
    s.extras = [{ id: "x", kind: "oneoff", amount: 100_000, from: "2025-06" }]
    const a = analyze(s, today)
    expect(a.pastRows.some((r) => r.extra === 100_000)).toBe(true)
    expect(a.baselineStartingBalance - a.startingBalance).toBeGreaterThan(100_000)
  })
  it("a period spanning today continues seamlessly into the forward plan", () => {
    const s = base({ startDate: start })
    s.periods = [{ id: "p", kind: "interest-only", from: "2026-05", to: "2027-04", annualRatePct: 0 }]
    s.afterInterestOnly = "keep-payment"
    const a = analyze(s, today)
    expect(a.pastRows.slice(-6).every((r) => r.interestOnly)).toBe(true)
    expect(a.scenario.rows.slice(0, 6).every((r) => r.interestOnly)).toBe(true)
    expect(a.scenario.rows[6].interestOnly).toBe(false)
    // keep-payment: the full 12-month pause extends the loan by 12 months
    expect(a.scenario.months - a.baseline.months).toBe(12)
  })
  it("the setup fee counts in lifetime cost on both sides", () => {
    const a = analyze(base({ setupFee: 2_500 }), today)
    expect(a.lifetime.baseline.fees).toBe(2_500)
    expect(a.lifetime.scenario.paid - a.scenario.totalPaid).toBe(2_500)
    expect(a.delta.totalCost).toBe(0)
  })
})

describe("loan intro terms", () => {
  it("first 3 years interest-only is part of the loan: both plans, end date kept", () => {
    const a = analyze(base({ intro: { kind: "interest-only", months: 36, annualRatePct: 0 } }), "2026-10-07")
    expect(a.baseline.rows.slice(0, 36).every((r) => r.interestOnly && r.principal === 0)).toBe(true)
    expect(a.baseline.rows[36].interestOnly).toBe(false)
    expect(a.baseline.months).toBe(120)
    expect(a.delta.months).toBe(0)
    expect(a.delta.interest).toBeCloseTo(0, 6)
  })
  it("stays keep-term even when the user's what-if pauses use keep-payment", () => {
    const s = base({ intro: { kind: "interest-only", months: 36, annualRatePct: 0 } })
    s.afterInterestOnly = "keep-payment"
    const a = analyze(s, "2026-10-07")
    expect(a.scenario.months).toBe(120)
    expect(a.delta.interest).toBeCloseTo(0, 6)
  })
  it("first 3 years at 0 % charges no interest then re-prices at the normal rate", () => {
    const a = analyze(base({ intro: { kind: "rate", months: 36, annualRatePct: 0 } }), "2026-10-07")
    expect(a.baseline.rows.slice(0, 36).every((r) => r.interest === 0)).toBe(true)
    expect(a.baseline.rows[36].interest).toBeGreaterThan(0)
    expect(a.baseline.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    expect(a.baseline.months).toBe(120)
  })
  it("with a start date, the intro shows up in history, not again from today", () => {
    const a = analyze(
      base({ startDate: "2024-10-07", intro: { kind: "interest-only", months: 36, annualRatePct: 0 } }),
      "2026-10-07",
    )
    expect(a.pastRows.every((r) => r.interestOnly)).toBe(true) // 24 months so far
    expect(a.scenario.rows.slice(0, 12).every((r) => r.interestOnly)).toBe(true)
    expect(a.scenario.rows[12].interestOnly).toBe(false)
    expect(a.startingBalance).toBe(1_000_000)
  })
  it("the bank's effective rate includes intro terms", () => {
    const plain = planEffectiveRate(base().loan)!
    const zeroStart = planEffectiveRate(base({ intro: { kind: "rate", months: 36, annualRatePct: 0 } }).loan)!
    expect(zeroStart).toBeLessThan(plain)
  })
})

describe("re-pricing keeps the plan's current end date (verifier findings)", () => {
  const P = 3_000_000
  const r = 0.0615 / 12
  const common = {
    balance: P, monthlyRate: r, months: 300, loanType: "annuity" as const, fee: 0,
    interestOnly: [] as { id: string; fromMonth: number; months: number }[],
  }
  it("a rate change after an extra payment keeps the shortened term", () => {
    const extras = [{ id: "x", kind: "oneoff" as const, amount: 500_000, fromMonth: 12 }]
    const alone = buildSchedule({ ...common, extras, afterInterestOnly: "keep-term" })
    expect(alone.months).toBe(212)
    const withRate = buildSchedule({
      ...common, extras, afterInterestOnly: "keep-term",
      ratePeriods: [{ id: "r", fromMonth: 24, months: 1000, annualRatePct: 6.4 }],
    })
    expect(withRate.months).toBe(212)
    expect(withRate.totalInterest).toBeCloseTo(1_715_539, -1)
  })
  it("a keep-payment pause keeps its longer term through a later rate change", () => {
    const pause = { interestOnly: [{ id: "p", fromMonth: 1, months: 24 }], afterInterestOnly: "keep-payment" as const }
    expect(buildSchedule({ ...common, extras: [], ...pause }).months).toBe(324)
    const withRate = buildSchedule({
      ...common, extras: [], ...pause,
      ratePeriods: [{ id: "r", fromMonth: 36, months: 1000, annualRatePct: 6.4 }],
    })
    expect(withRate.months).toBe(324)
  })
  it("a long keep-payment pause plus a steep rate rise still pays off, no runaway", () => {
    const s = buildSchedule({
      ...common, extras: [],
      interestOnly: [{ id: "p", fromMonth: 1, months: 120 }], afterInterestOnly: "keep-payment",
      ratePeriods: [{ id: "r", fromMonth: 301, months: 1000, annualRatePct: 14 }],
    })
    expect(s.truncated).toBe(false)
    expect(s.months).toBe(420)
    expect(s.rows.at(-1)!.balance).toBeCloseTo(0, 2)
  })
  it("a rate change during a keep-payment pause doesn't depend on whether it lands inside the pause", () => {
    const run = (from: number) =>
      buildSchedule({
        ...common, extras: [],
        interestOnly: [{ id: "p", fromMonth: 1, months: 24 }], afterInterestOnly: "keep-payment",
        ratePeriods: [{ id: "r", fromMonth: from, months: 1000, annualRatePct: 7 }],
      }).months
    expect(run(12)).toBe(324)
    expect(run(25)).toBe(324)
  })
  it("extra payments then a keep-term pause hold the shortened end date", () => {
    const s = buildSchedule({
      ...common,
      extras: [{ id: "x", kind: "oneoff", amount: 500_000, fromMonth: 12 }],
      interestOnly: [{ id: "p", fromMonth: 30, months: 6 }], afterInterestOnly: "keep-term",
    })
    expect(s.months).toBe(212)
  })
})

describe("typed-in balance and lifetime totals", () => {
  it("lifetime principal repaid never exceeds the loan", () => {
    const a = analyze(
      base({ principal: 3_000_000, annualRatePct: 6.15, termMonths: 300, startDate: "2020-01-15", remainingBalance: 2_900_000 }),
      "2026-10-07",
    )
    const principalRepaid = a.lifetime.scenario.paid - a.lifetime.scenario.interest - a.lifetime.scenario.fees
    expect(principalRepaid).toBeCloseTo(3_000_000, 0)
  })
})

describe("day count (rentedager)", () => {
  it("year fractions follow the calendar", () => {
    expect(yearFraction("2026-02-01", "2026-03-01", "act/act")).toBeCloseTo(28 / 365, 12)
    expect(yearFraction("2028-02-01", "2028-03-01", "act/act")).toBeCloseTo(29 / 366, 12)
    // Crossing New Year into a leap year: 17 days of 2027, 14 days of 2028.
    expect(yearFraction("2027-12-15", "2028-01-15", "act/act")).toBeCloseTo(17 / 365 + 14 / 366, 12)
    expect(yearFraction("2026-01-01", "2026-02-01", "act/360")).toBeCloseTo(31 / 360, 12)
    expect(yearFraction("2026-01-31", "2026-02-28", "30/360")).toBeCloseTo(1 / 12, 12)
  })
  const loan = (dayCount?: "30/360" | "act/act" | "act/360") =>
    base({ principal: 3_000_000, annualRatePct: 6.15, termMonths: 300, startDate: "2026-01-01", dayCount })
  it("act/act: February interest is balance × rate × 28/365", () => {
    const a = analyze(loan("act/act"), "2026-01-01")
    const feb = a.scenario.rows[1] // payment due 2026-03-01 covers February
    const balJan = a.scenario.rows[0].balance
    expect(feb.interest).toBeCloseTo(balJan * 0.0615 * 28 / 365, 6)
    expect(a.scenario.rows[0].interest).toBeCloseTo(3_000_000 * 0.0615 * 31 / 365, 6)
    expect(a.scenario.rows[0].interest).toBeCloseTo(15_669.86, 1)
  })
  it("the payment stays the bank's annuity amount; only its interest share moves", () => {
    const a = analyze(loan("act/act"), "2026-01-01")
    const A = (3_000_000 * (0.0615 / 12)) / (1 - Math.pow(1 + 0.0615 / 12, -300))
    for (const r of a.scenario.rows.slice(0, 24)) expect(r.interest + r.principal).toBeCloseTo(A, 6)
    expect(a.scenario.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    expect(Math.abs(a.scenario.months - 300)).toBeLessThanOrEqual(1)
  })
  it("every day count still ends on the agreed term", () => {
    for (const dc of ["30/360", "act/act", "act/360"] as const) {
      const a = analyze(loan(dc), "2026-01-01")
      expect(a.scenario.months).toBeLessThanOrEqual(300)
      expect(a.scenario.months).toBeGreaterThanOrEqual(299)
      expect(a.scenario.rows.at(-1)!.balance).toBeCloseTo(0, 2)
    }
  })
  it("a day-count remainder is settled in the last planned payment, not a month later", () => {
    const s = base({ principal: 3_000_000, annualRatePct: 5.3, termMonths: 300, startDate: "2023-05-15", dayCount: "act/act" })
    const plain = analyze(s, "2026-10-08")
    expect(plain.scenario.payoffDate).toBe("2048-05-15")
    const last = plain.scenario.rows.at(-1)!
    const before = plain.scenario.rows.at(-2)!
    expect(last.principal + last.interest).toBeGreaterThan(before.principal + before.interest)
    expect(last.principal + last.interest - (before.principal + before.interest)).toBeLessThan(5_000)
    // A higher rate re-prices over the same end date, so it must not end the loan earlier.
    const dearer = analyze({ ...s, periods: [{ id: "p", kind: "rate", from: "2026-10", to: "2048-12", annualRatePct: 7.3 }] }, "2026-10-08")
    expect(dearer.scenario.payoffDate).toBe(plain.scenario.payoffDate)
    expect(dearer.delta.months).toBe(0)
  })
  it("act/360 costs more than act/act, which is close to 30/360 over the life of the loan", () => {
    const i = (dc?: "30/360" | "act/act" | "act/360") => analyze(loan(dc), "2026-01-01").lifetime.scenario.interest
    const flat = i("30/360")
    const actAct = i("act/act")
    const act360 = i("act/360")
    expect(i(undefined)).toBe(flat)
    expect(Math.abs(actAct - flat) / flat).toBeLessThan(0.01)
    expect(act360).toBeGreaterThan(actAct * 1.01)
  })
  it("the effective rate reflects the day count", () => {
    const flat = planEffectiveRate(loan("30/360").loan, "2026-01-01")!
    const act360 = planEffectiveRate(loan("act/360").loan, "2026-01-01")!
    expect(act360).toBeGreaterThan(flat + 0.05)
  })
  it("past history and the forward plan use the same calendar", () => {
    const a = analyze(base({ principal: 1_000_000, annualRatePct: 6, termMonths: 120, startDate: "2024-10-07", dayCount: "act/act" }), "2026-10-07")
    // First forward payment is due 2026-11-07 and covers 7 Oct → 7 Nov: 31 days of 2026.
    expect(a.scenario.rows[0].interest).toBeCloseTo(a.startingBalance * 0.06 * 31 / 365, 6)
  })
})
