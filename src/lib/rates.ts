import type { LoanCategory, LoanInput } from "./loan/types"

export interface TypicalRate {
  /** Suggested nominal rate to fill in. */
  ratePct: number
  /** Typical range when a single number would be false precision. */
  range?: [number, number]
  /** What the range describes. */
  rangeKind?: "nominal" | "effective"
  source: string
  sourceUrl: string
  /** "YYYY-MM" the figure refers to. */
  asOf: string
  /** i18n key for an extra caveat. */
  noteKey?: string
}

/** Usual terms per loan type in Norway. Applied only when the user asks. */
export const PRESETS: Record<LoanCategory, Pick<LoanInput, "loanType" | "termMonths" | "monthlyFee" | "dayCount">> = {
  mortgage: { loanType: "annuity", termMonths: 300, monthlyFee: 50, dayCount: "act/act" },
  startlan: { loanType: "annuity", termMonths: 360, monthlyFee: 50, dayCount: "act/act" },
  car: { loanType: "annuity", termMonths: 60, monthlyFee: 95, dayCount: "act/act" },
  consumer: { loanType: "annuity", termMonths: 60, monthlyFee: 40, dayCount: "act/act" },
  student: { loanType: "annuity", termMonths: 240, monthlyFee: 0, dayCount: "act/act" },
}

/**
 * Hand-maintained typical rates for loan types with no live official feed.
 * Update now and then; each row says where the number came from and when.
 * Checked 2026-10-08.
 */
const TABLE: Record<Exclude<LoanCategory, "mortgage">, (TypicalRate & { from?: string })[]> = {
  student: [
    { from: "2026-09-01", ratePct: 4.602, source: "Lånekassen", sourceUrl: "https://lanekassen.no/nb-NO/presse-og-samfunnskontakt/nyheter/", asOf: "2026-09" },
    { from: "2026-11-01", ratePct: 4.707, source: "Lånekassen", sourceUrl: "https://lanekassen.no/nb-NO/presse-og-samfunnskontakt/nyheter/", asOf: "2026-11" },
  ],
  startlan: [
    { ratePct: 4.025, source: "Husbanken", sourceUrl: "https://www.husbanken.no/startlan/", asOf: "2026-08", noteKey: "rates.noteStartlan" },
  ],
  car: [
    { ratePct: 6.5, range: [6, 8], rangeKind: "effective", source: "Finansportalen m.fl.", sourceUrl: "https://www.finansportalen.no/bank/billan/", asOf: "2026-10", noteKey: "rates.noteCar" },
  ],
  consumer: [
    { ratePct: 12, range: [9, 15], rangeKind: "nominal", source: "Finansportalen m.fl.", sourceUrl: "https://www.finansportalen.no/bank/forbrukslan/", asOf: "2026-10", noteKey: "rates.noteConsumer" },
  ],
}

/** The table row in force on `today` (later rows take over from their start date). */
export function tableRate(category: Exclude<LoanCategory, "mortgage">, today: string): TypicalRate | undefined {
  const rows = TABLE[category]
  let pick = rows[0]
  for (const r of rows) if (!r.from || r.from <= today) pick = r
  return pick
}

const SSB_URL = "https://data.ssb.no/api/v0/no/table/10748"
const CACHE_KEY = "lane-kalkulator:ssb-mortgage-rate"
const CACHE_MS = 12 * 60 * 60 * 1000

/**
 * Average floating rate on new repayment mortgages to households, latest month,
 * from Statistics Norway (table 10748). Cached for 12 hours in this browser.
 */
export async function fetchMortgageRate(signal?: AbortSignal): Promise<TypicalRate | undefined> {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { at: number; rate: TypicalRate } | null
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.rate
  } catch {
    /* no cache */
  }
  const res = await fetch(SSB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      query: [
        { code: "Utlanstype", selection: { filter: "item", values: ["70"] } },
        { code: "Sektor", selection: { filter: "item", values: ["04b"] } },
        { code: "Rentebinding", selection: { filter: "item", values: ["08"] } },
        { code: "Tid", selection: { filter: "top", values: ["1"] } },
      ],
      response: { format: "json-stat2" },
    }),
  })
  if (!res.ok) return undefined
  const data = (await res.json()) as { value?: number[]; dimension?: { Tid?: { category?: { index?: Record<string, number> } } } }
  const value = data.value?.[0]
  const month = Object.keys(data.dimension?.Tid?.category?.index ?? {})[0] // "2026M08"
  if (typeof value !== "number" || !month) return undefined
  const rate: TypicalRate = {
    ratePct: value,
    source: "SSB",
    sourceUrl: "https://www.ssb.no/renter",
    asOf: `${month.slice(0, 4)}-${month.slice(5, 7)}`,
    noteKey: "rates.noteMortgage",
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rate }))
  } catch {
    /* ignore */
  }
  return rate
}
