import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { TrendingUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import { addMonths, analyze, todayIso, yearMonthOf } from "@/lib/loan/engine"
import { uid } from "@/lib/ids"
import type { Analysis, CustomPeriod, Scenario } from "@/lib/loan/types"

/** Where the next payment goes, in one sentence. Template, no AI. */
export function LoanSentence({ a, dateFor }: { a: Analysis; dateFor: (i: number) => string }) {
  const { t } = useTranslation()
  const rows = a.scenario.rows
  const r = rows[0]
  if (!r) return null
  const base = r.interest + r.principal + r.fee
  // First month where more goes to principal than to interest.
  const turn = rows.findIndex((x) => !x.interestOnly && x.principal > x.interest)
  const main = r.interestOnly
    ? t("insight.interestOnly", { payment: fmtMoney(base), interest: fmtMoney(r.interest) })
    : t("insight.split", {
        payment: fmtMoney(base),
        interest: fmtMoney(r.interest),
        principal: fmtMoney(r.principal),
        fee: fmtMoney(r.fee),
      })
  const tail =
    turn > 0 && r.principal <= r.interest
      ? " " + t("insight.turn", { date: fmtMonthYear(dateFor(a.offsetMonths + turn + 1)) })
      : ""
  return (
    <p className="rise rise-1 text-sm text-muted-foreground">
      {main}
      {tail}
    </p>
  )
}

const STEPS = [1, 2, 3] as const

/**
 * "What if the rate rises?" One click shows the new payment and the extra cost;
 * a second click adds the rise as a rate period for the rest of the loan.
 */
export function RateStress({
  scenario,
  analysis,
  monthDate,
  onAddPeriod,
}: {
  scenario: Scenario
  analysis: Analysis
  /** Calendar date of forward payment m (1 = next). */
  monthDate: (m: number) => string
  onAddPeriod: (p: CustomPeriod) => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<(typeof STEPS)[number] | null>(null)
  const nominal = scenario.loan.annualRatePct

  const result = useMemo(() => {
    if (!step) return null
    const period: CustomPeriod = {
      id: uid(),
      kind: "rate",
      from: yearMonthOf(monthDate(1)),
      to: yearMonthOf(addMonths(monthDate(1), Math.max(analysis.scenario.months, analysis.baseline.months) + 240)),
      annualRatePct: Math.round((nominal + step) * 1000) / 1000,
    }
    const stressed = analyze({ ...scenario, periods: [...scenario.periods, period] }, todayIso())
    const first = (x: Analysis) => {
      const r = x.scenario.rows.find((row) => !row.interestOnly)
      return r ? r.interest + r.principal + r.fee : 0
    }
    return {
      period,
      payment: first(stressed),
      paymentDelta: first(stressed) - first(analysis),
      costDelta: stressed.lifetime.scenario.paid - analysis.lifetime.scenario.paid,
    }
  }, [step, scenario, analysis, monthDate, nominal])

  return (
    <Card className="rise rise-2" size="sm">
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TrendingUpIcon className="size-4 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">{t("insight.stressTitle")}</p>
          <div role="radiogroup" aria-label={t("insight.stressTitle")} className="ml-auto flex gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={step === s}
                onClick={() => setStep(step === s ? null : s)}
                className={cn(
                  "min-h-8 cursor-pointer rounded-full border px-3 font-mono text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:min-h-10",
                  step === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                +{s}
              </button>
            ))}
          </div>
        </div>
        {result ? (
          <div className="flex flex-wrap items-end justify-between gap-2" aria-live="polite">
            <p className="text-sm">
              {t("insight.stressResult", {
                rate: fmtRate(result.period.annualRatePct),
                payment: fmtMoney(result.payment),
                delta: fmtMoney(result.paymentDelta),
                cost: fmtMoney(result.costDelta),
              })}
            </p>
            <Button variant="outline" size="sm" onClick={() => onAddPeriod(result.period)}>
              {t("insight.stressAdd")}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("insight.stressHint")}</p>
        )}
      </CardContent>
    </Card>
  )
}
