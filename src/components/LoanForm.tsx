import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Field, MoneyInput, NumberInput, Segmented } from "@/components/fields"
import { fmtMoney } from "@/lib/format"
import type { LoanInput } from "@/lib/loan/types"
import type { LoanValidation } from "@/lib/scenarioReducer"
import { annuityPayment } from "@/lib/loan/engine"

export function LoanForm({
  loan,
  errors,
  onChange,
}: {
  loan: LoanInput
  errors: LoanValidation["errors"]
  onChange: (patch: Partial<LoanInput>) => void
}) {
  const years = Math.floor(loan.termMonths / 12)
  const months = loan.termMonths % 12
  const estPayment =
    loan.principal > 0 && loan.termMonths > 0
      ? annuityPayment(loan.principal, loan.annualRatePct / 100 / 12, loan.termMonths) + loan.monthlyFee
      : 0

  return (
    <Card className="rise rise-1">
      <CardHeader>
        <CardTitle className="text-lg">The loan</CardTitle>
        <CardDescription>What you borrowed and on what terms.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Name" htmlFor="name">
          <Input
            id="name"
            value={loan.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="My mortgage"
          />
        </Field>

        <Field label="Loan amount" htmlFor="principal" error={errors.principal}>
          <MoneyInput
            id="principal"
            value={loan.principal}
            onChange={(v) => onChange({ principal: v ?? 0 })}
            invalid={!!errors.principal}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Interest rate" htmlFor="rate" error={errors.annualRatePct}>
            <NumberInput
              id="rate"
              value={loan.annualRatePct}
              onChange={(v) => onChange({ annualRatePct: v })}
              suffix="% p.a."
              min={0}
              max={100}
              step={0.05}
              invalid={!!errors.annualRatePct}
            />
          </Field>
          <Field label="Fee per month" htmlFor="fee" error={errors.monthlyFee}>
            <MoneyInput id="fee" value={loan.monthlyFee} onChange={(v) => onChange({ monthlyFee: v ?? 0 })} />
          </Field>
        </div>

        <Field label="Term" error={errors.termMonths}>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              value={years}
              onChange={(v) => onChange({ termMonths: Math.max(0, Math.round(v)) * 12 + months })}
              suffix="yrs"
              min={0}
              max={40}
              step={1}
              invalid={!!errors.termMonths}
            />
            <NumberInput
              value={months}
              onChange={(v) => onChange({ termMonths: years * 12 + Math.min(11, Math.max(0, Math.round(v))) })}
              suffix="mo"
              min={0}
              max={11}
              step={1}
            />
          </div>
        </Field>

        <Field
          label="Repayment type"
          hint={
            loan.loanType === "annuity"
              ? "Same payment every month. Most common."
              : "Same principal every month; payments start high and fall."
          }
        >
          <Segmented
            aria-label="Repayment type"
            value={loan.loanType}
            onChange={(v) => onChange({ loanType: v })}
            options={[
              { value: "annuity", label: "Annuity" },
              { value: "serial", label: "Serial" },
            ]}
          />
        </Field>

        <div className="my-1 h-px bg-border" />

        <Field
          label="Start date"
          htmlFor="start"
          optional
          error={errors.startDate}
          hint="Shows where you are today on the graph."
        >
          <Input
            id="start"
            type="date"
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
          label="Remaining balance today"
          htmlFor="remaining"
          optional
          error={errors.remainingBalance}
          hint={
            loan.startDate
              ? "From your latest statement. Leave empty to estimate from the plan."
              : "Set a start date first."
          }
        >
          <MoneyInput
            id="remaining"
            value={loan.remainingBalance}
            onChange={(v) => onChange({ remainingBalance: v })}
            allowEmpty
            placeholder={loan.startDate ? "Estimate" : "—"}
            invalid={!!errors.remainingBalance}
            className={loan.startDate ? "" : "pointer-events-none opacity-50"}
          />
        </Field>

        {estPayment > 0 && (
          <p className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-accent-foreground">
            Roughly <span className="tnum font-mono font-semibold">{fmtMoney(estPayment)}</span> per month
            {loan.loanType === "serial" ? " at the start" : ""}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
