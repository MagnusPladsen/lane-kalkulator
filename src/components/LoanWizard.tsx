import { useEffect, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, ScanTextIcon } from "lucide-react"
import { ScanDialog } from "@/components/ScanDialog"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Field, FieldGroup, FieldInput, FieldRow, MoneyInput, NativeSelect, NumberInput, Segmented } from "@/components/fields"
import { EffectiveRateCheck, IntroTerms } from "@/components/LoanExtras"
import { LoanTypePicker } from "@/components/LoanTypePicker"
import { fmtMoney } from "@/lib/format"
import type { DayCount, LoanCategory, LoanInput } from "@/lib/loan/types"
import type { LoanValidation } from "@/lib/scenarioReducer"
import { startLoanFor, TYPICAL_AMOUNT } from "@/lib/rates"
import { todayIso } from "@/lib/loan/engine"

const STEPS = ["type", "money", "time", "now"] as const
type StepId = (typeof STEPS)[number]

/** Usual terms in years per loan type, offered as one-tap choices. */
const TERM_PRESETS: Record<LoanCategory, number[]> = {
  mortgage: [10, 15, 20, 25, 30],
  startlan: [20, 30, 40, 50],
  car: [3, 5, 7, 10],
  consumer: [1, 3, 5, 10],
  student: [10, 20, 25],
}

/** Which inputs live on each step, so a step only blocks on its own errors. */
const STEP_FIELDS: Record<StepId, (keyof LoanInput)[]> = {
  type: ["name", "category"],
  money: ["principal", "annualRatePct", "effectiveRatePct"],
  time: ["termMonths", "loanType", "intro"],
  now: ["startDate", "remainingBalance", "monthlyFee", "setupFee", "dayCount"],
}

/**
 * The loan form as four short steps: what kind of loan, amount and rate, how it is
 * repaid, and whether it is already running. Results update live beside it.
 */
