import { useEffect, useState, type RefObject } from "react"
import { useTranslation } from "react-i18next"
import { ChevronUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Analysis } from "@/lib/loan/types"
import { useVerdictText } from "./useVerdictText"

/**
 * On phones the results sit below the inputs. While the big verdict is off-screen,
 * this strip keeps the answer in view; tapping it jumps to the results.
 */
export function MobileVerdictBar({
  a,
  hasChanges,
  targetRef,
}: {
  a: Analysis
  hasChanges: boolean
  targetRef: RefObject<HTMLElement | null>
}) {
  const { t } = useTranslation()
  const { mood, headline, costText } = useVerdictText(a, hasChanges)
  const [targetVisible, setTargetVisible] = useState(true)

  useEffect(() => {
    const el = targetRef.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const io = new IntersectionObserver(([entry]) => setTargetVisible(entry.isIntersecting), { threshold: 0.1 })
    io.observe(el)
    return () => io.disconnect()
  }, [targetRef])

  if (!hasChanges || targetVisible || !headline || a.paidOff) return null

  return (
    <button
      type="button"
      onClick={() => targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      className={cn(
        "flex w-full items-center gap-3 border-t px-4 py-2.5 text-left backdrop-blur",
        mood === "good" && "bg-good/15",
        mood === "bad" && "bg-bad/15",
        mood === "neutral" && "bg-card/95",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{headline}</span>
        {costText && (
          <span className={cn("font-mono text-xs tabular-nums", mood === "good" ? "text-good" : "text-bad")}>
            {t("verdict.totalCost")} {costText}
          </span>
        )}
      </span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {t("mobileBar.show")} <ChevronUpIcon className="size-4" aria-hidden />
      </span>
    </button>
  )
}
