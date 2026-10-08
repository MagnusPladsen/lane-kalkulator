import { useEffect, useState } from "react"

export type Route = "calc" | "compare" | "loans"

function parse(): Route {
  if (/^#\/loans\/?$/.test(location.hash)) return "loans"
  if (/^#\/compare\/?$/.test(location.hash)) return "compare"
  return "calc"
}

export const ROUTE_HREF: Record<Route, string> = { calc: "#/", compare: "#/compare", loans: "#/loans" }

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return route
}

export function go(route: Route): void {
  location.hash = ROUTE_HREF[route]
}
