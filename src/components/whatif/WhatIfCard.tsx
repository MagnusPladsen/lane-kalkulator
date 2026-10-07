import { useTranslation } from "react-i18next"
import { CalendarCheckIcon, CalendarRangeIcon, PiggyBankIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SectionTitle } from "@/components/fields"
import type { Action } from "@/lib/scenarioReducer"
import type { Analysis, Scenario } from "@/lib/loan/types"
import { ExtrasTool } from "./ExtrasTool"
import { GoalTool } from "./GoalTool"
import { PeriodsTool } from "./PeriodsTool"
import type { MonthDate } from "./month"
import { uid } from "@/lib/ids"
import { yearMonthOf } from "@/lib/loan/engine"

export type Tool = "extras" | "goal" | "periods"

export function WhatIfCard({
  scenario,
  analysis,
  today,
  monthDate,
  maxMonth,
  tool,
  onToolChange,
  dispatch,
}: {
  scenario: Scenario
  analysis?: Analysis
  today: string
  monthDate: MonthDate
  maxMonth: number
  tool: Tool
  onToolChange: (t: Tool) => void
  dispatch: (a: Action) => void
}) {
  const { t } = useTranslation()
  const counts: Record<Tool, number> = {
    extras: scenario.extras.length,
    goal: 0,
    periods: scenario.periods.length,
  }
  const tools: { id: Tool; label: string; icon: typeof PiggyBankIcon }[] = [
    { id: "extras", label: t("whatif.extras"), icon: PiggyBankIcon },
    { id: "goal", label: t("whatif.goal"), icon: CalendarCheckIcon },
    { id: "periods", label: t("whatif.periods"), icon: CalendarRangeIcon },
  ]
  const anchor = scenario.loan.startDate ?? today
  const offset = analysis?.offsetMonths ?? 0
  const minYear = Number(today.slice(0, 4))
  const maxYear = Math.min(2100, Number(monthDate(maxMonth).slice(0, 4)))

  return (
    <Card className="rise rise-2">
      <CardHeader>
        <SectionTitle>{t("whatif.title")}</SectionTitle>
        <p className="text-sm text-muted-foreground">{t("whatif.desc")}</p>
      </CardHeader>
      <CardContent>
        <Tabs value={tool} onValueChange={(v) => onToolChange(v as Tool)}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1">
            {tools.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="h-auto min-h-12 min-w-0 flex-col justify-center gap-1 px-1 py-2 text-xs sm:text-sm"
              >
                <span className="relative">
                  <Icon className="size-4" />
                  {counts[id] > 0 && (
                    <span
                      aria-label={t("whatif.active", { count: counts[id] })}
                      className={cn(
                        "absolute -top-1.5 -right-2.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground",
                      )}
                    >
                      {counts[id]}
                    </span>
                  )}
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="extras" className="pt-4">
            <ExtrasTool
              extras={scenario.extras}
              monthDate={monthDate}
              maxMonth={maxMonth}
              onAdd={(kind) => dispatch({ type: "extra/add", kind })}
              onUpdate={(id, patch) => dispatch({ type: "extra/update", id, patch })}
              onRemove={(id) => dispatch({ type: "extra/remove", id })}
            />
          </TabsContent>
          <TabsContent value="goal" className="pt-4">
            {analysis && !analysis.paidOff ? (
              <GoalTool
                scenario={scenario}
                analysis={analysis}
                today={today}
                monthDate={monthDate}
                onApply={(amount) => dispatch({ type: "extra/addAmount", amount })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {analysis?.paidOff ? t("verdict.paidOffBody") : t("invalid.hint")}
              </p>
            )}
          </TabsContent>
          <TabsContent value="periods" className="pt-4">
            <PeriodsTool
              periods={scenario.periods}
              after={scenario.afterInterestOnly}
              anchor={anchor}
              offset={offset}
              minYear={minYear}
              maxYear={maxYear}
              onAdd={() =>
                dispatch({
                  type: "period/add",
                  period: {
                    id: uid(),
                    kind: "interest-only",
                    from: yearMonthOf(monthDate(1)),
                    to: yearMonthOf(monthDate(6)),
                    annualRatePct: 0,
                  },
                })
              }
              onUpdate={(id, patch) => dispatch({ type: "period/update", id, patch })}
              onRemove={(id) => dispatch({ type: "period/remove", id })}
              onAfterChange={(value) => dispatch({ type: "afterIo", value })}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
