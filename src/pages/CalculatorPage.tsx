import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoanCard } from "@/components/LoanCard"
import { WhatIfCard, type Tool } from "@/components/whatif/WhatIfCard"
import { Verdict } from "@/components/Verdict"
import { SummaryCards } from "@/components/SummaryCards"
import { LoanSentence, RateStress } from "@/components/Insights"
import { MobileVerdictBar } from "@/components/MobileVerdictBar"
import { BalanceChart, CumulativeChart, YearlyChart } from "@/components/charts/lazy"
import { ScheduleTable } from "@/components/ScheduleTable"
import { Faq } from "@/components/Faq"
import { CALC_FAQ } from "@/lib/faq"
import { categoryOfPath, currentPath } from "@/hooks/useRoute"
import { PrintPlan } from "@/components/PrintPlan"
import { Button } from "@/components/ui/button"
import { DownloadIcon, PrinterIcon } from "lucide-react"
import { planCsv } from "@/lib/exportPlan"
import { downloadText } from "@/lib/share"
import { addMonths, analyze, todayIso } from "@/lib/loan/engine"
import { balanceSeries, cumulativeSeries, yearlySeries } from "@/lib/chartData"
import { validateLoan, type Action } from "@/lib/scenarioReducer"
import { isPristine } from "@/lib/storage"
import type { Analysis, Scenario } from "@/lib/loan/types"

type ChartTab = "balance" | "yearly" | "interest" | "table"

