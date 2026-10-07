import { useEffect, useState } from "react"

export type Route = "calc" | "loans"

function parse(): Route {
  return location.hash.startsWith("#/loans") ? "loans" : "calc"
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setRoute(parse())
    window.addEventListener("hashchange", on)
    return () => window.removeEventListener("hashchange", on)
  }, [])
  const go = (r: Route) => {
    location.hash = r === "loans" ? "#/loans" : "#/"
  }
  return [route, go]
}
