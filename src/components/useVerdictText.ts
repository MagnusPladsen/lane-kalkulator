import { useTranslation } from "react-i18next"
import { fmtDuration, fmtMoney } from "@/lib/format"
import type { Analysis } from "@/lib/loan/types"

export type Mood = "good" | "bad" | "neutral"

/** Headline and mood shared by the big verdict and the sticky mobile bar. */
export function useVerdictText(a: Analysis, hasChanges: boolean) {
  const { t } = useTranslation()
  const { months } = a.delta
  const cost = a.delta.totalCost
  const noEffect = Math.abs(cost) < 1 && months === 0
  const mood: Mood = !hasChanges || noEffect ? "neutral" : cost < 0 ? "good" : "bad"
  const headline = !hasChanges
    ? undefined
    : noEffect
      ? t("verdict.noEffect")
      : months < 0
        ? t("verdict.earlier", { duration: fmtDuration(months, t) })
        : months > 0
          ? t("verdict.later", { duration: fmtDuration(months, t) })
          : cost < 0
            ? t("verdict.cheaperSameDate", { amount: fmtMoney(-cost) })
            : t("verdict.dearerSameDate", { amount: fmtMoney(cost) })
  const costText = noEffect ? undefined : `${cost < 0 ? "−" : "+"}${fmtMoney(Math.abs(cost))}`
  return { mood, headline, costText }
}
