import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { initLang } from "./i18n"
import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { routeOf } from "./hooks/useRoute"
import { preloadRoute } from "./pages/lazy"

// Load the visitor's language and starting page first, so the first render is complete.
// Until then the prerendered HTML stays on screen.
void Promise.all([initLang(), preloadRoute(routeOf(location.pathname, location.hash)).catch(() => undefined)]).then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
})
