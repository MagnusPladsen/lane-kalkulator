/**
 * Build-time prerendering only (scripts/prerender.mjs). Renders a page with the default
 * loan so the HTML has real content before any JavaScript runs.
 */
import { createElement } from "react"
import { prerender } from "react-dom/static"
import App from "./App"
import { langOfPath, setServerPath } from "./hooks/useRoute"
import i18n from "./i18n"
import en from "./i18n/en.json"
import pl from "./i18n/pl.json"
import { ComparePage, GuidesPage, LoansPage, RatesPage } from "./pages/lazy"
import { BalanceChart, CumulativeChart, RateChart, YearlyChart } from "./components/charts/lazy"

export { LANG_META, ROUTE_META, SITE_NAME, SITE_URL, TYPE_META } from "./lib/seo"
export { LANG_PATH, TYPE_PATH } from "./hooks/useRoute"
export { GUIDES } from "./content/guides"
export { CALC_FAQ, COMPARE_FAQ } from "./lib/faq"
export { fetchRateHistory, setRateSnapshot } from "./lib/rateHistory"

/** Renders the page at `path` (e.g. "/", "/billan", "/en") with the default loan for that page. */
export async function render(path: string): Promise<string> {
  setServerPath(path)
  const lang = langOfPath(path) ?? "nb"
  if (lang !== "nb" && !i18n.hasResourceBundle(lang, "translation")) {
    i18n.addResourceBundle(lang, "translation", lang === "en" ? en : pl, true, true)
  }
  await i18n.changeLanguage(lang)
  // Load every lazy part first, so nothing suspends and the HTML comes out in order.
  await Promise.all([
    ComparePage.preload(),
    LoansPage.preload(),
    RatesPage.preload(),
    GuidesPage.preload(),
    BalanceChart.preload(),
    YearlyChart.preload(),
    CumulativeChart.preload(),
    RateChart.preload(),
  ])
  // A very large chunk size keeps finished sections inline instead of moving big ones
  // to the end of the document with swap scripts.
  const { prelude } = await prerender(createElement(App), { progressiveChunkSize: 1e9 })
  const html = await new Response(prelude as ReadableStream).text()
  await i18n.changeLanguage("nb")
  return html
}
