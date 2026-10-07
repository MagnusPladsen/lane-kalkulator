import { cn } from "@/lib/utils"
import { fmtDuration, fmtMoney } from "@/lib/format"
import type { Analysis } from "@/lib/loan/types"

export function Verdict({ a, hasChanges }: { a: Analysis; hasChanges: boolean }) {
  if (!hasChanges) {
    return (
      <section className="rise rounded-xl border border-dashed bg-card/60 px-5 py-5 ring-1 ring-foreground/5">
        <p className="font-heading text-2xl leading-tight text-balance sm:text-3xl">
          Add an extra payment or an interest-only pause to see the difference.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The plan as it stands: paid off in {fmtDuration(a.baseline.months)}, costing{" "}
          <span className="tnum font-mono">{fmtMoney(a.baseline.totalInterest + a.baseline.totalFees)}</span> in
          interest and fees.
        </p>
      </section>
    )
  }

  const { months, interest } = a.delta
  const cost = a.delta.totalCost
  const saves = cost < 0
  const headline =
    months < 0
      ? `Paid off ${fmtDuration(months)} earlier`
      : months > 0
        ? `Paid off ${fmtDuration(months)} later`
        : "Same payoff date"
  const sub =
    Math.abs(interest) < 1
      ? "Same total interest."
      : `${fmtMoney(Math.abs(interest))} ${interest < 0 ? "less" : "more"} interest${
          Math.abs(a.scenario.totalFees - a.baseline.totalFees) >= 1
            ? ` and ${fmtMoney(Math.abs(a.scenario.totalFees - a.baseline.totalFees))} ${
                a.scenario.totalFees < a.baseline.totalFees ? "less" : "more"
              } in fees`
            : ""
        }.`

  return (
    <section
      className={cn(
        "rise relative overflow-hidden rounded-xl px-5 py-5 ring-1",
        saves
          ? "bg-[color-mix(in_oklab,var(--good)_10%,var(--card))] ring-[color-mix(in_oklab,var(--good)_35%,transparent)]"
          : "bg-[color-mix(in_oklab,var(--bad)_10%,var(--card))] ring-[color-mix(in_oklab,var(--bad)_35%,transparent)]",
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-3xl",
          saves ? "bg-good/25" : "bg-bad/25",
        )}
      />
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">With your changes</p>
      <p className="mt-1 font-heading text-3xl leading-none text-balance sm:text-4xl">{headline}</p>
      <p className="mt-2 text-sm">{sub}</p>
      <p className="mt-3 text-sm">
        Total cost{" "}
        <span className={cn("tnum rounded-md px-1.5 py-0.5 font-mono font-semibold", saves ? "bg-good/15 text-good" : "bg-bad/15 text-bad")}>
          {cost < 0 ? "−" : "+"}
          {fmtMoney(Math.abs(cost))}
        </span>
      </p>
    </section>
  )
}
