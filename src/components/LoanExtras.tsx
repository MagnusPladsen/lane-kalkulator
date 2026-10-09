import { useMemo, useState } from "react"
import { HelpTip } from "@/components/HelpTip"
import { AskAiButton } from "@/components/ai/AskAiButton"
import { useAi } from "@/components/ai/AiContext"
import { Trans, useTranslation } from "react-i18next"
import { CircleCheckIcon, InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Field, FieldGroup, NumberInput, Segmented } from "@/components/fields"
import { fmtMoney, fmtRate } from "@/lib/format"
import { planEffectiveRate, solveMonthlyFee } from "@/lib/loan/engine"
import type { LoanInput, PeriodKind } from "@/lib/loan/types"

/** Optional loan terms from the first payment: interest-only or another rate (0 % = interest-free). */
export function IntroTerms({
  loan,
  error,
  onChange,
}: {
  loan: LoanInput
  error?: string
  onChange: (patch: Partial<LoanInput>) => void
}) {
  const { t } = useTranslation()
  const intro = loan.intro
  const years = intro ? Math.floor(intro.months / 12) : 0
  const months = intro ? intro.months % 12 : 0
  const setMonths = (m: number) => intro && onChange({ intro: { ...intro, months: Math.max(0, m) } })

  return (
    <div className="grid gap-3 rounded-xl border bg-background/50 p-3">
      <label className="touch-target flex min-h-9 cursor-pointer items-start gap-2.5">
        <Switch
          className="mt-0.5"
          checked={!!intro}
          onCheckedChange={(on) =>
            onChange({ intro: on ? { kind: "interest-only", months: 36, annualRatePct: 0 } : undefined })
          }
        />
        <span className="grid gap-0.5">
          <span className="flex items-center gap-1 text-sm font-medium">
            {t("loan.intro")}
            <HelpTip label={t("loan.intro")}>{t("help.intro")}</HelpTip>
            <AskAiButton focus="field:intro" question={t("ai.q.intro")} label={t("loan.intro")} />
          </span>
          <span className="text-xs text-muted-foreground">{t("loan.introHint")}</span>
        </span>
      </label>

      {intro && (
        <>
          <Segmented<PeriodKind>
            aria-label={t("loan.introKind")}
            value={intro.kind}
            onChange={(kind) => onChange({ intro: { ...intro, kind } })}
            options={[
              { value: "interest-only", label: t("periods.interestOnly") },
              { value: "rate", label: t("periods.otherRate") },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("loan.introLength")} error={error}>
              <FieldGroup className="grid grid-cols-2 gap-2">
                <NumberInput
                  integer
                  aria-label={`${t("loan.introLength")}, ${t("loan.years")}`}
                  value={years}
                  onChange={(v) => setMonths(Math.max(0, v) * 12 + months)}
                  suffix={t("loan.years")}
                />
                <NumberInput
                  integer
                  aria-label={`${t("loan.introLength")}, ${t("loan.months")}`}
                  value={months}
                  onChange={(v) => setMonths(years * 12 + Math.min(11, Math.max(0, v)))}
                  suffix={t("loan.months")}
                />
              </FieldGroup>
            </Field>
            {intro.kind === "rate" && (
              <Field label={t("periods.rate")} hint={t("loan.introRateHint")}>
                <NumberInput
                  value={intro.annualRatePct}
                  onChange={(v) => onChange({ intro: { ...intro, annualRatePct: Math.min(100, Math.max(0, v)) } })}
                  suffix="%"
                />
              </Field>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Monthly fees above this are rare on Norwegian loans; a solver result beyond it is shown, not applied. */
const PLAUSIBLE_FEE = 200

/**
 * Compares the effective rate implied by the inputs with the one the bank quotes,
 * and can solve for the monthly fee that closes the gap.
 */
export function EffectiveRateCheck({
  loan,
  valid,
  onChange,
}: {
  loan: LoanInput
  valid: boolean
  onChange: (patch: Partial<LoanInput>) => void
}) {
  const { t } = useTranslation()
  const computed = useMemo(() => (valid ? planEffectiveRate(loan) : undefined), [loan, valid])
  // A solver result belongs to the loan it was computed for; any other change hides it.
  const { monthlyFee: _fee, name: _name, ...terms } = loan
  const signature = JSON.stringify(terms)
  const [solved, setSolved] = useState<{ signature: string; fee?: number } | null>(null)
  const result = solved?.signature === signature ? solved : null
  const bank = loan.effectiveRatePct
  if (computed === undefined) return null

  const gap = bank === undefined ? 0 : bank - computed
  const matches = bank !== undefined && Math.abs(gap) < 0.01

  return (
    <div className="grid gap-2 rounded-xl border bg-background/50 p-3 text-sm" aria-live="polite">
      <p>
        <Trans
          i18nKey="loan.effCalc"
          values={{ rate: fmtRate(Math.round(computed * 100) / 100) }}
          components={[<span key="0" className="font-mono font-semibold tabular-nums" />]}
        />
      </p>
      {bank !== undefined &&
        (matches ? (
          <p className="flex items-center gap-1.5 text-good">
            <CircleCheckIcon className="size-4 shrink-0" aria-hidden />
            {t("loan.effMatch")}
          </p>
        ) : (
          <>
            <p className="flex items-start gap-1.5 text-muted-foreground">
              <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {gap > 0 ? t("loan.effHigher", { bank: fmtRate(bank) }) : t("loan.effLower", { bank: fmtRate(bank) })}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              {gap > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const fee = solveMonthlyFee(loan, bank)
                    setSolved({ signature, fee })
                    if (fee !== undefined && fee <= PLAUSIBLE_FEE) onChange({ monthlyFee: fee })
                  }}
                >
                  {t("loan.effSolve", { bank: fmtRate(bank) })}
                </Button>
              )}
              <AiExplainGap />
            </div>
          </>
        ))}
      {result && (
        <div role="status" className="grid gap-2 text-xs text-muted-foreground">
          {result.fee === undefined ? (
            <p>{t("loan.effNoSolve", { bank: fmtRate(bank ?? 0) })}</p>
          ) : result.fee <= PLAUSIBLE_FEE ? (
            <p>{t("loan.effSolved", { fee: fmtMoney(result.fee) })}</p>
          ) : (
            <>
              <p>{t("loan.effUnusual", { fee: fmtMoney(result.fee) })}</p>
              {loan.monthlyFee !== result.fee && (
                <Button variant="ghost" size="sm" className="w-fit" onClick={() => onChange({ monthlyFee: result.fee })}>
                  {t("loan.effUseAnyway", { fee: fmtMoney(result.fee) })}
                </Button>
              )}
            </>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("loan.effAbout")}</p>
    </div>
  )
}

/** "Explain with AI" next to an effective-rate mismatch. Hidden when AI is off. */
function AiExplainGap() {
  const { t } = useTranslation()
  const ai = useAi()
  if (!ai.enabled) return null
  return (
    <Button variant="outline" size="sm" onClick={() => ai.ask({ focus: "field:effectiveRatePct", question: t("ai.q.gap") })}>
      {t("ai.explainGap")}
    </Button>
  )
}
