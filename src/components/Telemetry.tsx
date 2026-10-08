import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { scrubUrl } from "@/lib/analytics"
import type { Route } from "@/hooks/useHashRoute"

/** Cookieless page views and performance metrics, with every URL scrubbed of loan data. */
export function Telemetry({ route }: { route: Route }) {
  const path = route === "loans" ? "/loans" : "/"
  return (
    <>
      <Analytics route={path} path={path} beforeSend={(e) => ({ ...e, url: scrubUrl(e.url) })} />
      <SpeedInsights route={path} beforeSend={(e) => ({ ...e, url: scrubUrl(e.url) })} />
    </>
  )
}
