import { describe, expect, it } from "vitest"
import overview from "./__fixtures__/overview.txt?raw"
import details from "./__fixtures__/details.txt?raw"
import history from "./__fixtures__/history.txt?raw"
import { parseDate, parseLoanText } from "./parseLoanText"
import { scanToLoan } from "./scanToLoan"

// Real OCR output from bank screenshots, with personal details and amounts replaced.
const FIXTURES: Record<string, string> = { overview, details, history }
const fx = (name: string) => FIXTURES[name]
const all = [fx("overview"), fx("details"), fx("history")].join("\n")

describe("parseDate", () => {
  it("reads the formats banks use", () => {
    expect(parseDate("19 May 2026")).toBe("2026-05-19")
    expect(parseDate("19. mai 2026")).toBe("2026-05-19")
    expect(parseDate("20. mars 2069")).toBe("2069-03-20")
    expect(parseDate("19.05.2026")).toBe("2026-05-19")
    expect(parseDate("19.05.26")).toBe("2026-05-19")
    expect(parseDate("2026-05-19")).toBe("2026-05-19")
    expect(parseDate("no date here")).toBeUndefined()
  })
})

describe("parseLoanText on a real loan-details screenshot", () => {
  const s = parseLoanText(fx("details"))
  it("reads every labelled field", () => {
    expect(s.lender?.value).toBe("Eksempel Kommune")
    expect(s.nominalRatePct?.value).toBe(4.375)
    expect(s.effectiveRatePct?.value).toBe(4.52)
    expect(s.loanType?.value).toBe("annuity")
    expect(s.termAmount?.value).toBe(10349.34)
    expect(s.currentBalance?.value).toBe(2380012.4)
    expect(s.principal?.value).toBe(2_400_000)
    expect(s.dueDay?.value).toBe(20)
    expect(s.startDate?.value).toBe("2026-05-19")
    expect(s.endDate?.value).toBe("2069-03-20")
    expect(s.remainingMonths?.value).toBe(42 * 12 + 5)
  })
  it("keeps the source line so the user can check it", () => {
    expect(s.termAmount?.source).toBe("Next term amount 10 349,34 kr")
  })
})

describe("several screenshots together", () => {
  it("rejects the overview's misread payment (\"1034934\") and keeps the detail page's", () => {
    const s = parseLoanText(all)
    expect(s.termAmount?.value).toBe(10349.34)
  })
  it("reads the fee from payment history despite the misread minus sign", () => {
    expect(parseLoanText(fx("history")).fee?.value).toBe(65)
  })
  it("knows it is a startlån from the overview", () => {
    expect(parseLoanText(all).isStartLoan).toBe(true)
  })
})

describe("scanToLoan", () => {
  const today = "2026-10-07"
  it("turns the details page into loan settings that reproduce the bank's payment", () => {
    const { patch, derived } = scanToLoan(parseLoanText(fx("details")), today)
    expect(patch).toMatchObject({
      name: "Eksempel Kommune",
      principal: 2_400_000,
      annualRatePct: 4.375,
      effectiveRatePct: 4.52,
      loanType: "annuity",
      startDate: "2026-05-20", // moved to the due day so payments land on the 20th
      termMonths: 514, // May 2026 → Mar 2069
      remainingBalance: 2380012.4,
      monthlyFee: 65, // payment minus the annuity part
    })
    expect(derived).toMatchObject({ startDate: "dueDay", termMonths: "endDate", monthlyFee: "termAmount" })
  })
  it("prefers a fee that is shown over one worked out", () => {
    const { patch, derived } = scanToLoan(parseLoanText(all), today)
    expect(patch.monthlyFee).toBe(65)
    expect(derived.monthlyFee).toBeUndefined()
    expect(patch.name).toBe("Startlån – Eksempel Kommune")
  })
  it("Norwegian labels work too", () => {
    const text = [
      "Långiver DNB Bank",
      "Nominell rente 5,24 %",
      "Effektiv rente 5,48 %",
      "Lånetype Serielån",
      "Lånebeløp 1 500 000 kr",
      "Startdato 15.03.2024",
      "Sluttdato 15.03.2049",
      "Termingebyr 65 kr",
    ].join("\n")
    const { patch } = scanToLoan(parseLoanText(text), today)
    expect(patch).toMatchObject({
      name: "DNB Bank",
      annualRatePct: 5.24,
      effectiveRatePct: 5.48,
      loanType: "serial",
      principal: 1_500_000,
      startDate: "2024-03-15",
      termMonths: 300,
      monthlyFee: 65,
    })
  })
  it("returns nothing for text that isn't a loan", () => {
    expect(scanToLoan(parseLoanText("Hello world\nNothing here"), today).patch).toEqual({})
  })
})
