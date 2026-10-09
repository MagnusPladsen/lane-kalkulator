import { useEffect, useState } from "react"
import { applyRouteMeta } from "@/lib/seo"
import type { LoanCategory } from "@/lib/loan/types"

export type Route = "calc" | "compare" | "loans" | "rates" | "guides"

/** Real paths so each page can be indexed. Share links stay in the hash, which never reaches a server. */
export const ROUTE_HREF: Record<Route, string> = { calc: "/", compare: "/sammenlign", loans: "/mine-lan", rates: "/renter", guides: "/guider" }

const EVENT = "lane-kalkulator:navigate"

/** Search-friendly calculator pages per loan type: the same calculator, starting from that type. */
export const TYPE_PATH: Record<LoanCategory, string> = {
  mortgage: "/boliglan",
  startlan: "/startlan",
  car: "/billan",
  consumer: "/forbrukslan",
  student: "/studielan",
}
/** The calculator in English and Polish, for search; the in-app language switch still works everywhere. */
export const LANG_PATH = { en: "/en", pl: "/pl" } as const
export type PathLang = keyof typeof LANG_PATH

const clean = (pathname: string) => pathname.replace(/\/+$/, "") || "/"

export function categoryOfPath(pathname: string): LoanCategory | undefined {
  const p = clean(pathname)
  return (Object.keys(TYPE_PATH) as LoanCategory[]).find((c) => TYPE_PATH[c] === p)
}

export function langOfPath(pathname: string): PathLang | undefined {
  const p = clean(pathname)
  return (Object.keys(LANG_PATH) as PathLang[]).find((l) => LANG_PATH[l] === p)
}

let serverPath = "/"
/** Prerendering only: which address to render without a browser location. */
export function setServerPath(p: string): void {
  serverPath = p
}

/** "/guider/avdragsfrihet" -> "avdragsfrihet". */
export function guideSlugOfPath(pathname: string): string | undefined {
  const m = /^\/guider\/([a-z0-9-]+)\/?$/.exec(pathname)
  return m?.[1]
}

/** The current path, in the browser or while prerendering. */
export function currentPath(): string {
  return typeof location === "undefined" ? serverPath : location.pathname
}

/** The route for a path, also accepting the old hash routes ("#/compare", "#/loans"). */
export function routeOf(pathname: string, hash = ""): Route {
  if (/^#\/loans\/?$/.test(hash)) return "loans"
  if (/^#\/compare\/?$/.test(hash)) return "compare"
  const p = clean(pathname)
  if (p === ROUTE_HREF.compare) return "compare"
  if (p === ROUTE_HREF.loans) return "loans"
  if (p === ROUTE_HREF.rates) return "rates"
  if (p === ROUTE_HREF.guides || p.startsWith(ROUTE_HREF.guides + "/")) return "guides"
  return "calc"
}

function current(): Route {
  if (typeof location === "undefined") return routeOf(serverPath)
  return routeOf(location.pathname, location.hash)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(current)
  useEffect(() => {
    // Move old hash routes ("#/compare") to their real path without adding a history entry.
    const upgradeLegacy = () => {
      if (/^#\/(compare|loans)\/?$/.test(location.hash)) history.replaceState(null, "", ROUTE_HREF[current()])
    }
    upgradeLegacy()
    const on = () => {
      upgradeLegacy()
      const r = current()
      setRoute(r)
      applyRouteMeta(r)
    }
    const onPop = () => on()
    const onNav = () => {
      on()
      window.scrollTo({ top: 0 })
    }
    // Plain left clicks on in-app links navigate without a page load.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[data-route]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank") return
      e.preventDefault()
      go(a.dataset.route as Route)
    }
    window.addEventListener("popstate", onPop)
    window.addEventListener(EVENT, onNav)
    document.addEventListener("click", onClick)
    return () => {
      window.removeEventListener("popstate", onPop)
      window.removeEventListener(EVENT, onNav)
      document.removeEventListener("click", onClick)
    }
  }, [])
  return route
}

export function go(route: Route): void {
  const href = ROUTE_HREF[route]
  if (location.pathname !== href || location.hash) history.pushState(null, "", href)
  window.dispatchEvent(new Event(EVENT))
}
