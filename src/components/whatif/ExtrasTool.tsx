import { useTranslation } from "react-i18next"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Field, MoneyInput, MonthPicker, Segmented } from "@/components/fields"
import { addYearMonths, extraToSchedule } from "@/lib/loan/engine"
import type { CalendarExtra } from "@/lib/loan/types"
import { EmptyHint, ItemBox } from "./shared"
import { timingOf, type TimingContext } from "./timing"
import { TimingHint } from "./TimingHint"

export function ExtrasTool({
  extras,
  timing,
  minYear,
  maxYear,
  onAdd,
  onUpdate,
  onRemove,
}: {
  extras: CalendarExtra[]
  timing: TimingContext
  minYear: number
  maxYear: number
  onAdd: (kind: CalendarExtra["kind"]) => void
  onUpdate: (id: string, patch: Partial<Omit<CalendarExtra, "id">>) => void
  onRemove: (id: string) => void
}) {
  const { t } = useTranslation()

  // Keep from <= to: moving one end past the other drags the other along.
  const setFrom = (e: CalendarExtra, from: string) =>
    onUpdate(e.id, e.to !== undefined && from > e.to ? { from, to: from } : { from })
  const setTo = (e: CalendarExtra, to: string) => onUpdate(e.id, to < e.from ? { from: to, to } : { to })

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("extras.desc")}</p>
      {extras.length === 0 && <EmptyHint>{t("extras.empty")}</EmptyHint>}
      {extras.map((e, i) => {
        // Judge the dates as if the amount were set, so an empty amount doesn't read as "outside".
        const when = timingOf(e.from, (a, o) => extraToSchedule({ ...e, amount: 1 }, a, o), timing)
        return (
          <ItemBox
            key={e.id}
            onRemove={() => onRemove(e.id)}
            removeLabel={t("extras.remove", { n: i + 1 })}
            header={
              <Segmented
                aria-label={t("extras.kind", { n: i + 1 })}
                className="max-w-56"
                value={e.kind}
                onChange={(kind) => onUpdate(e.id, { kind, to: undefined })}
                options={[
                  { value: "recurring", label: t("extras.monthly") },
                  { value: "oneoff", label: t("extras.oneoff") },
                ]}
              />
            }
          >
            <Field label={t("extras.amount")}>
              <MoneyInput value={e.amount} onChange={(v) => onUpdate(e.id, { amount: v ?? 0 })} />
            </Field>
            <Field label={e.kind === "oneoff" ? t("extras.inMonth") : t("extras.fromMonth")}>
              <MonthPicker
                value={e.from}
                onChange={(ym) => setFrom(e, ym)}
                minYear={minYear}
                maxYear={maxYear}
                monthLabel={t("extras.month")}
                yearLabel={t("extras.year")}
              />
            </Field>
            {e.kind === "recurring" && (
              <>
                <label className="touch-target flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={e.to === undefined}
                    onCheckedChange={(c) => onUpdate(e.id, { to: c ? undefined : addYearMonths(e.from, 11) })}
                  />
                  {t("extras.untilPaidOff")}
                </label>
                {e.to !== undefined && (
                  <Field label={t("extras.toMonth")}>
                    <MonthPicker
                      value={e.to}
                      onChange={(ym) => setTo(e, ym)}
                      minYear={minYear}
                      maxYear={maxYear}
                      monthLabel={t("extras.month")}
                      yearLabel={t("extras.year")}
                    />
                  </Field>
                )}
              </>
            )}
            <TimingHint timing={when} />
          </ItemBox>
        )
      })}
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
