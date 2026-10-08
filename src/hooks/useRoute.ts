import { useEffect, useState } from "react"
import { applyRouteMeta } from "@/lib/seo"

export type Route = "calc" | "compare" | "loans"

/** Real paths so each page can be indexed. Share links stay in the hash, which never reaches a server. */
export const ROUTE_HREF: Record<Route, string> = { calc: "/", compare: "/sammenlign", loans: "/mine-lan" }

const EVENT = "lane-kalkulator:navigate"

/** The route for a path, also accepting the old hash routes ("#/compare", "#/loans"). */
export function routeOf(pathname: string, hash = ""): Route {
  if (/^#\/loans\/?$/.test(hash)) return "loans"
  if (/^#\/compare\/?$/.test(hash)) return "compare"
  const p = pathname.replace(/\/+$/, "") || "/"
  if (p === ROUTE_HREF.compare) return "compare"
  if (p === ROUTE_HREF.loans) return "loans"
  return "calc"
}

function current(): Route {
  if (typeof location === "undefined") return serverRoute
  return routeOf(location.pathname, location.hash)
}

let serverRoute: Route = "calc"
/** Prerendering only: which page to render without a browser location. */
export function setServerRoute(r: Route): void {
  serverRoute = r
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
