import { useTranslation } from "react-i18next"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Field, MoneyInput, NumberInput, Segmented } from "@/components/fields"
import { fmtMonthYear } from "@/lib/format"
import type { ExtraPayment } from "@/lib/loan/types"
import { EmptyHint, ItemBox } from "./shared"
import { clampMonth, type MonthDate } from "./month"

export function ExtrasTool({
  extras,
  monthDate,
  maxMonth,
  onAdd,
  onUpdate,
  onRemove,
}: {
  extras: ExtraPayment[]
  monthDate: MonthDate
  maxMonth: number
  onAdd: (kind: ExtraPayment["kind"]) => void
  onUpdate: (id: string, patch: Partial<ExtraPayment>) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("extras.desc")}</p>
      {extras.length === 0 && <EmptyHint>{t("extras.empty")}</EmptyHint>}
      {extras.map((e, i) => (
        <ItemBox
          key={e.id}
          onRemove={() => onRemove(e.id)}
          removeLabel={t("extras.remove", { n: i + 1 })}
          header={
            <Segmented
              aria-label={t("extras.kind", { n: i + 1 })}
              className="max-w-56"
              value={e.kind}
              onChange={(kind) => onUpdate(e.id, { kind, toMonth: undefined })}
              options={[
                { value: "recurring", label: t("extras.monthly") },
                { value: "oneoff", label: t("extras.oneoff") },
              ]}
            />
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("extras.amount")}>
              <MoneyInput value={e.amount} onChange={(v) => onUpdate(e.id, { amount: v ?? 0 })} />
            </Field>
            <Field
              label={e.kind === "oneoff" ? t("extras.inMonth") : t("extras.fromMonth")}
              hint={fmtMonthYear(monthDate(e.fromMonth))}
            >
              <NumberInput
                integer
                value={e.fromMonth}
                onChange={(v) => {
                  const fromMonth = clampMonth(v, 1, maxMonth)
                  onUpdate(e.id, {
                    fromMonth,
                    toMonth: e.toMonth === undefined ? undefined : Math.max(fromMonth, e.toMonth),
                  })
                }}
              />
            </Field>
          </div>
          {e.kind === "recurring" && (
            <div className="grid grid-cols-2 items-start gap-3">
              <label className="touch-target flex min-h-9 cursor-pointer items-center gap-2 self-end text-sm text-muted-foreground">
                <Switch
                  checked={e.toMonth === undefined}
                  onCheckedChange={(c) =>
                    onUpdate(e.id, { toMonth: c ? undefined : Math.min(maxMonth, e.fromMonth + 11) })
                  }
                />
                {t("extras.untilPaidOff")}
              </label>
              {e.toMonth !== undefined && (
                <Field label={t("extras.toMonth")} hint={fmtMonthYear(monthDate(e.toMonth))}>
                  <NumberInput
                    integer
                    value={e.toMonth}
                    onChange={(v) => onUpdate(e.id, { toMonth: clampMonth(v, e.fromMonth, maxMonth) })}
                  />
                </Field>
              )}
            </div>
          )}
        </ItemBox>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onAdd("recurring")}>
          <PlusIcon data-icon="inline-start" /> {t("extras.addMonthly")}
        </Button>
        <Button variant="outline" onClick={() => onAdd("oneoff")}>
          <PlusIcon data-icon="inline-start" /> {t("extras.addOneoff")}
        </Button>
      </div>
    </div>
  )
}
