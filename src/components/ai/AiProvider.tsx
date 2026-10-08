import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon, ExternalLinkIcon, LoaderCircleIcon, RotateCcwIcon, SendIcon, SparklesIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { currentLang } from "@/i18n"
import { aiStatus, AiRequestError, askAi, shareableScenario } from "@/lib/ai/client"
import type { AiRequest, AiSource, Suggestion } from "@/lib/ai/types"
import type { Scenario } from "@/lib/loan/types"
import { AiContext, type AiApi } from "./AiContext"

interface Msg {
  role: "user" | "assistant"
  content: string
  suggestions?: Suggestion[]
  sources?: AiSource[]
  applied?: number[]
  error?: boolean
}

/**
 * Owns the AI chat: whether it is available, the conversation, and the floating panel.
 * Every request sends the loan's numbers only (never its name) and is capped server-side.
 */
export function AiProvider({
  scenario,
  page,
  onApply,
  children,
}: {
  scenario: Scenario
  page: string
  onApply: (s: Suggestion) => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState("")
  // Latest loan for requests, kept out of render so callbacks stay stable.
  const scenarioRef = useRef(scenario)
  useEffect(() => {
    scenarioRef.current = scenario
  }, [scenario])

  useEffect(() => {
    let live = true
    void aiStatus().then((s) => live && setEnabled(s.enabled))
    return () => {
      live = false
    }
  }, [])

  const errorText = useCallback(
    (e: unknown) => t(`ai.error.${e instanceof AiRequestError ? e.code : "upstream"}`),
    [t],
  )

  const run = useCallback(
    async (history: Msg[], req: Omit<AiRequest, "messages" | "lang" | "scenario">) => {
      setBusy(true)
      try {
        const res = await askAi({
          ...req,
          lang: currentLang(),
          scenario: shareableScenario(scenarioRef.current),
          messages: history.filter((m) => !m.error).slice(-11).map(({ role, content }) => ({ role, content })),
        })
        setMsgs((m) => [...m, { role: "assistant", content: res.reply || t("ai.empty"), suggestions: res.suggestions, sources: res.sources }])
      } catch (e) {
        setMsgs((m) => [...m, { role: "assistant", content: errorText(e), error: true }])
      } finally {
        setBusy(false)
      }
    },
    [errorText, t],
  )

  const send = useCallback(
    (text: string, focus?: string) => {
      const q = text.trim()
      if (!q || busy) return
      const history: Msg[] = [...msgs, { role: "user", content: q }]
      setMsgs(history)
      setDraft("")
      void run(history, { mode: "chat", focus: focus ?? `page:${page}` })
    },
    [busy, msgs, page, run],
  )

  const api = useMemo<AiApi>(
    () => ({
      enabled,
      ask: (opts) => {
        setOpen(true)
        if (opts?.question) send(opts.question, opts.focus)
      },
      parse: async (text) => {
        const res = await askAi({ mode: "parse", lang: currentLang(), messages: [], text, scenario: shareableScenario(scenarioRef.current) })
        return res.suggestions
      },
      lookupRate: (category) => {
        setOpen(true)
        const q = t("ai.rateQuestion", { type: t(`rates.${category}`).toLowerCase() })
        const history: Msg[] = [...msgs, { role: "user", content: q }]
        setMsgs(history)
        void run([], { mode: "rates", category })
      },
    }),
    [enabled, send, msgs, run, t],
  )

  const starters = [t("ai.starter1"), t("ai.starter2"), t("ai.starter3"), t("ai.starter4")]

  return (
    <AiContext.Provider value={api}>
      {children}
      {enabled && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-40 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 sm:right-6 sm:bottom-6"
        >
          <SparklesIcon className="size-4" aria-hidden />
          {t("ai.open")}
        </button>
      )}
      {enabled && open && (
        <section
          role="dialog"
          aria-label={t("ai.title")}
          className="fixed inset-x-0 top-14 bottom-0 z-50 flex flex-col rounded-t-2xl border bg-popover shadow-2xl sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100vh-6rem))] sm:w-[420px] sm:rounded-2xl"
        >
          <header className="flex items-start gap-2 border-b p-3">
            <SparklesIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-medium">{t("ai.title")}</h2>
              <p className="text-xs text-muted-foreground">{t("ai.privacy")}</p>
            </div>
            {msgs.length > 0 && (
              <Button variant="ghost" size="icon-sm" aria-label={t("ai.reset")} onClick={() => setMsgs([])}>
                <RotateCcwIcon />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label={t("ai.close")} onClick={() => setOpen(false)}>
              <XIcon />
            </Button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {msgs.length === 0 && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">{t("ai.intro")}</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-9 cursor-pointer rounded-xl border px-3 py-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={cn("grid gap-2", m.role === "user" && "justify-items-end")}>
                <p
                  className={cn(
                    "max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user" ? "bg-primary text-primary-foreground" : m.error ? "bg-destructive/10 text-destructive" : "bg-muted",
                  )}
                >
                  {m.content}
                </p>
                {m.suggestions?.map((s, j) => {
                  const done = m.applied?.includes(j)
                  return (
                    <div key={j} className="flex max-w-[90%] items-center gap-2 rounded-xl border bg-background p-2">
                      <span className="min-w-0 flex-1 text-sm">{s.label}</span>
                      <Button
                        size="sm"
                        variant={done ? "outline" : "default"}
                        disabled={done}
                        onClick={() => {
                          onApply(s)
                          setMsgs((all) => all.map((x, k) => (k === i ? { ...x, applied: [...(x.applied ?? []), j] } : x)))
                        }}
                      >
                        {done ? <CheckIcon data-icon="inline-start" /> : null}
                        {done ? t("ai.applied") : t("ai.apply")}
                      </Button>
                    </div>
                  )
                })}
                {m.sources && m.sources.length > 0 && (
                  <ul className="max-w-[90%] text-xs text-muted-foreground">
                    {m.sources.slice(0, 4).map((src) => (
                      <li key={src.url}>
                        <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          <ExternalLinkIcon className="size-3" aria-hidden />
                          {src.title || new URL(src.url).hostname}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {busy && (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                {t("ai.thinking")}
              </p>
            )}
          </div>

          <form
            className="flex gap-2 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault()
              send(draft)
            }}
          >
            <label className="sr-only" htmlFor="ai-input">
              {t("ai.placeholder")}
            </label>
            <input
              id="ai-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
              placeholder={t("ai.placeholder")}
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm dark:bg-input/30"
            />
            <Button type="submit" size="icon" disabled={busy || !draft.trim()} aria-label={t("ai.send")} className="size-10">
              <SendIcon />
            </Button>
          </form>
        </section>
      )}
    </AiContext.Provider>
  )
}
