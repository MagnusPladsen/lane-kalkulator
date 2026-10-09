import { describe, expect, it } from "vitest"
import { isPristine, newScenario } from "./storage"
import { sanitizeScenario } from "./loan/sanitize"

describe("isPristine", () => {
  it("treats an untouched loan of any type as new, whatever order its fields come back in", () => {
    for (const c of [undefined, "mortgage", "startlan", "car", "consumer", "student"] as const) {
      const fresh = newScenario(c)
      expect(isPristine(fresh)).toBe(true)
      // Round-trip through storage's sanitizer, as a saved draft would.
      expect(isPristine(sanitizeScenario(JSON.parse(JSON.stringify(fresh)))!)).toBe(true)
    }
  })
  it("sees an edit", () => {
    const s = newScenario("car")
    expect(isPristine({ ...s, loan: { ...s.loan, principal: s.loan.principal + 1 } })).toBe(false)
  })
})
