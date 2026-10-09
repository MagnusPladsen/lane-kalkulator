import type { Route } from "@/hooks/useRoute"
import type { LoanCategory } from "@/lib/loan/types"

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

/** Search titles and descriptions for the loan-type pages (/billan …), in Norwegian. */
export const TYPE_META: Record<LoanCategory, { title: string; description: string }> = {
  mortgage: {
    title: "Boliglånskalkulator – terminbeløp, renter og ekstra nedbetaling",
    description:
      "Regn på boliglånet: terminbeløp, totale renter og hva ekstra innbetalinger, avdragsfrihet og renteendringer gjør. Gratis, og lånet blir i nettleseren din.",
  },
  startlan: {
    title: "Startlån-kalkulator – regn på startlån fra kommunen",
    description:
      "Se hva startlånet koster med opptil 50 års nedbetaling, avdragsfri start og ekstra innbetalinger. Gratis kalkulator, lånet blir i nettleseren din.",
  },
  car: {
    title: "Billånskalkulator – hva koster billånet?",
    description:
      "Regn ut terminbeløp og totalkostnad for billånet, og se hvor mye du sparer på ekstra innbetalinger. Gratis, og lånet blir i nettleseren din.",
  },
  consumer: {
    title: "Forbrukslånkalkulator – se hva lånet egentlig koster",
    description:
      "Se totalkostnaden for forbrukslånet, effektiv rente og hvor mye du sparer på å betale ned raskere. Gratis kalkulator uten registrering.",
  },
  student: {
    title: "Studielånkalkulator – regn på nedbetaling av studielån",
    description:
      "Regn på studielånet fra Lånekassen: terminbeløp, renter og hva ekstra innbetalinger betyr for nedbetalingstiden. Gratis og privat.",
  },
}

/** The calculator in English and Polish. */
export const LANG_META: Record<"en" | "pl", { title: string; description: string; locale: string }> = {
  en: {
    title: "Loan calculator for Norway – extra payments, interest-only, rates",
    description:
      "Free loan calculator for Norwegian mortgages, startlån, car and student loans. See what extra payments, interest-only periods and rate changes do.",
    locale: "en_GB",
  },
  pl: {
    title: "Kalkulator kredytu w Norwegii – nadpłaty i oprocentowanie",
    description:
      "Darmowy kalkulator kredytów w Norwegii: hipoteka, startlån, kredyt samochodowy i studencki. Zobacz efekt nadpłat, okresów bez spłaty i zmian stóp.",
    locale: "pl_PL",
  },
}
