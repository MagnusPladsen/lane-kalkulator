import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { initLang } from "./i18n"
import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { routeOf } from "./hooks/useRoute"
import { preloadRoute } from "./pages/lazy"

// Load the visitor's language and starting page first, so the first render is complete.
// Until then the prerendered HTML stays on screen.
const app = (
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

void Promise.all([initLang(), preloadRoute(routeOf(location.pathname, location.hash)).catch(() => undefined)]).then(() => {
  const root = document.getElementById("root")!
  if (root.firstElementChild) {
    // Attach to the prerendered page instead of redrawing it. A returning visitor's saved loan,
    // dark theme or another language differs from the prerender; React then quietly re-renders
    // just that part, which is expected and not an error worth reporting.
    hydrateRoot(root, app, {
      onRecoverableError: (e) => {
        if (import.meta.env.DEV) console.warn("hydration fallback", e)
      },
    })
  } else {
    createRoot(root).render(app)
  }
})
