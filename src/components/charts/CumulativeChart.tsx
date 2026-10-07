import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { compactKr, yearTicks, type CumPoint } from "@/lib/chartData"
import { ChartTip } from "./ChartTip"

const config = {
  baseline: { label: "Current plan", color: "var(--chart-baseline)" },
  scenario: { label: "With changes", color: "var(--chart-scenario)" },
} satisfies ChartConfig

const labels = { baseline: "Current plan", scenario: "With changes" }

export function CumulativeChart({ data, showScenario }: { data: CumPoint[]; showScenario: boolean }) {
  const ticks = yearTicks(data)
  const byI = new Map(data.map((d) => [d.i, d.date]))
  const first = data[0]?.i ?? 0
  const last = data[data.length - 1]?.i ?? 0
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <AreaChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="i"
          type="number"
          domain={[first, last]}
          ticks={ticks}
          tickFormatter={(i: number) => byI.get(i)?.slice(0, 4) ?? ""}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis tickFormatter={compactKr} tickLine={false} axisLine={false} width={44} />
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
