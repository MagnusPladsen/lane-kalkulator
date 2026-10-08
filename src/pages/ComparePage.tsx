import { useEffect, useMemo, useState } from "react"
import { Faq } from "@/components/Faq"
import { COMPARE_FAQ } from "@/lib/faq"
import { useTranslation } from "react-i18next"
import { ArrowRightIcon, TrophyIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FieldGroup, FieldInput, MoneyInput, NumberInput, SectionTitle, Segmented } from "@/components/fields"
import { evaluateOffer, offerLoan, refinance, type Offer } from "@/lib/compare"
import { fmtDuration, fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import { addMonths, analyze, todayIso } from "@/lib/loan/engine"
import type { LoanInput, LoanType, Scenario } from "@/lib/loan/types"

const STORE = "lane-kalkulator:compare"

interface Switch {
  annualRatePct: number
  monthlyFee: number
  switchCost: number
  termMonths?: number
}

interface Saved {
  a: Offer
  b: Offer
  sw: Switch
  /** The calculator loan the switch offer was entered for; another loan starts fresh. */
  swFor?: string
}

function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Partial<Saved>
  } catch {
    return {}
  }
}

function offerFrom(loan: LoanInput, name: string): Offer {
  return {
    name,
    principal: loan.principal,
    annualRatePct: loan.annualRatePct,
    termMonths: loan.termMonths,
    loanType: loan.loanType,
    monthlyFee: loan.monthlyFee,
    setupFee: loan.setupFee ?? 0,
    dayCount: loan.dayCount,
  }
}

