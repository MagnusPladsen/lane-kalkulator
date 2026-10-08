import { lazy, type ComponentType } from "react"

/**
 * A lazily loaded component that can also be loaded ahead of time. Once preloaded it
 * renders directly, so the page the visitor starts on never flashes a loading state.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<P extends Record<string, any>>(load: () => Promise<ComponentType<P>>) {
  let loaded: ComponentType<P> | undefined
  const preload = () =>
    load().then((c) => {
      loaded = c
      return c
    })
  const Lazy = lazy(() => preload().then((c) => ({ default: c })))
  function Component(props: P) {
    const C = loaded ?? Lazy
    return <C {...props} />
  }
  Component.preload = preload
  return Component
}
