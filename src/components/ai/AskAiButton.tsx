import { useTranslation } from "react-i18next"
import { SparklesIcon } from "lucide-react"
import { useAi } from "./AiContext"

/**
 * "Ask AI about this" for the hardest fields. Hidden when AI is off.
 * "chip": a small pill (next to a toggle). "link": inline at the end of a field's hint text,
 * so the label row stays clean and inputs line up.
 */
export function AskAiButton({
  focus,
  question,
  label,
  variant = "chip",
}: {
  focus: string
  question: string
  label: string
  variant?: "chip" | "link"
}) {
  const { t } = useTranslation()
  const ai = useAi()
  if (!ai.enabled) return null
  if (variant === "link") {
    return (
      <button
        type="button"
        onClick={() => ai.ask({ focus, question })}
        aria-label={t("ai.askAbout", { field: label })}
        className="inline-flex cursor-pointer items-center gap-1 rounded-sm align-baseline font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SparklesIcon className="size-3 shrink-0 self-center" aria-hidden />
        {t("ai.askLink")}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => ai.ask({ focus, question })}
      aria-label={t("ai.askAbout", { field: label })}
      className="inline-flex h-5 cursor-pointer items-center gap-0.5 rounded-full px-1.5 text-[11px] font-medium text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:h-7"
    >
      <SparklesIcon className="size-3" aria-hidden />
      {t("ai.short")}
    </button>
  )
}
