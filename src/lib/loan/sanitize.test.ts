import { describe, expect, it } from "vitest"
import { sanitizeScenario } from "./sanitize"
import { analyze } from "./engine"

describe("sanitizeScenario", () => {
  it("rejects garbage", () => {
    expect(sanitizeScenario(null)).toBeUndefined()
    expect(sanitizeScenario("x")).toBeUndefined()
    expect(sanitizeScenario({ loan: {} })).toBeUndefined()
    expect(sanitizeScenario({ loan: { principal: "abc" } })).toBeUndefined()
  })
  it("coerces a minimal loan into a full, analyzable scenario", () => {
    const s = sanitizeScenario({ loan: { principal: 100_000 } })
    expect(s).toBeDefined()
    expect(s!.loan.annualRatePct).toBe(0)
    expect(s!.loan.termMonths).toBeGreaterThan(0)
    expect(s!.extras).toEqual([])
    expect(() => analyze(s!, "2026-10-07")).not.toThrow()
  })
  it("drops malformed extras and legacy interest-only entries, clamps the rest", () => {
    const s = sanitizeScenario(
      {
        loan: { principal: 1_000_000, annualRatePct: 5, termMonths: 120, startDate: "2026-02-31" },
        extras: {},
        interestOnly: [{ fromMonth: 1, months: 30_000_000 }, { fromMonth: "x" }, null],
        afterInterestOnly: "nonsense",
      },
      "2026-10-07",
    )!
    expect(s.extras).toEqual([])
    expect(s.periods).toHaveLength(1)
    expect(s.periods[0]).toMatchObject({ kind: "interest-only", from: "2026-11", to: "2100-12" })
    expect(s.afterInterestOnly).toBe("keep-term")
    expect(s.loan.startDate).toBeUndefined()
  })
  it("rejects years outside 1900–2100 and pads nothing weird through", () => {
    expect(sanitizeScenario({ loan: { principal: 1, startDate: "0002-10-07" } })!.loan.startDate).toBeUndefined()
    expect(sanitizeScenario({ loan: { principal: 1, startDate: "2024-10-07" } })!.loan.startDate).toBe("2024-10-07")
  })
  it("caps array lengths and name length", () => {
    const s = sanitizeScenario({
      loan: { principal: 1, name: "x".repeat(500) },
      extras: Array.from({ length: 500 }, () => ({ kind: "oneoff", amount: 1, fromMonth: 1 })),
    })!
    expect(s.extras.length).toBeLessThanOrEqual(50)
    expect(s.loan.name.length).toBeLessThanOrEqual(80)
  })
})

describe("periods", () => {
  it("migrates legacy relative periods to calendar months on read", () => {
    const s = sanitizeScenario(
      {
        loan: { principal: 1_000_000, annualRatePct: 5, termMonths: 120, startDate: "2024-10-07" },
        interestOnly: [{ id: "io", fromMonth: 3, months: 6 }],
        ratePeriods: [{ id: "rp", fromMonth: 1, months: 12, annualRatePct: 0 }],
      },
      "2026-10-07",
    )!
    // 24 payments made; month 1 is Nov 2026.
    expect(s.periods).toEqual([
      { id: "io", kind: "interest-only", from: "2027-01", to: "2027-06", annualRatePct: 0 },
      { id: "rp", kind: "rate", from: "2026-11", to: "2027-10", annualRatePct: 0 },
    ])
  })
  it("keeps valid calendar periods, swaps reversed ends, drops junk", () => {
    const s = sanitizeScenario({
      loan: { principal: 1_000_000 },
      periods: [
        { id: "a", kind: "rate", from: "2027-06", to: "2027-01", annualRatePct: "2.5" },
        { kind: "interest-only", from: "2027-13", to: "2028-01" },
        { kind: "weird", from: "2027-01", to: "2027-02", annualRatePct: 500 },
        "nope",
      ],
    })!
    expect(s.periods).toHaveLength(2)
    expect(s.periods[0]).toMatchObject({ id: "a", kind: "rate", from: "2027-01", to: "2027-06", annualRatePct: 2.5 })
    expect(s.periods[1]).toMatchObject({ kind: "interest-only", annualRatePct: 100 })
  })
  it("prefers new-style periods over legacy fields when both exist", () => {
    const s = sanitizeScenario({
      loan: { principal: 1_000_000 },
      periods: [],
      interestOnly: [{ fromMonth: 1, months: 6 }],
    })!
    expect(s.periods).toEqual([])
  })
})
