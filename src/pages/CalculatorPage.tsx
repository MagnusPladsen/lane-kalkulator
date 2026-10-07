import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoanCard } from "@/components/LoanCard"
import { WhatIfCard, type Tool } from "@/components/whatif/WhatIfCard"
import { Verdict } from "@/components/Verdict"
import { SummaryCards } from "@/components/SummaryCards"
import { MobileVerdictBar } from "@/components/MobileVerdictBar"
import { BalanceChart } from "@/components/charts/BalanceChart"
import { CumulativeChart } from "@/components/charts/CumulativeChart"
import { YearlyChart } from "@/components/charts/YearlyChart"
import { ScheduleTable } from "@/components/ScheduleTable"
import { addMonths, analyze, todayIso } from "@/lib/loan/engine"
import { balanceSeries, cumulativeSeries, yearlySeries } from "@/lib/chartData"
import { validateLoan, type Action } from "@/lib/scenarioReducer"
import { isPristine } from "@/lib/storage"
import type { Analysis, Scenario } from "@/lib/loan/types"

type ChartTab = "balance" | "yearly" | "interest" | "table"

export function CalculatorPage({ scenario, dispatch }: { scenario: Scenario; dispatch: (a: Action) => void }) {
  const { t } = useTranslation()
  const today = todayIso()
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
  const maxMonth = shown ? Math.max(12, shown.baseline.months + 24) : 480
  const payoffIso = shown ? dateFor(shown.offsetMonths + shown.scenario.months) : today
  const hasExtra = shown ? shown.scenario.rows.some((r) => r.extra > 0) : false
  const firstPayment = analysis && !analysis.paidOff ? analysis.baseline.monthlyPayment : undefined

  const chartTabs: { id: ChartTab; label: string; desc: string }[] = [
    { id: "balance", label: t("charts.balance"), desc: t("charts.balanceDesc") },
    { id: "yearly", label: t("charts.yearly"), desc: t("charts.yearlyDesc") },
    { id: "interest", label: t("charts.interest"), desc: t("charts.interestDesc") },
    { id: "table", label: t("charts.tableShort"), desc: t("charts.tableDesc") },
  ]

  return (
    <>
      <h1 className="sr-only">{t("a11y.mainHeading")}</h1>
      <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="grid gap-4">
          <LoanCard
            loan={scenario.loan}
            errors={validation.errors}
            valid={validation.ok}
            firstPayment={firstPayment}
            editing={editing}
            onEditingChange={setEditing}
            onChange={(patch) => dispatch({ type: "loan", patch })}
          />
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
              <Verdict ref={verdictRef} a={shown} hasChanges={hasChanges} stale={stale} />
              {!shown.paidOff && (
                <>
                  <SummaryCards
                    a={shown}
                    hasChanges={hasChanges}
                    payoffIso={payoffIso}
                    nominalRatePct={scenario.loan.annualRatePct}
                    stale={stale}
                  />
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
                        <TabsContent value="table" className="pt-2">
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

      {shown && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 sm:hidden">
          <MobileVerdictBar a={shown} hasChanges={hasChanges} targetRef={verdictRef} />
        </div>
      )}
    </>
  )
}
