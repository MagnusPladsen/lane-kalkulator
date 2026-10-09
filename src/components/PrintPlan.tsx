import { useMemo, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { fmtDate, fmtDuration, fmtMoney, fmtRate } from "@/lib/format"
import type { DateForIndex } from "@/lib/chartData"
import { todayIso } from "@/lib/loan/engine"
import type { Analysis, Scenario } from "@/lib/loan/types"

/**
 * A plain sheet that only shows when printing (or "Save as PDF"): the loan, the key
 * results and the plan year by year. The screen layout is hidden while printing.
 */
const noop = () => () => {}

/** Only in the browser, after hydration, so the "made on" date never differs from the prerendered HTML. */
export function PrintPlan(props: { scenario: Scenario; a: Analysis; dateFor: DateForIndex }) {
  const isClient = useSyncExternalStore(noop, () => true, () => false)
  return isClient ? <PrintSheet {...props} /> : null
}

function PrintSheet({ scenario, a, dateFor }: { scenario: Scenario; a: Analysis; dateFor: DateForIndex }) {
  const { t } = useTranslation()
  const loan = scenario.loan
  const s = a.scenario
  const b = a.baseline
  const hasChanges = scenario.extras.length > 0 || scenario.periods.length > 0

  const years = useMemo(() => {
    const out: { year: string; interest: number; principal: number; extra: number; fee: number; balance: number }[] = []
    s.rows.forEach((r, i) => {
      const year = dateFor(a.offsetMonths + i + 1).slice(0, 4)
      let y = out.at(-1)
      if (!y || y.year !== year) {
        y = { year, interest: 0, principal: 0, extra: 0, fee: 0, balance: 0 }
        out.push(y)
      }
      y.interest += r.interest
      y.principal += r.principal
      y.extra += r.extra
      y.fee += r.fee
      y.balance = r.balance
    })
    return out
  }, [s.rows, a.offsetMonths, dateFor])

  const payoff = (months: number) => dateFor(a.offsetMonths + months)
  const rows: [string, string, string?][] = [
    [t("tiles.monthly"), fmtMoney(b.monthlyPayment), hasChanges ? fmtMoney(s.monthlyPayment) : undefined],
    [t("tiles.paidOff"), fmtDate(payoff(b.months)), hasChanges ? fmtDate(payoff(s.months)) : undefined],
    [t("tiles.totalInterest"), fmtMoney(a.lifetime.baseline.interest), hasChanges ? fmtMoney(a.lifetime.scenario.interest) : undefined],
    [t("tiles.totalCost"), fmtMoney(a.lifetime.baseline.paid), hasChanges ? fmtMoney(a.lifetime.scenario.paid) : undefined],
  ]

  return (
    <section className="print-sheet hidden text-[10.5pt] leading-snug text-black print:block" aria-hidden>
      <div className="mb-4 border-b border-black/30 pb-3">
        <p className="text-[9pt] text-black/60">
          {t("app.title")} · lane-kalkulator.pladsen.dev · {t("print.made", { date: fmtDate(todayIso()) })}
        </p>
        <h1 className="mt-1 font-heading text-[20pt] font-bold">{loan.name || t("loan.title")}</h1>
        <p className="mt-1">
          {fmtMoney(loan.principal)} · {fmtRate(loan.annualRatePct)} % · {fmtDuration(loan.termMonths, t)} ·{" "}
          {loan.loanType === "annuity" ? t("loan.annuity") : t("loan.serial")}
          {loan.monthlyFee ? ` · ${t("loan.fee")} ${fmtMoney(loan.monthlyFee)}` : ""}
          {loan.startDate ? ` · ${t("loan.startDate")} ${fmtDate(loan.startDate)}` : ""}
        </p>
      </div>

      <table className="mb-5 w-full border-collapse">
        <thead>
          <tr className="border-b border-black/30 text-left">
            <th className="py-1 pr-3 font-semibold"></th>
            <th className="py-1 pr-3 text-right font-semibold">{t("series.baseline")}</th>
            {hasChanges && <th className="py-1 text-right font-semibold">{t("series.scenario")}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, base, changed]) => (
            <tr key={label} className="border-b border-black/10">
              <td className="py-1 pr-3">{label}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{base}</td>
              {hasChanges && <td className="py-1 text-right font-semibold tabular-nums">{changed}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 font-heading text-[13pt] font-bold">
        {t("print.yearly")}
        {hasChanges ? ` (${t("series.scenario").toLowerCase()})` : ""}
      </h2>
      <table className="w-full border-collapse text-[9.5pt]">
        <thead>
          <tr className="border-b border-black/40 text-right">
            <th className="py-1 pr-2 text-left font-semibold">{t("print.year")}</th>
            <th className="py-1 pr-2 font-semibold">{t("insight.interestPart")}</th>
            <th className="py-1 pr-2 font-semibold">{t("insight.principalPart")}</th>
            <th className="py-1 pr-2 font-semibold">{t("print.extra")}</th>
            <th className="py-1 pr-2 font-semibold">{t("insight.feePart")}</th>
            <th className="py-1 font-semibold">{t("print.balanceEnd")}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.year} className="border-b border-black/10 text-right tabular-nums [break-inside:avoid]">
              <td className="py-0.5 pr-2 text-left">{y.year}</td>
              <td className="py-0.5 pr-2">{fmtMoney(y.interest)}</td>
              <td className="py-0.5 pr-2">{fmtMoney(y.principal)}</td>
              <td className="py-0.5 pr-2">{y.extra ? fmtMoney(y.extra) : "–"}</td>
              <td className="py-0.5 pr-2">{fmtMoney(y.fee)}</td>
              <td className="py-0.5">{fmtMoney(y.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[8.5pt] text-black/60">{t("footer.estimates")}</p>
    </section>
  )
}
