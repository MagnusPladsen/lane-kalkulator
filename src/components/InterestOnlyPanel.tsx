import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Field, NumberInput } from "@/components/fields"
import { fmtMonthYear } from "@/lib/format"
import type { AfterInterestOnly, InterestOnlyPeriod } from "@/lib/loan/types"

export function InterestOnlyPanel({
  periods,
  after,
  monthDate,
  maxMonth,
  onAdd,
  onUpdate,
  onRemove,
  onAfterChange,
}: {
  periods: InterestOnlyPeriod[]
  after: AfterInterestOnly
  monthDate: (month: number) => string
  maxMonth: number
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<InterestOnlyPeriod>) => void
  onRemove: (id: string) => void
  onAfterChange: (v: AfterInterestOnly) => void
}) {
  return (
    <Card className="rise rise-3">
      <CardHeader>
        <CardTitle className="text-lg">Pause the principal</CardTitle>
        <CardDescription>Months where you only pay interest, when money is tight.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {periods.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            No pauses. Add one to see what a few lean months really cost.
          </p>
        )}
        {periods.map((p) => (
          <div key={p.id} className="grid gap-3 rounded-lg border bg-background/40 p-3">
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <Field label="From month" hint={fmtMonthYear(monthDate(p.fromMonth))}>
                <NumberInput
                  value={p.fromMonth}
                  min={1}
                  max={maxMonth}
                  step={1}
                  onChange={(v) => onUpdate(p.id, { fromMonth: Math.min(maxMonth, Math.max(1, Math.round(v))) })}
                />
              </Field>
              <Field label="Months" hint={`until ${fmtMonthYear(monthDate(p.fromMonth + p.months - 1))}`}>
                <NumberInput
                  value={p.months}
                  min={1}
                  max={120}
                  step={1}
                  onChange={(v) => onUpdate(p.id, { months: Math.min(120, Math.max(1, Math.round(v))) })}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mb-5 text-muted-foreground hover:text-destructive"
                aria-label="Remove"
                onClick={() => onRemove(p.id)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="w-fit" onClick={onAdd}>
          <PlusIcon data-icon="inline-start" /> Interest-only period
        </Button>

        {periods.length > 0 && (
          <Field label="Afterwards" className="mt-1">
            <RadioGroup value={after} onValueChange={(v) => onAfterChange(v as AfterInterestOnly)}>
              <Label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 font-normal has-data-checked:border-primary/50 has-data-checked:bg-accent/50">
                <RadioGroupItem value="keep-term" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Keep the end date</span>
                  <span className="text-xs text-muted-foreground">Payment goes up afterwards.</span>
                </span>
              </Label>
              <Label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 font-normal has-data-checked:border-primary/50 has-data-checked:bg-accent/50">
                <RadioGroupItem value="keep-payment" className="mt-0.5" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Keep the payment</span>
                  <span className="text-xs text-muted-foreground">Loan runs longer.</span>
                </span>
              </Label>
            </RadioGroup>
          </Field>
        )}
      </CardContent>
    </Card>
  )
}
