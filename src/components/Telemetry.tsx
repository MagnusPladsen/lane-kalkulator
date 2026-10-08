import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"
import { scrubUrl } from "@/lib/analytics"
import { ROUTE_HREF, type Route } from "@/hooks/useRoute"

/** Cookieless page views and performance metrics, with every URL scrubbed of loan data. */
export function Telemetry({ route }: { route: Route }) {
  const path = ROUTE_HREF[route]
  return (
    <>
      <Analytics route={path} path={path} beforeSend={(e) => ({ ...e, url: scrubUrl(e.url) })} />
      <SpeedInsights route={path} beforeSend={(e) => ({ ...e, url: scrubUrl(e.url) })} />
    </>
  )
}