export function LoanWizard({
  loan,
  errors,
  valid,
  firstPayment,
  fresh,
  onChange,
  onDone,
}: {
  loan: LoanInput
  errors: LoanValidation["errors"]
  valid: boolean
  firstPayment?: number
  /** First setup of a new loan: no shortcut to finish before the last step. */
  fresh: boolean
  onChange: (patch: Partial<LoanInput>) => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const [visited, setVisited] = useState(fresh ? 0 : STEPS.length - 1)
  const [scanOpen, setScanOpen] = useState(false)
  const [hasLoan, setHasLoan] = useState(!!loan.startDate)
  const [effOpen, setEffOpen] = useState(loan.effectiveRatePct !== undefined)
  const [advOpen, setAdvOpen] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  const id = STEPS[step]
  const err = (k: keyof LoanInput) => (errors[k] ? t(`validation.${errors[k]}`) : undefined)
  const stepHasErrors = (s: StepId) => STEP_FIELDS[s].some((k) => errors[k])
  const last = step === STEPS.length - 1

  // Move focus to the new step's heading (not on first render) and bring the card into view.
  useEffect(() => {
    if (!moved.current) return
    headingRef.current?.focus({ preventScroll: true })
    const top = cardRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0 || top > window.innerHeight * 0.4) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      cardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    }
  }, [step])

  // A brand-new loan: picking the type fills in its usual terms, a typical amount and, where
  // known, a typical rate, until the user has seen the amount step. Never overwrites later.
  const autoFill = fresh && visited < 1
  const pickType = (patch: Partial<LoanInput>) => {
    const c = patch.category
    if (!autoFill || !c) return onChange(patch)
    onChange({ ...patch, ...startLoanFor(c, todayIso()) })
  }

  const go = (i: number) => {
    moved.current = true
    setStep(i)
    setVisited((v) => Math.max(v, i))
  }

  return (
    <Card ref={cardRef} className="rise rise-1 scroll-mt-4">
      <CardHeader className="gap-3">
        <ol className="grid grid-cols-4 gap-1.5" aria-label={t("wizard.progress")}>
          {STEPS.map((s, i) => {
            const reachable = i <= visited && !STEPS.slice(0, i).some(stepHasErrors)
            const current = i === step
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={current ? "step" : undefined}
                  onClick={() => go(i)}
                  className="group grid w-full cursor-pointer gap-1.5 rounded-lg pt-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 rounded-full transition-colors",
                      current ? "bg-primary" : i < step || (reachable && i <= visited) ? "bg-primary/45" : "bg-muted",
                    )}
                  />
                  <span
                    className={cn(
                      "truncate text-xs",
                      current ? "font-semibold text-foreground" : reachable ? "text-muted-foreground group-hover:text-foreground" : "text-muted-foreground/70",
                    )}
                  >
                    {t(`wizard.${s}.short`)}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="grid gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("wizard.stepOf", { n: step + 1, total: STEPS.length })}
          </p>
          <h2 ref={headingRef} tabIndex={-1} className="font-heading text-2xl leading-tight outline-none">
            {t(`wizard.${id}.title`)}
          </h2>
          <p className="text-sm text-muted-foreground">{t(`wizard.${id}.desc`)}</p>
        </div>
      </CardHeader>
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onApply={onChange} />

      <CardContent className="grid grid-cols-1 gap-5" aria-live="off">
        {id === "type" && (
          <>
            <LoanTypePicker loan={loan} onChange={pickType} variant="tiles" />
            {autoFill && loan.category && <p className="-mt-2 text-xs text-muted-foreground">{t("wizard.type.filled")}</p>}
            <Field label={t("loan.name")} help={t("help.name")} optional optionalLabel={t("steps.optional")}>
              <FieldInput
                autoComplete="off"
                value={loan.name}
                placeholder={t("wizard.type.namePlaceholder")}
                maxLength={80}
                onChange={(e) => onChange({ name: e.target.value })}
                className="h-10 text-base"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-3.5 py-3 text-sm">
              <span>{t("wizard.type.scan")}</span>
              <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
                <ScanTextIcon data-icon="inline-start" />
                {t("scan.open")}
              </Button>
            </div>
          </>
        )}

        {id === "money" && (
          <>
            {fresh && loan.category && loan.principal === TYPICAL_AMOUNT[loan.category] && (
              <p className="rounded-2xl bg-highlight px-3.5 py-2.5 text-sm text-highlight-foreground">{t("wizard.money.example")}</p>
            )}
            <Field label={t("loan.amount")} help={t("help.amount")} hint={t("wizard.money.amountHint")} error={err("principal")}>
              <MoneyInput value={loan.principal} onChange={(v) => onChange({ principal: v ?? 0 })} />
            </Field>
            <Field label={t("loan.rate")} help={t("help.rate")} hint={t("loan.rateHint")} error={err("annualRatePct")}>
              <NumberInput value={loan.annualRatePct} onChange={(v) => onChange({ annualRatePct: v })} suffix={t("loan.ratePa")} />
            </Field>
            <Collapsible open={effOpen} onOpenChange={setEffOpen} className="min-w-0">
              <CollapsibleTrigger className="touch-target flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", effOpen && "rotate-180")} aria-hidden />
                {t("wizard.money.effToggle")}
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-3 pt-3">
                <Field
                  label={t("loan.bankEffective")}
                  help={t("help.effective")}
                  ai={{ focus: "field:effectiveRatePct", question: t("ai.q.effective") }}
                  hint={t("loan.bankEffectiveHint")}
                  error={err("effectiveRatePct")}
                >
                  <NumberInput
                    value={loan.effectiveRatePct}
                    onChange={(v) => onChange({ effectiveRatePct: v })}
                    onClear={() => onChange({ effectiveRatePct: undefined })}
                    suffix={t("loan.ratePa")}
                    placeholder="–"
                  />
                </Field>
                {loan.effectiveRatePct !== undefined && <EffectiveRateCheck loan={loan} valid={valid} onChange={onChange} />}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        {id === "time" && (
          <>
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
                  onChange={(v) => onChange({ termMonths: Math.floor(loan.termMonths / 12) * 12 + Math.min(11, Math.max(0, v)) })}
                  suffix={t("loan.months")}
                />
              </FieldGroup>
            </Field>
            <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("wizard.time.quick")}>
              {TERM_PRESETS[loan.category ?? "mortgage"].map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={loan.termMonths === y * 12}
                  onClick={() => onChange({ termMonths: y * 12 })}
                  className={cn(
                    "min-h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:min-h-10",
                    loan.termMonths === y * 12 ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                  )}
                >
                  {y} {t("loan.years")}
                </button>
              ))}
            </div>
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
          </>
        )}

        {id === "now" && (
          <>
            <Segmented<"yes" | "no">
              aria-label={t("wizard.now.title")}
              value={hasLoan ? "yes" : "no"}
              onChange={(v) => {
                setHasLoan(v === "yes")
                if (v === "no") onChange({ startDate: undefined, remainingBalance: undefined })
              }}
              options={[
                { value: "yes", label: t("wizard.now.yes") },
                { value: "no", label: t("wizard.now.no") },
              ]}
            />
            {hasLoan && (
              <FieldRow>
                <Field label={t("loan.startDate")} help={t("help.startDate")} error={err("startDate")} hint={t("loan.startHint")}>
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
                    placeholder={loan.startDate ? undefined : ""}
                  />
                </Field>
              </FieldRow>
            )}
            <FieldRow>
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
            </FieldRow>
            <Collapsible open={advOpen} onOpenChange={setAdvOpen} className="min-w-0">
              <CollapsibleTrigger className="touch-target flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg text-left text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", advOpen && "rotate-180")} aria-hidden />
                {t("wizard.now.advanced")}
                <span className="ml-1 min-w-0 truncate text-xs font-normal text-muted-foreground">{t("wizard.now.advancedHint")}</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-3 pt-3">
                <Field
                  label={t("loan.dayCount")}
                  help={t("help.dayCount")}
                  ai={{ focus: "field:dayCount", question: t("ai.q.dayCount") }}
                  hint={t("loan.dayCountHint")}
                >
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
          </>
        )}

        <div className="grid gap-3 border-t pt-4">
          {valid && firstPayment !== undefined && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <Trans
                i18nKey={loan.loanType === "serial" ? "loan.estimateSerial" : "loan.estimate"}
                values={{ amount: fmtMoney(firstPayment) }}
                components={[<span key="0" className="font-mono font-semibold text-foreground tabular-nums" />]}
              />
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => go(step - 1)}>
                <ArrowLeftIcon data-icon="inline-start" />
                {t("wizard.back")}
              </Button>
            )}
            {/* Forward actions sit together on the right: finish now, or continue. */}
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {!fresh && !last && (
                <Button variant="ghost" disabled={!valid} onClick={onDone}>
                  {t("steps.done")}
                </Button>
              )}
              {last ? (
                <Button disabled={!valid} onClick={onDone}>
                  <CheckIcon data-icon="inline-start" />
                  {fresh ? t("wizard.finish") : t("steps.done")}
                </Button>
              ) : (
                <Button disabled={stepHasErrors(id)} onClick={() => go(step + 1)}>
                  {t("wizard.next")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