export function CalculatorPage({ scenario, dispatch }: { scenario: Scenario; dispatch: (a: Action) => void }) {
  const { t } = useTranslation()
  const today = todayIso()
  // On a loan-type page (/billan …) the heading and intro speak about that type.
  const pageType = categoryOfPath(currentPath())
  const validation = useMemo(() => validateLoan(scenario.loan), [scenario.loan])
  const analysis = useMemo(
    () => (validation.ok ? analyze(scenario, today) : undefined),
    [scenario, validation.ok, today],
  )

  // While the form is mid-edit and invalid, keep showing the last good result, dimmed.
  const [lastGood, setLastGood] = useState<Analysis | undefined>(analysis)
  if (analysis && analysis !== lastGood) setLastGood(analysis)
  const shown = analysis ?? lastGood
  const stale = !analysis && !!lastGood

  const [editing, setEditing] = useState(() => isPristine(scenario) || !validation.ok)
  // A brand-new loan gets the full step-by-step setup; later edits can finish from any step.
  const [fresh, setFresh] = useState(() => isPristine(scenario))
  // Lets CSS keep the floating AI button out of the way of the setup steps on phones.
  useEffect(() => {
    if (!editing) return
    document.body.dataset.setup = ""
    return () => {
      delete document.body.dataset.setup
    }
  }, [editing])
  const [tool, setTool] = useState<Tool>("extras")
  const [chartTab, setChartTab] = useState<ChartTab>("balance")
  const [openYears, setOpenYears] = useState<Set<string>>(() => new Set())
  const verdictRef = useRef<HTMLElement>(null)

  const anchor = scenario.loan.startDate ?? today
  const offset = shown?.offsetMonths ?? 0
  const dateFor = useCallback((i: number) => addMonths(anchor, i), [anchor])
  const monthDate = useCallback((m: number) => addMonths(anchor, offset + m), [anchor, offset])

  const hasChanges =
    scenario.extras.some((e) => e.amount > 0) ||
    scenario.periods.length > 0

  const balance = useMemo(
    () => (shown ? balanceSeries(shown, dateFor, scenario.loan.principal) : []),
    [shown, dateFor, scenario.loan.principal],
  )
  const cumulative = useMemo(() => (shown ? cumulativeSeries(shown, dateFor) : []), [shown, dateFor])
  const yearly = useMemo(
    () => (shown ? yearlySeries(shown.scenario.rows, shown.offsetMonths, dateFor) : []),
    [shown, dateFor],
  )

  // Based on the baseline so the month pickers don't shrink as extras are added.
  const maxMonth = shown ? Math.max(12, shown.baseline.months + 24) : 600
  const payoffIso = shown ? dateFor(shown.offsetMonths + shown.scenario.months) : today
  const hasExtra = shown ? shown.scenario.rows.some((r) => r.extra > 0) : false
  const firstPayment = analysis && !analysis.paidOff ? analysis.baseline.monthlyPayment : undefined

  const downloadCsv = () => {
    if (!shown) return
    const csv = planCsv(shown.scenario.rows, (i) => dateFor(shown.offsetMonths + i + 1).slice(0, 7), {
      month: t("print.month"),
      payment: t("tiles.monthly"),
      interest: t("insight.interestPart"),
      principal: t("insight.principalPart"),
      extra: t("print.extra"),
      fee: t("insight.feePart"),
      balance: t("charts.balance"),
      rate: t("print.ratePct"),
    })
    const name = (scenario.loan.name || t("loan.title")).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()
    downloadText(`${name || "lan"}-nedbetalingsplan.csv`, csv, "text/csv;charset=utf-8")
  }

  const chartTabs: { id: ChartTab; label: string; desc: string }[] = [
    { id: "balance", label: t("charts.balance"), desc: t("charts.balanceDesc") },
    { id: "yearly", label: t("charts.yearly"), desc: t("charts.yearlyDesc") },
    { id: "interest", label: t("charts.interest"), desc: t("charts.interestDesc") },
    { id: "table", label: t("charts.tableShort"), desc: t("charts.tableDesc") },
  ]

  return (
    <>
      <h1 className="sr-only">{pageType ? t(`typePages.${pageType}.h1`) : t("a11y.mainHeading")}</h1>
      <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Desktop: once set up, the inputs stay in view while the results scroll. */}
        <div
          className={cn(
            "grid gap-4",
            !editing &&
              "lg:sticky lg:top-3 lg:-m-2 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:p-2 lg:[scrollbar-width:thin]",
          )}
        >
          <LoanCard
            loan={scenario.loan}
            errors={validation.errors}
            valid={validation.ok}
            firstPayment={firstPayment}
            editing={editing}
            fresh={fresh}
            paidShare={
              shown && scenario.loan.startDate && scenario.loan.principal > 0
                ? Math.min(1, Math.max(0, 1 - shown.startingBalance / scenario.loan.principal))
                : undefined
            }
            onEditingChange={(e) => {
              setEditing(e)
              if (e) return
              setFresh(false)
              // On narrow screens the result is below the form: take the user there.
              if (window.matchMedia("(max-width: 1023px)").matches) {
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
                requestAnimationFrame(() => verdictRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }))
              }
            }}
            onChange={(patch) => dispatch({ type: "loan", patch })}
          />
          {!editing && (
            <WhatIfCard
              scenario={scenario}
              analysis={analysis}
              today={today}
              monthDate={monthDate}
              maxMonth={maxMonth}
              tool={tool}
              onToolChange={setTool}
              dispatch={dispatch}
            />
          )}
        </div>

        <section aria-labelledby="results-heading" className="grid gap-3 sm:gap-4">
          <h2 id="results-heading" className="sr-only">
            {t("a11y.results")}
          </h2>
          {!shown ? (
            <Card className="rise">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">{t("invalid.hint")}</CardContent>
            </Card>
          ) : (
            <>
              {stale && (
                <p role="status" className="text-xs text-muted-foreground">
                  {t("invalid.stale")}
                </p>
              )}
              <Verdict ref={verdictRef} a={shown} hasChanges={hasChanges} stale={stale} setup={editing} />
              {!shown.paidOff && (
                <>
                  <SummaryCards
                    a={shown}
                    hasChanges={hasChanges}
                    payoffIso={payoffIso}
                    nominalRatePct={scenario.loan.annualRatePct}
                    stale={stale}
                  />
                  <LoanSentence a={shown} dateFor={dateFor} />
                  {analysis && (
                    <RateStress
                      scenario={scenario}
                      analysis={analysis}
                      monthDate={monthDate}
                      onAddPeriod={(period) => {
                        dispatch({ type: "period/add", period })
                        setTool("periods")
                      }}
                    />
                  )}
                  <Card className={stale ? "rise rise-2 opacity-50 transition-opacity" : "rise rise-2 transition-opacity"}>
                    <CardContent>
                      <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as ChartTab)}>
                        <TabsList className="grid h-auto w-full grid-cols-4">
                          {chartTabs.map((c) => (
                            <TabsTrigger key={c.id} value={c.id} className="min-w-0 px-1 text-xs sm:text-sm">
                              <span className="truncate">{c.label}</span>
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        <p className="pt-2 text-xs text-muted-foreground">
                          {chartTabs.find((c) => c.id === chartTab)?.desc}
                        </p>
                        <TabsContent value="balance" className="rounded-lg pt-2 focus-visible:ring-3 focus-visible:ring-ring/50">
                          <BalanceChart data={balance} todayIndex={shown.offsetMonths} showScenario={hasChanges} />
                        </TabsContent>
                        <TabsContent value="yearly" className="rounded-lg pt-2 focus-visible:ring-3 focus-visible:ring-ring/50">
                          <YearlyChart data={yearly} />
                        </TabsContent>
                        <TabsContent value="interest" className="rounded-lg pt-2 focus-visible:ring-3 focus-visible:ring-ring/50">
                          <CumulativeChart data={cumulative} showScenario={hasChanges} />
                        </TabsContent>
                        <TabsContent value="table" className="grid gap-2 pt-2">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={downloadCsv}>
                              <DownloadIcon data-icon="inline-start" />
                              {t("print.csv")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => window.print()}>
                              <PrinterIcon data-icon="inline-start" />
                              {t("print.pdf")}
                            </Button>
                          </div>
                          <ScheduleTable
                            rows={shown.scenario.rows}
                            offset={shown.offsetMonths}
                            dateFor={dateFor}
                            hasExtra={hasExtra}
                            baseRatePct={scenario.loan.annualRatePct}
                            open={openYears}
                            onOpenChange={setOpenYears}
                          />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {pageType && (
        <section aria-labelledby="type-intro" className="mt-10 grid max-w-prose gap-2">
          <h2 id="type-intro" className="font-heading text-2xl">
            {t(`typePages.${pageType}.introTitle`)}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t(`typePages.${pageType}.intro`)}</p>
        </section>
      )}
      <Faq ids={CALC_FAQ} />
      {shown && <PrintPlan scenario={scenario} a={shown} dateFor={dateFor} />}

      {shown && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
          <MobileVerdictBar a={shown} hasChanges={hasChanges} targetRef={verdictRef} />
        </div>
      )}
    </>
  )
}
