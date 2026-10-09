/**
 * Average rates on new mortgages to households, from SSB table 10748 (monthly).
 * Fetched at build time for the prerendered page (embedded as JSON) and refreshed in the
 * browser. SSB allows cross-origin requests; data is CC BY 4.0, credited on the page.
 */
export const SERIES = ["floating", "fixed1to3", "fixed3to5", "fixedOver5"] as const
export type SeriesKey = (typeof SERIES)[number]

const BINDING: Record<SeriesKey, string> = { floating: "08", fixed1to3: "10", fixed3to5: "11", fixedOver5: "06" }

export interface RateHistory {
  /** "YYYY-MM", oldest first. */
  months: string[]
  series: Record<SeriesKey, (number | null)[]>
}

export const SSB_TABLE_URL = "https://www.ssb.no/statbank/table/10748"
const API = "https://data.ssb.no/api/v0/no/table/10748"
const CACHE_KEY = "lane-kalkulator:rate-history"
const CACHE_MS = 12 * 60 * 60 * 1000

interface JsonStat {
  value?: (number | null)[]
  id?: string[]
  size?: number[]
  dimension?: Record<string, { category?: { index?: Record<string, number> } }>
}

/** Turns SSB's json-stat2 cube into one array per series. Exported for tests. */
export function parseJsonStat(d: JsonStat): RateHistory | undefined {
  const ids = d.id ?? []
  const size = d.size ?? []
  const values = d.value ?? []
  const tIdx = d.dimension?.Tid?.category?.index
  const bIdx = d.dimension?.Rentebinding?.category?.index
  if (!tIdx || !bIdx || ids.length !== size.length) return undefined
  // Row-major strides: the last dimension changes fastest.
  const stride = ids.map((_, i) => size.slice(i + 1).reduce((a, b) => a * b, 1))
  const tPos = ids.indexOf("Tid")
  const bPos = ids.indexOf("Rentebinding")
  if (tPos < 0 || bPos < 0) return undefined
  const monthsRaw = Object.keys(tIdx).sort((a, b) => tIdx[a] - tIdx[b])
  const months = monthsRaw.map((m) => `${m.slice(0, 4)}-${m.slice(5, 7)}`)
  const series = {} as RateHistory["series"]
  for (const key of SERIES) {
    const b = bIdx[BINDING[key]]
    series[key] = monthsRaw.map((m) => {
      if (b === undefined) return null
      const v = values[b * stride[bPos] + tIdx[m] * stride[tPos]]
      return typeof v === "number" ? v : null
    })
  }
  return months.length ? { months, series } : undefined
}

export async function fetchRateHistory(signal?: AbortSignal, months = 130): Promise<RateHistory | undefined> {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      query: [
        { code: "Utlanstype", selection: { filter: "item", values: ["70"] } },
        { code: "Sektor", selection: { filter: "item", values: ["04b"] } },
        { code: "Rentebinding", selection: { filter: "item", values: SERIES.map((k) => BINDING[k]) } },
        { code: "Tid", selection: { filter: "top", values: [String(months)] } },
      ],
      response: { format: "json-stat2" },
    }),
  })
  if (!res.ok) return undefined
  return parseJsonStat((await res.json()) as JsonStat)
}

/** Browser refresh with a 12-hour cache, so revisits don't hit SSB every time. */
export async function freshRateHistory(signal?: AbortSignal): Promise<RateHistory | undefined> {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as { at: number; data: RateHistory } | null
    if (c && Date.now() - c.at < CACHE_MS) return c.data
  } catch {
    /* no cache */
  }
  const data = await fetchRateHistory(signal)
  if (data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
    } catch {
      /* ignore */
    }
  }
  return data
}

let serverSnapshot: RateHistory | undefined
/** Prerendering only: the history fetched at build time. */
export function setRateSnapshot(h: RateHistory | undefined): void {
  serverSnapshot = h
}

/** The history baked into the page at build time, the same on the server and in the browser. */
export function rateSnapshot(): RateHistory | undefined {
  if (typeof document === "undefined") return serverSnapshot
  try {
    const el = document.getElementById("rate-snapshot")
    return el?.textContent ? (JSON.parse(el.textContent) as RateHistory) : undefined
  } catch {
    return undefined
  }
}

/** Latest non-empty value of a series, with its month and the change over 1 and 12 months. */
export function latest(h: RateHistory, key: SeriesKey) {
  const s = h.series[key]
  let i = s.length - 1
  while (i >= 0 && s[i] === null) i--
  if (i < 0) return undefined
  const at = (k: number) => (k >= 0 && s[k] !== null ? (s[k] as number) : undefined)
  const now = s[i] as number
  const prev = at(i - 1)
  const yearAgo = at(i - 12)
  return {
    value: now,
    month: h.months[i],
    change1: prev === undefined ? undefined : now - prev,
    change12: yearAgo === undefined ? undefined : now - yearAgo,
  }
}
