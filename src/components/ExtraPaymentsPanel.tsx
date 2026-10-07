import { PlusIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Field, MoneyInput, NumberInput, Segmented } from "@/components/fields"
import { fmtMonthYear } from "@/lib/format"
import type { ExtraPayment } from "@/lib/loan/types"

export function ExtraPaymentsPanel({
  extras,
  monthDate,
  maxMonth,
  onAdd,
  onUpdate,
  onRemove,
}: {
  extras: ExtraPayment[]
  monthDate: (month: number) => string
  maxMonth: number
  onAdd: (kind: ExtraPayment["kind"]) => void
  onUpdate: (id: string, patch: Partial<ExtraPayment>) => void
  onRemove: (id: string) => void
}) {
  return (
    <Card className="rise rise-2">
      <CardHeader>
        <CardTitle className="text-lg">Pay extra</CardTitle>
        <CardDescription>Every krone goes straight to the principal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {extras.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Nothing yet. Try 1 000 kr a month and watch the years fall off.
          </p>
        )}
        {extras.map((e) => (
          <div key={e.id} className="grid gap-3 rounded-lg border bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <Segmented
                aria-label="Kind"
                className="w-auto min-w-44"
                value={e.kind}
                onChange={(kind) => onUpdate(e.id, { kind, toMonth: undefined })}
                options={[
                  { value: "recurring", label: "Monthly" },
                  { value: "oneoff", label: "One-off" },
                ]}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto text-muted-foreground hover:text-destructive"
                aria-label="Remove"
                onClick={() => onRemove(e.id)}
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <MoneyInput value={e.amount} onChange={(v) => onUpdate(e.id, { amount: v ?? 0 })} />
              </Field>
              <Field
                label={e.kind === "oneoff" ? "In month" : "From month"}
                hint={fmtMonthYear(monthDate(e.fromMonth))}
              >
                <NumberInput
                  value={e.fromMonth}
                  min={1}
                  max={maxMonth}
                  step={1}
                  onChange={(v) => onUpdate(e.id, { fromMonth: clampMonth(v, maxMonth) })}
                />
              </Field>
            </div>
            {e.kind === "recurring" && (
              <div className="grid grid-cols-2 items-end gap-3">
                <label className="flex h-8 items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    size="sm"
                    checked={e.toMonth === undefined}
                    onCheckedChange={(c) =>
                      onUpdate(e.id, { toMonth: c ? undefined : Math.min(maxMonth, e.fromMonth + 11) })
                    }
                  />
                  Until paid off
                </label>
                {e.toMonth !== undefined && (
                  <Field label="To month" hint={fmtMonthYear(monthDate(e.toMonth))}>
                    <NumberInput
                      value={e.toMonth}
                      min={e.fromMonth}
                      max={maxMonth}
                      step={1}
                      onChange={(v) => onUpdate(e.id, { toMonth: clampMonth(v, maxMonth) })}
                    />
                  </Field>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onAdd("recurring")}>
            <PlusIcon data-icon="inline-start" /> Monthly extra
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAdd("oneoff")}>
            <PlusIcon data-icon="inline-start" /> One-off
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function clampMonth(v: number, max: number): number {
  return Math.min(max, Math.max(1, Math.round(v)))
}
