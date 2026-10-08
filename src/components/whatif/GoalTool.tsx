import { useMemo, useState } from "react"
import { HelpTip } from "@/components/HelpTip"
import { Trans, useTranslation } from "react-i18next"
import { CheckIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { solveForTarget } from "@/lib/loan/engine"
import { fmtDuration, fmtMoney, fmtMonthYear } from "@/lib/format"
import type { Analysis, Scenario } from "@/lib/loan/types"
import type { MonthDate } from "./month"

export function GoalTool({
  scenario,
  analysis,
  today,
  monthDate,
  onApply,
}: {
  scenario: Scenario
  analysis: Analysis
  today: string
  monthDate: MonthDate
  onApply: (amount: number) => void
}) {
  const { t } = useTranslation()
  const current = analysis.scenario.months
  const [wanted, setWanted] = useState(() => Math.max(1, current - 60))
  const [applied, setApplied] = useState(false)
  // Clamp during render so the slider follows when the loan itself changes.
  const target = Math.min(Math.max(1, wanted), Math.max(1, current))

  const monthly = useMemo(() => solveForTarget(scenario, today, target, "recurring"), [scenario, today, target])
  const oneoff = useMemo(() => solveForTarget(scenario, today, target, "oneoff"), [scenario, today, target])

  const presets = [2, 5, 10].map((y) => y * 12).filter((m) => current - m >= 1)
  const hasOtherChanges = scenario.extras.length + scenario.periods.length > 0
  const sliderLabelId = "goal-target-label"

  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-1 text-sm text-muted-foreground">
        <span className="flex-1">{t("goal.question")}</span>
        <HelpTip label={t("whatif.goal")}>{t("help.goal")}</HelpTip>
      </p>

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <span id={sliderLabelId} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("goal.target")}
          </span>
          <span className="text-right text-sm font-medium">
            {t("goal.targetValue", { date: fmtMonthYear(monthDate(target)), duration: fmtDuration(target, t) })}
          </span>
        </div>
        <Slider
          aria-labelledby={sliderLabelId}
          min={1}
          max={Math.max(2, current)}
          step={1}
          value={[target]}
          onValueChange={(v) => {
            setWanted(Array.isArray(v) ? v[0] : v)
            setApplied(false)
          }}
          className="py-3 [&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-track]]:h-2"
        />
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("goal.presetsLabel")}>
            {presets.map((m) => (
              <Button
                key={m}
                variant={current - m === target ? "secondary" : "outline"}
                size="sm"
                onClick={() => {
                  setWanted(current - m)
                  setApplied(false)
                }}
              >
                {t("goal.earlier", { duration: fmtDuration(m, t) })}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div aria-live="polite" className="grid gap-2 rounded-xl bg-accent/50 p-4">
        {!monthly || monthly.amount === 0 ? (
          <p className="text-sm">{t("goal.onTrack")}</p>
        ) : (
          <>
            <p className="font-heading text-xl leading-snug sm:text-2xl">
              <Trans
                i18nKey="goal.needMonthly"
                values={{ amount: fmtMoney(monthly.amount) }}
                components={[<span key="0" className="font-mono font-semibold whitespace-nowrap tabular-nums" />]}
              />
            </p>
            {oneoff && oneoff.amount > 0 && (
              <p className="text-sm text-muted-foreground">
                <Trans
                  i18nKey="goal.needOneoff"
                  values={{ amount: fmtMoney(oneoff.amount) }}
                  components={[<span key="0" className="font-mono font-medium text-foreground tabular-nums" />]}
                />
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {t("goal.total", {
                amount: fmtMoney(analysis.scenario.monthlyPayment + (analysis.scenario.rows[0]?.extra ?? 0) + monthly.amount),
                saved: fmtMoney(monthly.interestSaved),
              })}
            </p>
            {hasOtherChanges && <p className="text-xs text-muted-foreground">{t("goal.onTop")}</p>}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                onClick={() => {
                  onApply(monthly.amount)
                  setApplied(true)
                }}
              >
                <PlusIcon data-icon="inline-start" />
                {t("goal.apply", { amount: fmtMoney(monthly.amount) })}
              </Button>
              {applied && (
                <span role="status" className="inline-flex items-center gap-1 text-sm text-good">
                  <CheckIcon className="size-4" /> {t("goal.applied")}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
