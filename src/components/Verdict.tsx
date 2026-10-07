import { forwardRef } from "react"
import { Trans, useTranslation } from "react-i18next"
import { AlertTriangleIcon, PartyPopperIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtDuration, fmtMoney } from "@/lib/format"
import { useVerdictText } from "./useVerdictText"
import type { Analysis } from "@/lib/loan/types"

export const Verdict = forwardRef<HTMLElement, { a: Analysis; hasChanges: boolean; stale?: boolean }>(
  function Verdict({ a, hasChanges, stale }, ref) {
    const { t } = useTranslation()
    const { mood, headline, costText } = useVerdictText(a, hasChanges)

    if (a.paidOff) {
      return (
        <section ref={ref} className="rise rounded-xl bg-card px-5 py-5 ring-1 ring-foreground/10">
          <p className="flex items-center gap-2 font-heading text-2xl sm:text-3xl" aria-live="polite">
            <PartyPopperIcon className="size-6 text-good" aria-hidden />
            {t("verdict.paidOffTitle")}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("verdict.paidOffBody")}</p>
        </section>
      )
    }

    if (!hasChanges) {
      return (
        <section ref={ref} className="rise rounded-xl border border-dashed bg-card/60 px-5 py-5">
          <p className="font-heading text-xl leading-snug text-balance sm:text-2xl">{t("verdict.noChanges")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            <Trans
              i18nKey="verdict.planSoFar"
              values={{
                duration: fmtDuration(a.baseline.months, t),
                amount: fmtMoney(a.lifetime.baseline.interest + a.lifetime.baseline.fees),
              }}
              components={[<span key="0" className="font-mono tabular-nums" />]}
            />
          </p>
        </section>
      )
    }

    const { interest } = a.delta
    const feeDelta = a.lifetime.scenario.fees - a.lifetime.baseline.fees
    const sub =
      Math.abs(interest) < 1
        ? t("verdict.sameInterest")
        : (interest < 0
            ? t("verdict.lessInterest", { amount: fmtMoney(Math.abs(interest)) })
            : t("verdict.moreInterest", { amount: fmtMoney(Math.abs(interest)) })) +
          (Math.abs(feeDelta) >= 1
            ? feeDelta < 0
              ? t("verdict.lessFees", { amount: fmtMoney(Math.abs(feeDelta)) })
              : t("verdict.moreFees", { amount: fmtMoney(Math.abs(feeDelta)) })
            : "") +
          "."

    return (
      <section
        ref={ref}
        className={cn(
          "rise relative overflow-hidden rounded-xl px-5 py-5 ring-1 transition-opacity",
          mood === "good" && "bg-good/10 ring-good/35",
          mood === "bad" && "bg-bad/10 ring-bad/35",
          mood === "neutral" && "bg-card ring-foreground/10",
          stale && "opacity-50",
        )}
      >
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("verdict.withChanges")}</p>
        <p className="mt-1 font-heading text-3xl leading-none text-balance sm:text-4xl" aria-live="polite" aria-atomic>
          {headline}
        </p>
        <p className="mt-2 text-sm">{sub}</p>
        {costText && (
          <p className="mt-3 text-sm">
            {t("verdict.totalCost")}{" "}
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 font-mono font-semibold tabular-nums",
                mood === "good" ? "bg-good/15 text-good" : "bg-bad/15 text-bad",
              )}
            >
              {costText}
            </span>
          </p>
        )}
        {a.scenario.truncated && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-bad">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("verdict.truncated")}
          </p>
        )}
      </section>
    )
  },
)
