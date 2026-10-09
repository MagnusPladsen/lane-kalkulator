import type { SeriesKey } from "./rateHistory"

/** One colour per rate series, shared by the chart and its toggles (kept out of the chart chunk). */
export const SERIES_COLOR: Record<SeriesKey, string> = {
  floating: "var(--chart-scenario)",
  fixed1to3: "var(--chart-baseline)",
  fixed3to5: "var(--chart-extra)",
  fixedOver5: "var(--chart-interest)",
}
