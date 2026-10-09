/**
 * Build-time prerendering only (scripts/prerender.mjs). Renders a page with the default
 * loan so the HTML has real content before any JavaScript runs.
 */
import { createElement } from "react"
import { prerender } from "react-dom/static"
import "./i18n"
import App from "./App"
import { setServerRoute, type Route } from "./hooks/useRoute"
import { ComparePage, LoansPage, RatesPage } from "./pages/lazy"
import { BalanceChart, CumulativeChart, RateChart, YearlyChart } from "./components/charts/lazy"

export { ROUTE_META, SITE_NAME, SITE_URL } from "./lib/seo"
export { CALC_FAQ, COMPARE_FAQ } from "./lib/faq"
export { fetchRateHistory, setRateSnapshot } from "./lib/rateHistory"

export async function render(route: Route): Promise<string> {
  setServerRoute(route)
  // Load every lazy part first, so nothing suspends and the HTML comes out in order.
  await Promise.all([
    ComparePage.preload(),
    LoansPage.preload(),
    RatesPage.preload(),
    BalanceChart.preload(),
    YearlyChart.preload(),
    CumulativeChart.preload(),
    RateChart.preload(),
  ])
  // A very large chunk size keeps finished sections inline instead of moving big ones
  // to the end of the document with swap scripts.
  const { prelude } = await prerender(createElement(App), { progressiveChunkSize: 1e9 })
  return await new Response(prelude as ReadableStream).text()
}
