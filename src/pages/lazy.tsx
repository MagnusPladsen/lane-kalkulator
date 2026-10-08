import { lazyWithPreload } from "@/lib/lazy"
import type { Route } from "@/hooks/useRoute"

export const ComparePage = lazyWithPreload(() => import("./ComparePage").then((m) => m.ComparePage))
export const LoansPage = lazyWithPreload(() => import("./LoansPage").then((m) => m.LoansPage))

/** Loads the code for the page the visitor starts on before the first render. */
export function preloadRoute(route: Route): Promise<unknown> {
  if (route === "compare") return ComparePage.preload()
  if (route === "loans") return LoansPage.preload()
  return Promise.resolve()
}
