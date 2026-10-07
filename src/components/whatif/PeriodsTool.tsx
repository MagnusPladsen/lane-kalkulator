import { useTranslation } from "react-i18next"
import { PlusIcon, TriangleAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Field, MonthPicker, NumberInput, Segmented } from "@/components/fields"
import { periodToMonths } from "@/lib/loan/engine"
import type { AfterInterestOnly, CustomPeriod, PeriodKind } from "@/lib/loan/types"
import { EmptyHint, ItemBox } from "./shared"

export function PeriodsTool({
  periods,
  after,
  anchor,
  offset,
  minYear,
  maxYear,
  onAdd,
  onUpdate,
  onRemove,
  onAfterChange,
}: {
  periods: CustomPeriod[]
  after: AfterInterestOnly
  /** Loan start date, or today when unknown. */
  anchor: string
  /** Payments already made. */
  offset: number
  minYear: number
  maxYear: number
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<Omit<CustomPeriod, "id">>) => void
  onRemove: (id: string) => void
  onAfterChange: (v: AfterInterestOnly) => void
}) {
  const { t } = useTranslation()
  const hasInterestOnly = periods.some((p) => p.kind === "interest-only")

  // Keep from <= to: moving one end past the other drags the other along.
  const setFrom = (p: CustomPeriod, from: string) => onUpdate(p.id, from > p.to ? { from, to: from } : { from })
  const setTo = (p: CustomPeriod, to: string) => onUpdate(p.id, to < p.from ? { from: to, to } : { to })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("periods.desc")}</p>
      {periods.length === 0 && <EmptyHint>{t("periods.empty")}</EmptyHint>}

      {periods.map((p, i) => {
        const span = periodToMonths(p, anchor, offset)
        return (
          <ItemBox
            key={p.id}
            onRemove={() => onRemove(p.id)}
            removeLabel={t("periods.remove", { n: i + 1 })}
            header={
              <Segmented<PeriodKind>
                aria-label={t("periods.kind", { n: i + 1 })}
                value={p.kind}
                onChange={(kind) => onUpdate(p.id, { kind })}
                options={[
                  { value: "interest-only", label: t("periods.interestOnly") },
                  { value: "rate", label: t("periods.otherRate") },
                ]}
              />
            }
          >
            <div className="grid gap-3">
              <Field label={t("periods.from")}>
                <MonthPicker
                  value={p.from}
                  onChange={(ym) => setFrom(p, ym)}
                  minYear={minYear}
                  maxYear={maxYear}
                  monthLabel={t("periods.fromMonth")}
                  yearLabel={t("periods.fromYear")}
                />
              </Field>
              <Field label={t("periods.to")}>
                <MonthPicker
                  value={p.to}
                  onChange={(ym) => setTo(p, ym)}
                  minYear={minYear}
                  maxYear={maxYear}
                  monthLabel={t("periods.toMonth")}
                  yearLabel={t("periods.toYear")}
                />
              </Field>
            </div>

            {p.kind === "rate" && (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <Field label={t("periods.rate")} hint={t("periods.rateHint")}>
                  <NumberInput
                    value={p.annualRatePct}
                    onChange={(v) => onUpdate(p.id, { annualRatePct: Math.min(100, Math.max(0, v)) })}
                    suffix="%"
                  />
                </Field>
                {p.annualRatePct !== 0 && (
                  <Button variant="outline" className="mb-5" onClick={() => onUpdate(p.id, { annualRatePct: 0 })}>
                    {t("periods.zero")}
                  </Button>
                )}
              </div>
            )}

            {span ? (
              <p className="text-xs text-muted-foreground">{t("periods.duration", { count: span.months })}</p>
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden />
                {t("periods.past")}
              </p>
            )}
          </ItemBox>
        )
      })}

      <Button variant="outline" className="w-fit" onClick={onAdd}>
        <PlusIcon data-icon="inline-start" /> {t("periods.add")}
      </Button>

      {hasInterestOnly && (
        <Field label={t("periods.after")} className="mt-1">
          <RadioGroup
            aria-label={t("periods.after")}
            value={after}
            onValueChange={(v) => onAfterChange(v as AfterInterestOnly)}
            className="grid-cols-1 sm:grid-cols-2"
          >
            {(
              [
                { value: "keep-term", title: t("periods.keepTerm"), hint: t("periods.keepTermHint") },
                { value: "keep-payment", title: t("periods.keepPayment"), hint: t("periods.keepPaymentHint") },
              ] as const
            ).map((o) => (
              <Label
                key={o.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal has-data-checked:border-primary/50 has-data-checked:bg-accent/50"
              >
                <RadioGroupItem value={o.value} className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">{o.title}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </Field>
      )}
    </div>
  )
}
