import { describe, expect, it } from "vitest"
import { decodeShare, encodeShare, parseImport } from "./share"
import { newScenario } from "./storage"

describe("share", () => {
  it("round-trips a scenario with a non-ASCII name", () => {
    const s = newScenario()
    s.loan.name = "Lån på Ås — 🏠"
    const d = decodeShare(encodeShare(s))
    expect(d?.loan.name).toBe(s.loan.name)
    expect(d?.loan.principal).toBe(s.loan.principal)
  })
  it("round-trips custom periods and extras", () => {
    const s = newScenario()
    s.extras = [{ id: "e", kind: "recurring", amount: 2000, from: "2027-01" }]
    s.periods = [
      { id: "p1", kind: "interest-only", from: "2027-01", to: "2027-06", annualRatePct: 0 },
      { id: "p2", kind: "rate", from: "2028-01", to: "2028-12", annualRatePct: 0 },
    ]
    s.afterInterestOnly = "keep-payment"
    const d = decodeShare(encodeShare(s))!
    expect(d.periods).toEqual(s.periods)
    expect(d.extras).toEqual(s.extras)
    expect(d.afterInterestOnly).toBe("keep-payment")
  })
  it("rejects hostile input instead of throwing", () => {
    expect(decodeShare("not-base64!!")).toBeUndefined()
    expect(decodeShare(btoa('{"loan":{"principal":1},"extras":{}}'))?.extras).toEqual([])
  })
  it("parseImport drops entries that cannot be sanitized", () => {
    const items = parseImport('{"items":[{"loan":{}},{"loan":{"principal":5}},null]}')
    expect(items).toHaveLength(1)
    expect(() => parseImport("null")).toThrow(/export/i)
  })
})
