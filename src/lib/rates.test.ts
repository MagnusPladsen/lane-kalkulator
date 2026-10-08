import { describe, expect, it } from "vitest"
import { PRESETS, tableRate } from "./rates"

describe("typical rates table", () => {
  it("switches to the next row from its start date", () => {
    expect(tableRate("student", "2026-10-08")?.ratePct).toBe(4.602)
    expect(tableRate("student", "2026-11-01")?.ratePct).toBe(4.707)
  })
  it("shows ranges for loan types where one number would be false precision", () => {
    expect(tableRate("car", "2026-10-08")?.range).toEqual([6, 8])
    expect(tableRate("consumer", "2026-10-08")?.range).toEqual([9, 15])
  })
  it("has a preset for every loan type", () => {
    for (const k of ["mortgage", "startlan", "car", "consumer", "student"] as const) expect(PRESETS[k].termMonths).toBeGreaterThan(0)
  })
})
