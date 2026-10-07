import { describe, expect, it } from "vitest"
import { parseAmount } from "./parseAmount"

describe("parseAmount", () => {
  it("reads plain and space-grouped numbers", () => {
    expect(parseAmount("3000000", "nb")).toBe(3_000_000)
    expect(parseAmount("3 000 000", "nb")).toBe(3_000_000)
    expect(parseAmount("3 000 000 kr", "nb")).toBe(3_000_000)
  })
  it("keeps decimals instead of multiplying by 100", () => {
    expect(parseAmount("1000.50", "nb")).toBe(1000.5)
    expect(parseAmount("1000,50", "nb")).toBe(1000.5)
    expect(parseAmount("1 000,5", "nb")).toBe(1000.5)
    expect(parseAmount("1000.50", "en")).toBe(1000.5)
  })
  it("reads pasted English and European grouping", () => {
    expect(parseAmount("3,000,000", "en")).toBe(3_000_000)
    expect(parseAmount("3,000,000", "nb")).toBe(3_000_000)
    expect(parseAmount("1.000.000", "nb")).toBe(1_000_000)
    expect(parseAmount("1.000.000,75", "pl")).toBe(1_000_000.75)
    expect(parseAmount("1,000,000.75", "en")).toBe(1_000_000.75)
  })
  it("resolves a lone separator with three digits by language", () => {
    expect(parseAmount("1.500", "nb")).toBe(1500)
    expect(parseAmount("1,500", "nb")).toBe(1.5)
    expect(parseAmount("1,500", "en")).toBe(1500)
    expect(parseAmount("1.500", "en")).toBe(1.5)
  })
  it("returns undefined for nothing usable", () => {
    expect(parseAmount("", "nb")).toBeUndefined()
    expect(parseAmount(",", "nb")).toBeUndefined()
    expect(parseAmount("kr", "nb")).toBeUndefined()
  })
  it("never yields a negative number", () => {
    expect(parseAmount("-500", "nb")).toBe(500)
  })
})
