import { describe, expect, it } from "vitest"
import { planCsv } from "./exportPlan"
import { analyze } from "./loan/engine"
import type { Scenario } from "./loan/types"

const labels = { month: "Måned", payment: "Terminbeløp", interest: "Renter", principal: "Avdrag", extra: "Ekstra", fee: "Gebyr", balance: "Restgjeld", rate: "Rente %" }

describe("planCsv", () => {
  const s: Scenario = {
    id: "x", savedAt: "", extras: [], periods: [], afterInterestOnly: "keep-term",
    loan: { name: "", principal: 120_000, annualRatePct: 6, termMonths: 12, loanType: "annuity", monthlyFee: 30 },
  }
  const a = analyze(s, "2026-10-09")
  const csv = planCsv(a.scenario.rows, (i) => `2026-${String(i + 11).padStart(2, "0")}`, labels)
  const lines = csv.replace("﻿", "").trim().split("\r\n")
  it("has a byte-order mark, a heading and one line per month", () => {
    expect(csv.startsWith("﻿")).toBe(true)
    expect(lines[0]).toBe("Måned;Terminbeløp;Renter;Avdrag;Ekstra;Gebyr;Restgjeld;Rente %")
    expect(lines).toHaveLength(13)
  })
  it("writes Norwegian decimals and ends at zero balance", () => {
    expect(lines[1]).toMatch(/^2026-11;\d+,\d{2};600,00;\d+,\d{2};0,00;30,00;\d+,\d{2};6,00$/)
    expect(lines.at(-1)).toMatch(/;0,00;6,00$/)
  })
})
