import { describe, expect, it } from "vitest"
import { latest, parseJsonStat } from "./rateHistory"

// Two bindings x three months, in SSB's dimension order with single-valued dimensions in between.
const cube = {
  id: ["Utlanstype", "Sektor", "Rentebinding", "ContentsCode", "Tid"],
  size: [1, 1, 2, 1, 3],
  dimension: {
    Rentebinding: { category: { index: { "08": 0, "10": 1 } } },
    Tid: { category: { index: { "2025M07": 0, "2025M08": 1, "2026M08": 2 } } },
  },
  value: [5.0, 5.1, 5.31, 4.9, null, 4.8],
}

describe("parseJsonStat", () => {
  it("splits the cube into one series per binding, oldest month first", () => {
    const h = parseJsonStat(cube)!
    expect(h.months).toEqual(["2025-07", "2025-08", "2026-08"])
    expect(h.series.floating).toEqual([5.0, 5.1, 5.31])
    expect(h.series.fixed1to3).toEqual([4.9, null, 4.8])
    expect(h.series.fixedOver5).toEqual([null, null, null])
  })
  it("rejects malformed input", () => {
    expect(parseJsonStat({})).toBeUndefined()
  })
})

describe("latest", () => {
  it("gives the last value and its changes, skipping gaps", () => {
    const h = parseJsonStat(cube)!
    const l = latest(h, "floating")!
    expect(l.value).toBe(5.31)
    expect(l.month).toBe("2026-08")
    expect(l.change1).toBeCloseTo(0.21, 10)
    expect(latest(h, "fixed1to3")!.change1).toBeUndefined()
    expect(latest(h, "fixedOver5")).toBeUndefined()
  })
})
