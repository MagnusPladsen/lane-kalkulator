import { cn } from "@/lib/utils"
import { fmtDate, fmtDuration, fmtMoney } from "@/lib/format"
import type { Analysis } from "@/lib/loan/types"

function Tile({
  label,
  value,
  base,
  delta,
  deltaGoodWhenNegative = true,
  note,
  className,
}: {
  label: string
  value: string
  base?: string
  delta?: number
  deltaGoodWhenNegative?: boolean
  note?: string
  className?: string
}) {
  const show = delta !== undefined && Math.abs(delta) >= 1
  const good = show && (deltaGoodWhenNegative ? delta < 0 : delta > 0)
  return (
    <div className={cn("grid gap-1 rounded-xl bg-card px-4 py-3.5 ring-1 ring-foreground/10", className)}>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <div className="flex min-h-4 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {base && <span>was {base}</span>}
        {show && (
          <span className={cn("tnum font-mono font-medium", good ? "text-good" : "text-bad")}>
            {delta < 0 ? "−" : "+"}
            {fmtMoney(Math.abs(delta))}
          </span>
        )}
        {note && <span>{note}</span>}
      </div>
    </div>
  )
}

export function SummaryCards({ a, hasChanges, payoffIso }: { a: Analysis; hasChanges: boolean; payoffIso: string }) {
  const s = a.scenario
  const b = a.baseline
  const ioMonths = s.rows.filter((r) => r.interestOnly).length
  const paymentNote =
    s.maxMonthlyPayment - s.monthlyPayment > 1
      ? `rises to ${fmtMoney(s.maxMonthlyPayment)}`
      : a.scenario.rows[0]?.interestOnly
        ? `interest-only now: ${fmtMoney(a.scenario.rows[0].payment)}`
        : undefined

  return (
    <div className="rise rise-1 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Monthly payment"
        value={fmtMoney(s.monthlyPayment)}
        base={hasChanges && Math.abs(s.monthlyPayment - b.monthlyPayment) >= 1 ? fmtMoney(b.monthlyPayment) : undefined}
        note={paymentNote ?? (s.rows[0]?.extra ? `+ ${fmtMoney(s.rows[0].extra)} extra` : undefined)}
      />
      <Tile
        label="Paid off"
        value={fmtDate(payoffIso)}
        note={`in ${fmtDuration(s.months)}${
          hasChanges && a.delta.months !== 0
            ? ` · ${fmtDuration(a.delta.months)} ${a.delta.months < 0 ? "sooner" : "later"}`
            : ""
        }${ioMonths ? ` · ${ioMonths} mo interest-only` : ""}`}
      />
      <Tile
        label="Total interest"
        value={fmtMoney(s.totalInterest)}
        base={hasChanges ? fmtMoney(b.totalInterest) : undefined}
        delta={hasChanges ? a.delta.interest : undefined}
      />
      <Tile
        label="Total cost"
        value={fmtMoney(s.totalPaid)}
        base={hasChanges ? fmtMoney(b.totalPaid) : undefined}
        delta={hasChanges ? a.delta.totalCost : undefined}
        note="incl. principal and fees"
      />
    </div>
  )
}
