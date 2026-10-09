import type { Route } from "@/hooks/useRoute"

export const SITE_URL = "https://lane-kalkulator.pladsen.dev"
export const SITE_NAME = "Lånekalkulator"

export interface RouteMeta {
  path: string
  title: string
  description: string
  /** Private pages (saved loans live only in the visitor's browser) are not indexed. */
  index: boolean
}

/** Search titles stay under ~60 characters and descriptions under ~155. */
export const ROUTE_META: Record<Route, RouteMeta> = {
  calc: {
    path: "/",
    title: "Lånekalkulator – ekstra nedbetaling, avdragsfrihet og rente",
    description:
      "Gratis lånekalkulator for boliglån, startlån, billån og studielån. Se hva ekstra innbetalinger, avdragsfrihet og renteendringer gjør med lånet ditt.",
    index: true,
  },
  compare: {
    path: "/sammenlign",
    title: "Sammenlign lånetilbud – hva koster lånet totalt? | Lånekalkulator",
    description:
      "Sammenlign to lånetilbud på totalkostnad, ikke bare rente. Se om det lønner seg å bytte bank, og når etableringsgebyret er tjent inn.",
    index: true,
  },
  rates: {
    path: "/renter",
    title: "Boliglånsrenten nå – snittrente og utvikling | Lånekalkulator",
    description:
      "Snittrenten på nye boliglån i Norge, flytende og fast, måned for måned fra SSB. Se utviklingen de siste ti årene og regn på ditt eget lån.",
    index: true,
  },
  loans: {
    path: "/mine-lan",
    title: "Mine lån | Lånekalkulator",
    description: "Lånene du har lagret. De ligger bare i din egen nettleser.",
    index: false,
  },
}

function setMeta(selector: string, attr: string, value: string) {
  const el = document.head.querySelector<HTMLElement>(selector)
  if (el) el.setAttribute(attr, value)
}

/** Keeps the tab title and the main tags in step with client-side navigation. */
export function applyRouteMeta(route: Route): void {
  if (typeof document === "undefined") return
  const m = ROUTE_META[route]
  document.title = m.title
  setMeta('meta[name="description"]', "content", m.description)
  setMeta('link[rel="canonical"]', "href", SITE_URL + m.path)
  setMeta('meta[property="og:url"]', "content", SITE_URL + m.path)
  setMeta('meta[property="og:title"]', "content", m.title)
  setMeta('meta[property="og:description"]', "content", m.description)
  setMeta('meta[name="robots"]', "content", m.index ? "index, follow" : "noindex, follow")
}