export function ComparePage({
  scenario,
  onUseLoan,
}: {
  /** The loan open in the calculator. */
  scenario: Scenario
  /** Open a loan in the calculator (asks first if that would lose unsaved work). */
  onUseLoan: (loan: LoanInput) => void
}) {
  const { t } = useTranslation()
  const [saved] = useState(load)
  const [a, setA] = useState<Offer>(saved.a ?? offerFrom(scenario.loan, t("compare.offerA")))
  const [b, setB] = useState<Offer>(
    saved.b ?? { ...offerFrom(scenario.loan, t("compare.offerB")), annualRatePct: Math.max(0, scenario.loan.annualRatePct - 0.3) },
  )
  const [sw, setSw] = useState<Switch>(
    saved.sw && saved.swFor === scenario.id
      ? saved.sw
      : { annualRatePct: Math.max(0, scenario.loan.annualRatePct - 0.3), monthlyFee: scenario.loan.monthlyFee, switchCost: 2_500 },
  )
  const [tab, setTab] = useState<"offers" | "switch">("offers")

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ a, b, sw, swFor: scenario.id } satisfies Saved))
    } catch {
      /* ignore */
    }
  }, [a, b, sw, scenario.id])

  return (
    <div className="grid gap-4">
      <div className="rise">
        <h1 className="text-3xl">{t("compare.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("compare.desc")}</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "offers" | "switch")}>
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2">
          <TabsTrigger value="offers">{t("compare.tabOffers")}</TabsTrigger>
          <TabsTrigger value="switch">{t("compare.tabSwitch")}</TabsTrigger>
        </TabsList>
        <TabsContent value="offers" className="pt-3">
          <OffersCompare
            a={a}
            b={b}
            setA={setA}
            setB={setB}
            onReset={() => {
              setA(offerFrom(scenario.loan, t("compare.offerA")))
              setB({ ...offerFrom(scenario.loan, t("compare.offerB")), annualRatePct: Math.max(0, scenario.loan.annualRatePct - 0.3) })
            }}
            onUse={(o) => onUseLoan({ ...offerLoan(o), category: scenario.loan.category })}
          />
        </TabsContent>
        <TabsContent value="switch" className="pt-3">
          <SwitchCheck scenario={scenario} sw={sw} setSw={setSw} onUseLoan={onUseLoan} />
        </TabsContent>
      </Tabs>
      <Faq ids={COMPARE_FAQ} titleKey="faq.compareTitle" />
    </div>
  )
}

function OfferForm({ offer, onChange, title }: { offer: Offer; onChange: (o: Offer) => void; title: string }) {
  const { t } = useTranslation()
  const set = (patch: Partial<Offer>) => onChange({ ...offer, ...patch })
  return (
    <Card className="rise rise-1">
      <CardHeader>
        <SectionTitle>{title}</SectionTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Field label={t("compare.bank")}>
          <FieldInput value={offer.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label={t("loan.amount")} help={t("help.amount")}>
          <MoneyInput value={offer.principal} onChange={(v) => set({ principal: v ?? 0 })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("loan.rate")} help={t("help.rate")}>
            <NumberInput value={offer.annualRatePct} onChange={(v) => set({ annualRatePct: v })} suffix="%" />
          </Field>
          <Field label={t("loan.term")} help={t("help.term")}>
            <FieldGroup>
              <NumberInput
                integer
                aria-label={`${t("loan.term")}, ${t("loan.years")}`}
                value={Math.round(offer.termMonths / 12)}
                onChange={(v) => set({ termMonths: Math.max(1, Math.min(50, v)) * 12 })}
                suffix={t("loan.years")}
              />
            </FieldGroup>
          </Field>
        </div>
        <Field label={t("loan.type")} help={t("help.type")}>
          <Segmented<LoanType>
            value={offer.loanType}
            onChange={(loanType) => set({ loanType })}
            options={[
              { value: "annuity", label: t("loan.annuity") },
              { value: "serial", label: t("loan.serial") },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("loan.fee")} help={t("help.fee")}>
            <MoneyInput value={offer.monthlyFee} onChange={(v) => set({ monthlyFee: v ?? 0 })} />
          </Field>
          <Field label={t("loan.setupFee")} help={t("help.setupFee")}>
            <MoneyInput value={offer.setupFee} onChange={(v) => set({ setupFee: v ?? 0 })} />
          </Field>
        </div>
      </CardContent>
    </Card>
  )
}

function OffersCompare({
  a,
  b,
  setA,
  setB,
  onReset,
  onUse,
}: {
  a: Offer
  b: Offer
  setA: (o: Offer) => void
  setB: (o: Offer) => void
  onReset: () => void
  onUse: (o: Offer) => void
}) {
  const { t } = useTranslation()
  const valid = (o: Offer) => o.principal > 0 && o.termMonths >= 1 && o.annualRatePct >= 0
  const ra = useMemo(() => (valid(a) ? evaluateOffer(a, todayIso()) : undefined), [a])
  const rb = useMemo(() => (valid(b) ? evaluateOffer(b, todayIso()) : undefined), [b])
  const winner = ra && rb ? (Math.abs(ra.totalCost - rb.totalCost) < 1 ? undefined : ra.totalCost < rb.totalCost ? "a" : "b") : undefined
  const diff = ra && rb ? Math.abs(ra.totalCost - rb.totalCost) : 0
  const payDiff = ra && rb ? Math.abs(ra.firstPayment - rb.firstPayment) : 0
  const cheaperName = winner === "a" ? a.name : b.name

  const rows: { label: string; get: (r: NonNullable<typeof ra>) => string }[] = [
    { label: t("tiles.monthly"), get: (r) => fmtMoney(r.firstPayment) },
    { label: t("tiles.totalInterest"), get: (r) => fmtMoney(r.totalInterest) },
    { label: t("compare.fees"), get: (r) => fmtMoney(r.totalFees) },
    { label: t("tiles.totalCost"), get: (r) => fmtMoney(r.totalCost) },
    { label: t("loan.bankEffective"), get: (r) => (r.effectiveRatePct === undefined ? "–" : `${fmtRate(Math.round(r.effectiveRatePct * 100) / 100)} %`) },
    { label: t("loan.term"), get: (r) => fmtDuration(r.months, t) },
  ]

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <OfferForm offer={a} onChange={setA} title={a.name || t("compare.offerA")} />
        <OfferForm offer={b} onChange={setB} title={b.name || t("compare.offerB")} />
      </div>
      {ra && rb && (
        <Card className="rise rise-2">
          <CardContent className="grid gap-4">
            <p className="flex items-start gap-2 font-heading text-xl leading-snug" aria-live="polite">
              {winner && <TrophyIcon className="mt-1 size-5 shrink-0 text-good" aria-hidden />}
              {winner
                ? t("compare.verdict", { name: cheaperName, total: fmtMoney(diff), monthly: fmtMoney(payDiff) })
                : t("compare.same")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 font-normal" />
                    <th scope="col" className="py-2 text-right font-medium">{a.name || t("compare.offerA")}</th>
                    <th scope="col" className="py-2 text-right font-medium">{b.name || t("compare.offerB")}</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {rows.map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <th scope="row" className="py-2 text-left font-sans font-normal text-muted-foreground">{row.label}</th>
                      <td className={cn("py-2 text-right", winner === "a" && "text-good")}>{row.get(ra)}</td>
                      <td className={cn("py-2 text-right", winner === "b" && "text-good")}>{row.get(rb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onUse(a)}>
                {t("compare.use", { name: a.name || t("compare.offerA") })} <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="outline" onClick={() => onUse(b)}>
                {t("compare.use", { name: b.name || t("compare.offerB") })} <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button variant="ghost" className="ml-auto" onClick={onReset}>
                {t("compare.reset")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SwitchCheck({
  scenario,
  sw,
  setSw,
  onUseLoan,
}: {
  scenario: Scenario
  sw: Switch
  setSw: (s: Switch) => void
  onUseLoan: (loan: LoanInput) => void
}) {
  const { t } = useTranslation()
  const today = todayIso()
  const current = useMemo(() => {
    try {
      return analyze(scenario, today)
    } catch {
      return undefined
    }
  }, [scenario, today])
  const loan = scenario.loan
  const remaining = current?.baseline.months ?? 0
  const balance = current?.startingBalance ?? 0
  const term = sw.termMonths ?? remaining
  const result = useMemo(
    () =>
      current && balance > 0 && remaining > 0
        ? refinance(
            {
              balance,
              remainingMonths: remaining,
              current: { annualRatePct: loan.annualRatePct, monthlyFee: loan.monthlyFee, loanType: loan.loanType, dayCount: loan.dayCount },
              next: { annualRatePct: sw.annualRatePct, monthlyFee: sw.monthlyFee, loanType: loan.loanType, termMonths: term, dayCount: loan.dayCount },
              switchCost: sw.switchCost,
            },
            today,
          )
        : undefined,
    [current, balance, remaining, loan, sw, term, today],
  )
  const set = (patch: Partial<Switch>) => setSw({ ...sw, ...patch })

  if (!current || balance <= 0) {
    return <p className="text-sm text-muted-foreground">{t("compare.needLoan")}</p>
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rise rise-1">
        <CardHeader>
          <SectionTitle>{t("compare.today")}</SectionTitle>
          <p className="text-sm text-muted-foreground">{t("compare.todayDesc")}</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t("loan.remaining")}</dt>
            <dd className="text-right font-mono tabular-nums">{fmtMoney(balance)}</dd>
            <dt className="text-muted-foreground">{t("loan.rate")}</dt>
            <dd className="text-right font-mono tabular-nums">{fmtRate(loan.annualRatePct)} %</dd>
            <dt className="text-muted-foreground">{t("compare.left")}</dt>
            <dd className="text-right font-mono tabular-nums">{fmtDuration(remaining, t)}</dd>
            <dt className="text-muted-foreground">{t("loan.fee")}</dt>
            <dd className="text-right font-mono tabular-nums">{fmtMoney(loan.monthlyFee)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="rise rise-1">
        <CardHeader>
          <SectionTitle>{t("compare.newOffer")}</SectionTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("loan.rate")} help={t("help.rate")}>
              <NumberInput value={sw.annualRatePct} onChange={(v) => set({ annualRatePct: v })} suffix="%" />
            </Field>
            <Field label={t("loan.fee")} help={t("help.fee")}>
              <MoneyInput value={sw.monthlyFee} onChange={(v) => set({ monthlyFee: v ?? 0 })} />
            </Field>
          </div>
          <Field label={t("compare.switchCost")} help={t("compare.switchCostHelp")}>
            <MoneyInput value={sw.switchCost} onChange={(v) => set({ switchCost: v ?? 0 })} />
          </Field>
          <Field label={t("compare.newTerm")} hint={t("compare.newTermHint", { term: fmtDuration(remaining, t) })}>
            <FieldGroup>
              <NumberInput
                integer
                aria-label={`${t("compare.newTerm")}, ${t("loan.years")}`}
                value={Math.round(term / 12)}
                onChange={(v) => set({ termMonths: Math.max(1, Math.min(50, v)) * 12 })}
                suffix={t("loan.years")}
              />
            </FieldGroup>
          </Field>
        </CardContent>
      </Card>

      {result && (
        <Card className="rise rise-2 md:col-span-2">
          <CardContent className="grid gap-3">
            <p className="font-heading text-xl leading-snug" aria-live="polite">
              {result.totalSaving >= 1 && result.breakEvenMonth
                ? t("compare.switchYes", {
                    total: fmtMoney(result.totalSaving),
                    months: result.breakEvenMonth,
                    date: fmtMonthYear(addMonths(today, result.breakEvenMonth)),
                  })
                : t("compare.switchNo", { total: fmtMoney(Math.abs(result.totalSaving)) })}
            </p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">{t("compare.paymentNow")}</dt>
                <dd className="font-mono tabular-nums">{fmtMoney(result.currentPayment)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("compare.paymentNew")}</dt>
                <dd className="font-mono tabular-nums">{fmtMoney(result.newPayment)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("compare.perMonth")}</dt>
                <dd className={cn("font-mono tabular-nums", result.monthlySaving >= 0 ? "text-good" : "text-bad")}>
                  {result.monthlySaving >= 0 ? "−" : "+"}
                  {fmtMoney(Math.abs(result.monthlySaving))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("loan.bankEffective")}</dt>
                <dd className="font-mono tabular-nums">
                  {result.newEffectiveRatePct === undefined ? "–" : `${fmtRate(Math.round(result.newEffectiveRatePct * 100) / 100)} %`}
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() =>
                onUseLoan({
                  name: loan.name ? `${loan.name} (${t("compare.moved")})` : t("compare.newOffer"),
                  category: loan.category,
                  principal: balance,
                  annualRatePct: sw.annualRatePct,
                  termMonths: term,
                  loanType: loan.loanType,
                  monthlyFee: sw.monthlyFee,
                  setupFee: sw.switchCost || undefined,
                  dayCount: loan.dayCount,
                })
              }
            >
              {t("compare.useNew")} <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
