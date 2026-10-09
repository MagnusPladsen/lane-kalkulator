import { useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { LayersIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, MoneyInput } from "@/components/fields"
import { AmountPicker } from "@/components/AmountPicker"
import { fmtMoney, fmtMonthYear } from "@/lib/format"
import { todayIso } from "@/lib/loan/engine"
import { loanNow, payDownPlan, type LoanNow, type StrategyResult } from "@/lib/multiLoan"
import type { Scenario } from "@/lib/loan/types"

const ym = (m: string) => fmtMonthYear(`${m}-15`)

/**
 * All saved loans as one picture: what is owed today, what goes out each month, and where
 * extra money does the most good. Everything is worked out here in the browser.
 */
export function AllLoans({ items }: { items: Scenario[] }) {
  const { t } = useTranslation()
  const today = todayIso()
  const loans = useMemo(() => items.map((s) => loanNow(s, today)).filter((l): l is LoanNow => !!l), [items, today])
  const [extra, setExtra] = useState(2000)

  const plans = useMemo(
    () => (loans.length >= 2 ? (["avalanche", "snowball"] as const).map((s) => payDownPlan(loans, extra, s, today)) : []),
    [loans, extra, today],
  )
  if (loans.length === 0) return null

  const total = (k: "balance" | "payment" | "interestLeft") => loans.reduce((sum, l) => sum + l[k], 0)
  const debtFree = loans.map((l) => l.payoff).sort().at(-1)!
  const best = plans.length ? plans.reduce((x, y) => (y.interestLeft < x.interestLeft ? y : x)) : undefined
  const name = (n: string) => n || t("loans.untitled")

  return (
    <Card className="rise rise-1">
      <CardHeader>
        <h2 className="flex items-center gap-2 font-heading text-xl">
          <LayersIcon className="size-5 text-primary" aria-hidden />
          {t("all.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("all.desc", { count: loans.length })}</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t("all.debt"), fmtMoney(total("balance"))],
            [t("all.monthly"), fmtMoney(total("payment"))],
            [t("all.interestLeft"), fmtMoney(total("interestLeft"))],
            [t("all.debtFree"), ym(debtFree)],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-0.5 rounded-2xl bg-muted px-3.5 py-3">
              <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>

        {plans.length > 0 && best && (
          <section aria-labelledby="extra-heading" className="grid gap-3 border-t pt-4">
            <div className="grid gap-1">
              <h3 id="extra-heading" className="font-heading text-lg">
                {t("all.extraTitle")}
              </h3>
              <p className="text-sm text-muted-foreground">{t("all.extraDesc")}</p>
            </div>
            <div className="grid max-w-sm gap-2">
              <Field label={t("all.extraAmount")}>
                <MoneyInput value={extra} onChange={(v) => setExtra(v ?? 0)} />
              </Field>
              <AmountPicker value={extra} onChange={setExtra} presets={[1000, 2000, 5000]} max={20000} step={500} label={t("all.extraAmount")} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <StrategyCard key={p.strategy} p={p} best={p === best && plans[0].interestLeft !== plans[1].interestLeft} name={name} />
              ))}
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

function StrategyCard({ p, best, name }: { p: StrategyResult; best: boolean; name: (n: string) => string }) {
  const { t } = useTranslation()
  return (
    <div className={cn("grid content-start gap-2 rounded-2xl border p-4", best && "border-primary ring-2 ring-primary/30")}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-heading text-base font-semibold">{t(`all.${p.strategy}`)}</h4>
        {best && <span className="highlight text-xs font-semibold">{t("all.best")}</span>}
      </div>
      <p className="text-xs text-muted-foreground">{t(`all.${p.strategy}Desc`)}</p>
      <p className="text-sm">
        <Trans i18nKey="all.saves" values={{ amount: fmtMoney(Math.max(0, p.saved)), date: ym(p.debtFree) }} components={[<strong key="0" />, <strong key="1" />]} />
      </p>
      <ol className="grid gap-1 text-sm">
        {p.order.map((o, i) => (
          <li key={o.id} className="flex items-baseline gap-2">
            <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0 flex-1 truncate">{name(o.name)}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {ym(o.payoff)}
              {o.payoff < o.was && <span className="text-muted-foreground"> ({t("all.was", { date: ym(o.was) })})</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
