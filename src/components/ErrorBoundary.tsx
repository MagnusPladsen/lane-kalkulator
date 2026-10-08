import { Component, type ErrorInfo, type ReactNode } from "react"
import i18n from "@/i18n"
import { clearDraft } from "@/lib/storage"

interface State {
  error?: Error
}

/** Last line of defence: a crash shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled render error", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const t = i18n.t.bind(i18n)
    return (
      <main className="mx-auto grid max-w-md gap-4 px-6 py-20 text-center">
        <h1 className="font-heading text-3xl">{t("error.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("error.body")}</p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs">{this.state.error.message}</pre>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => location.reload()}
          >
            {t("error.reload")}
          </button>
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm font-medium"
            onClick={() => {
              clearDraft()
              location.assign("/")
            }}
          >
            {t("error.reset")}
          </button>
        </div>
      </main>
    )
  }
}
