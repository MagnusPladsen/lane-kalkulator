import { useCallback, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoanForm } from "@/components/LoanForm"
import { ExtraPaymentsPanel } from "@/components/ExtraPaymentsPanel"
import { InterestOnlyPanel } from "@/components/InterestOnlyPanel"
import { Verdict } from "@/components/Verdict"
import { SummaryCards } from "@/components/SummaryCards"
import { BalanceChart } from "@/components/charts/BalanceChart"
import { CumulativeChart } from "@/components/charts/CumulativeChart"
import { YearlyChart } from "@/components/charts/YearlyChart"
import { ScheduleTable } from "@/components/ScheduleTable"
import { addMonths, analyze, todayIso } from "@/lib/loan/engine"
import { balanceSeries, cumulativeSeries, yearlySeries } from "@/lib/chartData"
import { validateLoan, type Action } from "@/lib/scenarioReducer"
import type { Scenario } from "@/lib/loan/types"

export function CalculatorPage({ scenario, dispatch }: { scenario: Scenario; dispatch: (a: Action) => void }) {
  const today = todayIso()
  const validation = useMemo(() => validateLoan(scenario.loan), [scenario.loan])
  const analysis = useMemo(() => (validation.ok ? analyze(scenario, today) : undefined), [scenario, validation.ok, today])

  const anchor = scenario.loan.startDate ?? today
  const offset = analysis?.offsetMonths ?? 0
  const dateFor = useCallback((i: number) => addMonths(anchor, i), [anchor])
  const monthDate = useCallback((m: number) => addMonths(anchor, offset + m), [anchor, offset])

  const hasChanges =
    scenario.extras.some((e) => e.amount > 0) || scenario.interestOnly.some((p) => p.months > 0)

  const balance = useMemo(
    () => (analysis ? balanceSeries(analysis, dateFor, scenario.loan.principal) : []),
    [analysis, dateFor, scenario.loan.principal],
  )
  const cumulative = useMemo(() => (analysis ? cumulativeSeries(analysis, dateFor) : []), [analysis, dateFor])
  const yearly = useMemo(
    () => (analysis ? yearlySeries(analysis.scenario.rows, analysis.offsetMonths, dateFor) : []),
    [analysis, dateFor],
  )
  const [tab, setTab] = useState("balance")

  const maxMonth = analysis ? Math.max(12, analysis.scenario.months + 24) : 480
  const payoffIso = analysis ? dateFor(analysis.offsetMonths + analysis.scenario.months) : today
  const hasExtra = analysis ? analysis.scenario.rows.some((r) => r.extra > 0) : false

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
      <aside className="grid gap-4">
        <LoanForm loan={scenario.loan} errors={validation.errors} onChange={(patch) => dispatch({ type: "loan", patch })} />
        <ExtraPaymentsPanel
          extras={scenario.extras}
          monthDate={monthDate}
          maxMonth={maxMonth}
          onAdd={(kind) => dispatch({ type: "extra/add", kind })}
          onUpdate={(id, patch) => dispatch({ type: "extra/update", id, patch })}
          onRemove={(id) => dispatch({ type: "extra/remove", id })}
        />
        <InterestOnlyPanel
          periods={scenario.interestOnly}
          after={scenario.afterInterestOnly}
          monthDate={monthDate}
          maxMonth={maxMonth}
          onAdd={() => dispatch({ type: "io/add" })}
          onUpdate={(id, patch) => dispatch({ type: "io/update", id, patch })}
          onRemove={(id) => dispatch({ type: "io/remove", id })}
          onAfterChange={(value) => dispatch({ type: "afterIo", value })}
        />
      </aside>

      <section className="grid gap-4">
        {!analysis ? (
          <Card className="rise">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Fill in the loan amount, rate and term to see the numbers.
            </CardContent>
          </Card>
        ) : (
          <>
            <Verdict a={analysis} hasChanges={hasChanges} />
            <SummaryCards a={analysis} hasChanges={hasChanges} payoffIso={payoffIso} />

            <Card className="rise rise-2">
              <CardContent>
                <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <TabsList>
                      <TabsTrigger value="balance">Balance</TabsTrigger>
                      <TabsTrigger value="yearly">Per year</TabsTrigger>
                      <TabsTrigger value="interest">Interest paid</TabsTrigger>
                      <TabsTrigger value="table">Schedule</TabsTrigger>
                    </TabsList>
                    <p className="text-xs text-muted-foreground">
                      {tab === "balance" && "What you still owe, month by month."}
                      {tab === "yearly" && "Where each year's payments go, with your changes."}
                      {tab === "interest" && "Interest and fees piling up over time."}
                      {tab === "table" && "Every payment, grouped by year. Click a year to expand."}
                    </p>
                  </div>
                  <TabsContent value="balance" className="pt-3">
                    <BalanceChart data={balance} todayIndex={analysis.offsetMonths} showScenario={hasChanges} />
                  </TabsContent>
                  <TabsContent value="yearly" className="pt-3">
                    <YearlyChart data={yearly} />
                  </TabsContent>
                  <TabsContent value="interest" className="pt-3">
                    <CumulativeChart data={cumulative} showScenario={hasChanges} />
                  </TabsContent>
                  <TabsContent value="table" className="pt-3">
                    <ScheduleTable rows={analysis.scenario.rows} offset={analysis.offsetMonths} dateFor={dateFor} hasExtra={hasExtra} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  )
}
