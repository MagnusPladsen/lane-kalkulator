import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { compactKr, yearTicks, type CumPoint } from "@/lib/chartData"
import { ChartTip } from "./ChartTip"

export function CumulativeChart({ data, showScenario }: { data: CumPoint[]; showScenario: boolean }) {
  const { t } = useTranslation()
  const config = {
    baseline: { label: t("series.baseline"), color: "var(--chart-baseline)" },
    scenario: { label: t("series.scenario"), color: "var(--chart-scenario)" },
  } satisfies ChartConfig
  const labels = { baseline: t("series.baseline"), scenario: t("series.scenario") }
  const ticks = useMemo(() => yearTicks(data), [data])
  const byI = useMemo(() => new Map(data.map((d) => [d.i, d.date])), [data])
  const first = data[0]?.i ?? 0
  const last = data[data.length - 1]?.i ?? 1
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full sm:h-[320px]">
      <AreaChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="i"
          type="number"
          domain={[first, Math.max(first + 1, last)]}
          ticks={ticks}
          tickFormatter={(i: number) => byI.get(i)?.slice(0, 4) ?? ""}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickFormatter={compactKr} tickLine={false} axisLine={false} width={52} />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTip labels={labels} />} />
        <Area
          dataKey="baseline"
          type="monotone"
          stroke="var(--color-baseline)"
          fill="var(--color-baseline)"
          fillOpacity={showScenario ? 0 : 0.1}
          strokeWidth={2}
          strokeDasharray={showScenario ? "6 4" : undefined}
          dot={false}
          isAnimationActive={false}
        />
        {showScenario && (
          <Area
            dataKey="scenario"
            type="monotone"
            stroke="var(--color-scenario)"
            fill="var(--color-scenario)"
            fillOpacity={0.12}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        )}
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}
