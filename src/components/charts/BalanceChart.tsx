import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { compactKr, yearTicks, type BalancePoint } from "@/lib/chartData"
import { ChartTip } from "./ChartTip"

export function BalanceChart({
  data,
  todayIndex,
  showScenario,
}: {
  data: BalancePoint[]
  todayIndex: number
  showScenario: boolean
}) {
  const { t } = useTranslation()
  const config = {
    history: { label: t("series.history"), color: "var(--chart-history)" },
    baseline: { label: t("series.baseline"), color: "var(--chart-baseline)" },
    scenario: { label: t("series.scenario"), color: "var(--chart-scenario)" },
  } satisfies ChartConfig
  const labels = { history: t("series.history"), baseline: t("series.baseline"), scenario: t("series.scenario") }
  const ticks = useMemo(() => yearTicks(data), [data])
  const byI = useMemo(() => new Map(data.map((d) => [d.i, d.date])), [data])

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full sm:h-[320px]">
      <LineChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="i"
          type="number"
          domain={[0, Math.max(1, data.length - 1)]}
          ticks={ticks}
          tickFormatter={(i: number) => byI.get(i)?.slice(0, 4) ?? ""}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickFormatter={compactKr} tickLine={false} axisLine={false} width={52} />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTip labels={labels} />} />
        {todayIndex > 0 && (
          <ReferenceLine
            x={todayIndex}
            stroke="var(--foreground)"
            strokeOpacity={0.5}
            strokeDasharray="3 3"
            label={{ value: t("charts.today"), position: "top", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        )}
        <Line dataKey="history" type="monotone" stroke="var(--color-history)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line
          dataKey="baseline"
          type="monotone"
          stroke="var(--color-baseline)"
          strokeWidth={2}
          strokeDasharray={showScenario ? "6 4" : undefined}
          dot={false}
          isAnimationActive={false}
        />
        {showScenario && (
          <Line dataKey="scenario" type="monotone" stroke="var(--color-scenario)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        )}
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
  )
}
