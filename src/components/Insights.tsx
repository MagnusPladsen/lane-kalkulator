import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowDownUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import { addMonths, analyze, todayIso, yearMonthOf } from "@/lib/loan/engine"
import { uid } from "@/lib/ids"
import type { Analysis, CustomPeriod, Scenario } from "@/lib/loan/types"

/**
 * Where the next payment goes: a split bar with the amounts beside it, plus when principal
 * overtakes interest. The bar is decoration; the numbers carry the meaning.
 */
export function LoanSentence({ a, dateFor, bare }: { a: Analysis; dateFor: (i: number) => string; bare?: boolean }) {
  const { t } = useTranslation()
  const rows = a.scenario.rows
  const r = rows[0]
  if (!r) return null
  const base = r.interest + r.principal + r.fee
  // First month where more goes to principal than to interest.
  const turn = rows.findIndex((x) => !x.interestOnly && x.principal > x.interest)
  const next = [
    { key: "interest", label: t("insight.interestPart"), value: r.interest, className: "bg-chart-interest" },
    { key: "principal", label: t("insight.principalPart"), value: r.principal, className: "bg-chart-principal" },
    { key: "fee", label: t("insight.feePart"), value: r.fee, className: "bg-chart-history" },
  ]
  // The whole loan, history included: what was borrowed against what it costs on top.
  const life = a.lifetime.scenario
  const whole = [
    { key: "principal", label: t("insight.borrowedPart"), value: life.paid - life.interest - life.fees, className: "bg-chart-principal" },
    { key: "interest", label: t("insight.interestPart"), value: life.interest, className: "bg-chart-interest" },
    { key: "fee", label: t("insight.feesPart"), value: life.fees, className: "bg-chart-history" },
  ]
  const note = r.interestOnly
    ? t("insight.interestOnlyNote")
    : turn > 0 && r.principal <= r.interest
      ? t("insight.turn", { date: fmtMonthYear(dateFor(a.offsetMonths + turn + 1)) })
      : undefined
  const bars = (
    <>
      <SplitBar title={t("insight.nextTitle")} total={base} parts={next} note={note} />
      <SplitBar title={t("insight.wholeTitle")} total={life.paid} parts={whole} />
    </>
  )
  if (bare) return <div className="grid gap-4">{bars}</div>
  return (
    <Card size="sm" className="rise rise-1">
      <CardContent className="grid gap-4">{bars}</CardContent>
    </Card>
  )
}

/** A titled split bar with the amounts beside it. The bar is decoration; the numbers carry the meaning. */
function SplitBar({
  title,
  total,
  parts,
  note,
}: {
  title: string
  total: number
  parts: { key: string; label: string; value: number; className: string }[]
  note?: string
}) {
  const shown = parts.filter((p) => p.value >= 0.5)
  return (
    <div className="grid gap-2">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium">{title}</span>
        <span className="font-mono font-semibold tabular-nums">{fmtMoney(total)}</span>
      </p>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {shown.map((p) => (
          <span key={p.key} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {shown.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2.5 rounded-full", p.className)} />
            {p.label} <span className="font-mono font-medium text-foreground tabular-nums">{fmtMoney(p.value)}</span>
          </li>
        ))}
      </ul>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/** Percentage-point changes to try; falls are offered only when the rate can go that low. */
const STEPS = [-2, -1, 1, 2, 3] as const

/**
 * "What if the rate changes?" One click shows the new payment and the change in cost;
 * a second click adds the change as a rate period for the rest of the loan.
 */
export function RateStress({
  scenario,
  analysis,
  monthDate,
  onAddPeriod,
  bare,
}: {
  scenario: Scenario
  analysis: Analysis
  /** Inside a result section that already shows the title. */
  bare?: boolean
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

  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {!bare && (
    <>
            <ArrowDownUpIcon className="size-4 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{t("insight.stressTitle")}</p>
    </>
        )}
        <div role="radiogroup" aria-label={t("insight.stressTitle")} className={cn("flex flex-wrap gap-1.5", !bare && "ml-auto")}>
          {STEPS.filter((s) => nominal + s >= 0).map((s) => (
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
              {s > 0 ? "+" : "−"}
              {Math.abs(s)}
            </button>
          ))}
        </div>
      </div>
      {result ? (
        <div className="flex flex-wrap items-end justify-between gap-2" aria-live="polite">
          <p className="text-sm">
            {t(result.paymentDelta < 0 ? "insight.stressResultDown" : "insight.stressResult", {
              rate: fmtRate(result.period.annualRatePct),
              payment: fmtMoney(result.payment),
              delta: fmtMoney(Math.abs(result.paymentDelta)),
              cost: fmtMoney(Math.abs(result.costDelta)),
            })}
          </p>
          <Button variant="outline" size="sm" onClick={() => onAddPeriod(result.period)}>
            {t("insight.stressAdd")}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("insight.stressHint")}</p>
      )}
    </>
  )
  if (bare) return <div className="grid gap-3">{body}</div>
  return (
    <Card className="rise rise-2" size="sm">
      <CardContent className="grid gap-3">{body}</CardContent>
    </Card>
  )
}
