import { Suspense, type ComponentProps } from "react"
import { lazyWithPreload } from "@/lib/lazy"
import type { BalanceChart as BalanceChartT } from "./BalanceChart"
import type { YearlyChart as YearlyChartT } from "./YearlyChart"
import type { CumulativeChart as CumulativeChartT } from "./CumulativeChart"
import type { RateChart as RateChartT } from "./RateChart"

// The chart library is the largest dependency, so it loads after the first screen.
const Balance = lazyWithPreload(() => import("./BalanceChart").then((m) => m.BalanceChart))
const Yearly = lazyWithPreload(() => import("./YearlyChart").then((m) => m.YearlyChart))
const Cumulative = lazyWithPreload(() => import("./CumulativeChart").then((m) => m.CumulativeChart))
const Rate = lazyWithPreload(() => import("./RateChart").then((m) => m.RateChart))

/** Same size as a chart, so nothing moves when it arrives. */
function Placeholder() {
  return <div aria-hidden className="h-[260px] w-full rounded-lg bg-muted/40 sm:h-[320px]" />
}

export function BalanceChart(props: ComponentProps<typeof BalanceChartT>) {
  return (
    <Suspense fallback={<Placeholder />}>
      <Balance {...props} />
    </Suspense>
  )
}
export function YearlyChart(props: ComponentProps<typeof YearlyChartT>) {
  return (
    <Suspense fallback={<Placeholder />}>
      <Yearly {...props} />
    </Suspense>
  )
}
export function CumulativeChart(props: ComponentProps<typeof CumulativeChartT>) {
  return (
    <Suspense fallback={<Placeholder />}>
      <Cumulative {...props} />
    </Suspense>
  )
}
export function RateChart(props: ComponentProps<typeof RateChartT>) {
  return (
    <Suspense fallback={<Placeholder />}>
      <Rate {...props} />
    </Suspense>
  )
}

/** Prerendering loads the charts first so the HTML comes out complete and in order. */
BalanceChart.preload = Balance.preload
YearlyChart.preload = Yearly.preload
CumulativeChart.preload = Cumulative.preload
RateChart.preload = Rate.preload
