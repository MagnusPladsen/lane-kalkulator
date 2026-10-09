import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { fmtDuration, fmtMoney, fmtMonthYear } from "@/lib/format"
import type { Analysis } from "@/lib/loan/types"

function Tile({
  label,
  value,
  base,
  delta,
  note,
  flat,
}: {
  label: string
  value: string
  base?: string
  delta?: number
  note?: string
  /** Inside another card: a quiet filled tile instead of a lifted card. */
  flat?: boolean
}) {
  const show = delta !== undefined && Math.abs(delta) >= 1
  const good = show && delta < 0
  return (
    <div
      className={cn(
        "grid content-start gap-1 rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5",
        flat ? "bg-muted" : "bg-card shadow-(--card-shadow)",
      )}
    >
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs">{label}</p>
      <p className="font-mono text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
      <div className="flex min-h-4 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {base && <span>{base}</span>}
        {show && (
          <span className={cn("font-mono font-medium tabular-nums", good ? "text-good" : "text-bad")}>
            {delta < 0 ? "−" : "+"}
            {fmtMoney(Math.abs(delta))}
          </span>
        )}
        {note && <span>{note}</span>}
      </div>
    </div>
  )
}

export function SummaryCards({
  a,
  hasChanges,
  payoffIso,
  nominalRatePct,
  stale,
  flat,
}: {
  a: Analysis
  hasChanges: boolean
  payoffIso: string
  /** The loan's normal rate, to count months that differ from it. */
  nominalRatePct: number
  stale?: boolean
  flat?: boolean
}) {
  const { t } = useTranslation()
  const s = a.scenario
  const b = a.baseline
  const ioMonths = s.rows.filter((r) => r.interestOnly).length
  // Months left at a rate other than the loan's nominal rate (start terms or rate periods).
  const rateMonths = s.rows.filter((r) => Math.abs(r.ratePct - nominalRatePct) > 1e-9).length
  const paymentNote =
    s.maxMonthlyPayment - s.monthlyPayment > 1
      ? t("tiles.risesTo", { amount: fmtMoney(s.maxMonthlyPayment) })
      : s.rows[0]?.interestOnly
        ? t("tiles.interestOnlyNow", { amount: fmtMoney(s.rows[0].payment) })
        : s.rows[0]?.extra
          ? t("tiles.extra", { amount: fmtMoney(s.rows[0].extra) })
          : undefined

  const payoffNote = [
    t("tiles.in", { duration: fmtDuration(s.months, t) }),
    hasChanges && a.delta.months !== 0
      ? a.delta.months < 0
        ? t("tiles.sooner", { duration: fmtDuration(a.delta.months, t) })
        : t("tiles.later", { duration: fmtDuration(a.delta.months, t) })
      : undefined,
    ioMonths ? t("tiles.interestOnlyMonths", { count: ioMonths }) : undefined,
    rateMonths ? t("tiles.ratePeriods", { count: rateMonths }) : undefined,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className={cn("rise rise-1 grid grid-cols-2 gap-2 transition-opacity sm:gap-3 xl:grid-cols-4", stale && "opacity-50")}>
      <Tile
        flat={flat}
        label={t("tiles.monthly")}
        value={fmtMoney(s.monthlyPayment)}
        base={
          hasChanges && Math.abs(s.monthlyPayment - b.monthlyPayment) >= 1
            ? t("tiles.was", { amount: fmtMoney(b.monthlyPayment) })
            : undefined
        }
        note={paymentNote}
      />
      <Tile flat={flat} label={t("tiles.paidOff")} value={fmtMonthYear(payoffIso)} note={payoffNote} />
      <Tile
        flat={flat}
        label={t("tiles.totalInterest")}
        value={fmtMoney(a.lifetime.scenario.interest)}
        base={hasChanges ? t("tiles.was", { amount: fmtMoney(a.lifetime.baseline.interest) }) : undefined}
        delta={hasChanges ? a.delta.interest : undefined}
        note={a.past.scenario.interest >= 1 ? t("tiles.paidSoFar", { amount: fmtMoney(a.past.scenario.interest) }) : undefined}
      />
      <Tile
        flat={flat}
        label={t("tiles.totalCost")}
        value={fmtMoney(a.lifetime.scenario.paid)}
        base={hasChanges ? t("tiles.was", { amount: fmtMoney(a.lifetime.baseline.paid) }) : undefined}
        delta={hasChanges ? a.delta.totalCost : undefined}
        note={t("tiles.inclPrincipal")}
      />
    </div>
  )
}
