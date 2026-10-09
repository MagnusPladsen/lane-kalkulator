import { describe, expect, it } from "vitest"
import { decodeOffers, encodeOffers } from "./compareShare"
import type { Offer } from "./compare"

const a: Offer = { name: "Bank A", principal: 3_000_000, annualRatePct: 5.1, termMonths: 300, loanType: "annuity", monthlyFee: 50, setupFee: 2500 }
const b: Offer = { ...a, name: "Bank B", annualRatePct: 4.95, monthlyFee: 75, loanType: "serial", dayCount: "act/act" }

describe("compare share", () => {
  it("round-trips two offers", () => {
    expect(decodeOffers(encodeOffers(a, b))).toEqual({ a: { ...a, dayCount: undefined }, b })
  })
  it("rejects garbage and out-of-range values without throwing", () => {
    expect(decodeOffers("not-base64!!")).toBeUndefined()
    expect(decodeOffers(encodeOffers({ ...a, principal: -5 }, b))).toBeUndefined()
    expect(decodeOffers(encodeOffers({ ...a, annualRatePct: Number.NaN }, b))).toBeUndefined()
  })
  it("survives a link broken over lines", () => {
    const code = encodeOffers(a, b)
    expect(decodeOffers(code.slice(0, 10) + "\n " + code.slice(10))).toBeDefined()
  })
})
