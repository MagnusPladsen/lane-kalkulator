import { useTranslation } from "react-i18next"
import { SparklesIcon } from "lucide-react"
import { useAi } from "./AiContext"

/** Small "ask AI about this" button for the hardest fields. Hidden when AI is off. */
export function AskAiButton({ focus, question, label }: { focus: string; question: string; label: string }) {
  const { t } = useTranslation()
  const ai = useAi()
  if (!ai.enabled) return null
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
