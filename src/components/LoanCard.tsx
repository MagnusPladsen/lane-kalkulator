import { useTranslation } from "react-i18next"
import { PencilIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoanWizard } from "@/components/LoanWizard"
import { keepTogether } from "@/lib/ai/format"
import { fmtDuration, fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import type { LoanInput } from "@/lib/loan/types"
import type { LoanValidation } from "@/lib/scenarioReducer"

export function LoanCard({
  loan,
  errors,
  valid,
  firstPayment,
  editing,
  fresh = false,
  paidShare,
  onEditingChange,
  onChange,
}: {
  loan: LoanInput
  errors: LoanValidation["errors"]
  valid: boolean
  /** Base payment of the first forward month, from the engine, so serial loans are right too. */
  firstPayment?: number
  editing: boolean
  /** First setup of a new loan (see LoanWizard). */
  fresh?: boolean
  /** Share of the original amount already repaid (loans with a start date). */
  paidShare?: number
  onEditingChange: (e: boolean) => void
  onChange: (patch: Partial<LoanInput>) => void
}) {
  const { t } = useTranslation()

  // Break only between the parts, never inside "25 år" or "3 000 000 kr".
  const summary = keepTogether(t("loan.summary", {
    amount: fmtMoney(loan.principal),
    rate: fmtRate(loan.annualRatePct),
    term: fmtDuration(loan.termMonths, t),
  }))

  if (!editing) {
    const bits = [
      loan.category ? t(`rates.${loan.category}`) : undefined,
      loan.loanType === "annuity" ? t("loan.annuity") : t("loan.serial"),
      loan.startDate ? `${t("loan.startDate")} ${fmtMonthYear(loan.startDate)}` : undefined,
      loan.remainingBalance !== undefined ? `${t("loan.remaining")} ${fmtMoney(loan.remainingBalance)}` : undefined,
      loan.intro
        ? loan.intro.kind === "interest-only"
          ? t("loan.introSummaryIo", { duration: fmtDuration(loan.intro.months, t) })
          : t("loan.introSummaryRate", { duration: fmtDuration(loan.intro.months, t), rate: fmtRate(loan.intro.annualRatePct) })
        : undefined,
      loan.monthlyFee ? `${t("loan.fee")} ${fmtMoney(loan.monthlyFee)}` : undefined,
    ].filter(Boolean)
    return (
      <Card className="rise rise-1">
        <CardContent className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {loan.name ? (
              <h2 className="line-clamp-2 font-heading text-xl leading-tight font-medium break-words">{loan.name}</h2>
            ) : (
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("loan.title")}</p>
            )}
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{summary}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{bits.join(" · ")}</p>
            {paidShare !== undefined && (
              <div className="mt-3 grid gap-1.5">
                <div
                  role="progressbar"
                  aria-label={t("loan.paidShareLabel")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(paidShare * 100)}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(paidShare * 100, 1.5)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("loan.paidShare", { pct: Math.round(paidShare * 100) })}
                </p>
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => onEditingChange(true)} aria-label={t("loan.editLoan")}>
            <PencilIcon data-icon="inline-start" />
            {t("steps.edit")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <LoanWizard
      loan={loan}
      errors={errors}
      valid={valid}
      firstPayment={firstPayment}
      fresh={fresh}
      onChange={onChange}
      onDone={() => onEditingChange(false)}
    />
  )
}
