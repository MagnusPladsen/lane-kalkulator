import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { ChevronDownIcon, PencilIcon, ScanTextIcon } from "lucide-react"
import { ScanDialog } from "@/components/ScanDialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldInput, MoneyInput, NumberInput, SectionTitle, Segmented, FieldGroup, NativeSelect } from "@/components/fields"
import { fmtDuration, fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import type { DayCount, LoanInput } from "@/lib/loan/types"
import { EffectiveRateCheck, IntroTerms } from "@/components/LoanExtras"
import { LoanTypePicker } from "@/components/LoanTypePicker"
import type { LoanValidation } from "@/lib/scenarioReducer"

export function LoanCard({
  loan,
  errors,
  valid,
  firstPayment,
  editing,
  onEditingChange,
  onChange,
}: {
  loan: LoanInput
  errors: LoanValidation["errors"]
  valid: boolean
  /** Base payment of the first forward month, from the engine, so serial loans are right too. */
  firstPayment?: number
  editing: boolean
  onEditingChange: (e: boolean) => void
  onChange: (patch: Partial<LoanInput>) => void
}) {
  const { t } = useTranslation()
  const err = (k: keyof LoanInput) => (errors[k] ? t(`validation.${errors[k]}`) : undefined)
  const hasDetails = !!(
    loan.startDate ||
    loan.remainingBalance !== undefined ||
    loan.monthlyFee ||
    loan.setupFee
  )
  const [scanOpen, setScanOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(hasDetails || !!errors.startDate || !!errors.remainingBalance)

  const summary = t("loan.summary", {
    amount: fmtMoney(loan.principal),
    rate: fmtRate(loan.annualRatePct),
    term: fmtDuration(loan.termMonths, t),
  })

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
    <Card className="rise rise-1">
      <CardHeader>
        <SectionTitle>{t("loan.title")}</SectionTitle>
        <p className="text-sm text-muted-foreground">{t("loan.desc")}</p>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanTextIcon data-icon="inline-start" />
            {t("scan.open")}
          </Button>
        </CardAction>
      </CardHeader>
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onApply={onChange} />
      <CardContent className="grid gap-4">
        <Field label={t("loan.name")} help={t("help.name")} optional optionalLabel={t("steps.optional")}>
          <FieldInput
            autoComplete="off"
            value={loan.name}
            placeholder={t("loan.namePlaceholder")}
            maxLength={80}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-10 text-base font-medium"
          />
        </Field>

        <LoanTypePicker loan={loan} onChange={onChange} />

        <Field label={t("loan.amount")} help={t("help.amount")} error={err("principal")}>
          <MoneyInput value={loan.principal} onChange={(v) => onChange({ principal: v ?? 0 })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("loan.rate")} help={t("help.rate")} hint={t("loan.rateHint")} error={err("annualRatePct")}>
            <NumberInput
              value={loan.annualRatePct}
              onChange={(v) => onChange({ annualRatePct: v })}
              suffix={t("loan.ratePa")}
            />
          </Field>
          <Field label={t("loan.bankEffective")} help={t("help.effective")} ai={{ focus: "field:effectiveRatePct", question: t("ai.q.effective") }} hint={t("loan.bankEffectiveHint")} error={err("effectiveRatePct")}>
            <NumberInput
              value={loan.effectiveRatePct}
              onChange={(v) => onChange({ effectiveRatePct: v })}
              onClear={() => onChange({ effectiveRatePct: undefined })}
              suffix={t("loan.ratePa")}
              placeholder="–"
            />
          </Field>
        </div>
        {loan.effectiveRatePct !== undefined && <EffectiveRateCheck loan={loan} valid={valid} onChange={onChange} />}

        <Field label={t("loan.term")} help={t("help.term")} error={err("termMonths")}>
          <FieldGroup className="grid grid-cols-2 gap-3">
            <NumberInput
              integer
              aria-label={`${t("loan.term")}, ${t("loan.years")}`}
              value={Math.floor(loan.termMonths / 12)}
              onChange={(v) => onChange({ termMonths: Math.max(0, v) * 12 + (loan.termMonths % 12) })}
              suffix={t("loan.years")}
            />
            <NumberInput
              integer
              aria-label={`${t("loan.term")}, ${t("loan.months")}`}
              value={loan.termMonths % 12}
              onChange={(v) =>
                onChange({ termMonths: Math.floor(loan.termMonths / 12) * 12 + Math.min(11, Math.max(0, v)) })
              }
              suffix={t("loan.months")}
            />
          </FieldGroup>
        </Field>

        <Field label={t("loan.type")} help={t("help.type")} hint={loan.loanType === "annuity" ? t("loan.annuityHint") : t("loan.serialHint")}>
          <Segmented
            value={loan.loanType}
            onChange={(v) => onChange({ loanType: v })}
            options={[
              { value: "annuity", label: t("loan.annuity") },
              { value: "serial", label: t("loan.serial") },
            ]}
          />
        </Field>

        <IntroTerms loan={loan} error={err("intro")} onChange={onChange} />

        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger
            className="touch-target flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg py-1 text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronDownIcon className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
            {t("loan.more")}
            <span className="ml-1 truncate text-xs font-normal text-muted-foreground">{t("loan.moreHint")}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="grid gap-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("loan.startDate")}
                help={t("help.startDate")}
                optional
                optionalLabel={t("steps.optional")}
                error={err("startDate")}
                hint={t("loan.startHint")}
              >
                <FieldInput
                  type="date"
                  min="1900-01-01"
                  max="2100-12-31"
                  value={loan.startDate ?? ""}
                  onChange={(e) =>
                    onChange({
                      startDate: e.target.value || undefined,
                      remainingBalance: e.target.value ? loan.remainingBalance : undefined,
                    })
                  }
                />
              </Field>
              <Field
                label={t("loan.remaining")}
                help={t("help.remaining")}
                ai={{ focus: "field:remainingBalance", question: t("ai.q.remaining") }}
                optional
                optionalLabel={t("steps.optional")}
                error={err("remainingBalance")}
                hint={loan.startDate ? t("loan.remainingHintWithStart") : t("loan.remainingHintNoStart")}
              >
                <MoneyInput
                  value={loan.remainingBalance}
                  onChange={(v) => onChange({ remainingBalance: v })}
                  allowEmpty
                  disabled={!loan.startDate}
                  placeholder={loan.startDate ? "–" : ""}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("loan.fee")} help={t("help.fee")} hint={t("loan.feeHint")} error={err("monthlyFee")}>
                <MoneyInput value={loan.monthlyFee} onChange={(v) => onChange({ monthlyFee: v ?? 0 })} />
              </Field>
              <Field
                label={t("loan.setupFee")}
                help={t("help.setupFee")}
                optional
                optionalLabel={t("steps.optional")}
                hint={t("loan.setupFeeHint")}
                error={err("setupFee")}
              >
                <MoneyInput value={loan.setupFee} allowEmpty onChange={(v) => onChange({ setupFee: v })} />
              </Field>
            </div>
            <Field label={t("loan.dayCount")} help={t("help.dayCount")} ai={{ focus: "field:dayCount", question: t("ai.q.dayCount") }} hint={t("loan.dayCountHint")}>
              <NativeSelect<DayCount>
                value={loan.dayCount ?? "30/360"}
                onChange={(dayCount) => onChange({ dayCount })}
                options={[
                  { value: "act/act", label: t("loan.dayCountActAct") },
                  { value: "act/360", label: t("loan.dayCountAct360") },
                  { value: "30/360", label: t("loan.dayCount30360") },
                ]}
              />
            </Field>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          {valid && firstPayment !== undefined && (
            <p className="text-sm text-muted-foreground">
              <Trans
                i18nKey={loan.loanType === "serial" ? "loan.estimateSerial" : "loan.estimate"}
                values={{ amount: fmtMoney(firstPayment) }}
                components={[<span key="0" className="font-mono font-semibold text-foreground tabular-nums" />]}
              />
            </p>
          )}
          <Button className="ml-auto" disabled={!valid} onClick={() => onEditingChange(false)}>
            {t("steps.done")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
