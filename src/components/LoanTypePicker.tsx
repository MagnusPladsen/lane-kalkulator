import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/HelpTip"
import { fmtDuration, fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import { todayIso } from "@/lib/loan/engine"
import type { LoanCategory, LoanInput } from "@/lib/loan/types"
import { fetchMortgageRate, PRESETS, tableRate, type TypicalRate } from "@/lib/rates"
import { useAi } from "@/components/ai/AiContext"
import { SparklesIcon } from "lucide-react"

const CATEGORIES: LoanCategory[] = ["mortgage", "startlan", "car", "consumer", "student"]

/**
 * Loan type chips. Picking one shows what is usual for that kind of loan and a typical
 * rate right now, each applied only when the user presses its button.
 */
export function LoanTypePicker({ loan, onChange }: { loan: LoanInput; onChange: (patch: Partial<LoanInput>) => void }) {
  const { t } = useTranslation()
  const ai = useAi()
  const category = loan.category
  // Mortgages: live SSB average. Other types: the hand-maintained table, worked out during render.
  const [ssb, setSsb] = useState<{ rate?: TypicalRate; failed: boolean }>({ failed: false })
  useEffect(() => {
    if (category !== "mortgage") return
    const ac = new AbortController()
    fetchMortgageRate(ac.signal)
      .then((r) => setSsb({ rate: r, failed: !r }))
      .catch(() => {
        if (!ac.signal.aborted) setSsb({ failed: true })
      })
    return () => ac.abort()
  }, [category])
  const rate = category === "mortgage" ? ssb.rate : category ? tableRate(category, todayIso()) : undefined
  const rateState: "idle" | "loading" | "failed" =
    category !== "mortgage" ? "idle" : ssb.rate ? "idle" : ssb.failed ? "failed" : "loading"

  const preset = category ? PRESETS[category] : undefined
  const presetMatches =
    preset &&
    loan.loanType === preset.loanType &&
    loan.termMonths === preset.termMonths &&
    loan.monthlyFee === preset.monthlyFee &&
    (loan.dayCount ?? "30/360") === preset.dayCount

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <span id="loan-category-label" className="text-xs tracking-wide text-muted-foreground uppercase">
          {t("rates.category")}
        </span>
        <HelpTip label={t("rates.category")}>{t("help.category")}</HelpTip>
      </div>
      <div role="radiogroup" aria-labelledby="loan-category-label" className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => onChange({ category: category === c ? undefined : c })}
            className={cn(
              "min-h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:min-h-10",
              category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t(`rates.${c}`)}
          </button>
        ))}
      </div>

      {category && preset && (
        <div className="grid gap-2 rounded-xl border bg-background/50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground">
              {t("rates.usual", {
                term: fmtDuration(preset.termMonths, t),
                type: preset.loanType === "annuity" ? t("loan.annuity") : t("loan.serial"),
                fee: fmtMoney(preset.monthlyFee),
              })}
            </p>
            {!presetMatches && (
              <Button variant="outline" size="sm" onClick={() => onChange({ ...preset })}>
                {t("rates.applyPreset")}
              </Button>
            )}
          </div>

          {rateState === "loading" && <p className="text-muted-foreground">{t("rates.loading")}</p>}
          {rateState === "failed" && <p className="text-muted-foreground">{t("rates.failed")}</p>}
          {rate && rateState === "idle" && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
              <div className="grid gap-0.5">
                <p>
                  {rate.range
                    ? t(rate.rangeKind === "effective" ? "rates.rangeEffective" : "rates.rangeNominal", {
                        from: fmtRate(rate.range[0]),
                        to: fmtRate(rate.range[1]),
                      })
                    : t("rates.typical", { rate: fmtRate(rate.ratePct) })}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <a href={rate.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
                    {rate.source}
                    <ExternalLinkIcon className="size-3" aria-hidden />
                  </a>
                  <span>· {fmtMonthYear(`${rate.asOf}-01`)}</span>
                  {rate.noteKey && <span>· {t(rate.noteKey)}</span>}
                </p>
              </div>
              {ai.enabled && (category === "car" || category === "consumer") && (
                <Button variant="ghost" size="sm" onClick={() => ai.lookupRate(category)}>
                  <SparklesIcon data-icon="inline-start" />
                  {t("ai.checkRate")}
                </Button>
              )}
              {Math.abs(loan.annualRatePct - rate.ratePct) > 1e-9 && (
                <Button variant="outline" size="sm" onClick={() => onChange({ annualRatePct: rate.ratePct })}>
                  {t("rates.useRate", { rate: fmtRate(rate.ratePct) })}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
