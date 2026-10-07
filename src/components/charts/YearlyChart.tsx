import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { compactKr, type YearPoint } from "@/lib/chartData"
import { ChartTip } from "./ChartTip"

const config = {
  interest: { label: "Interest", color: "var(--chart-interest)" },
  principal: { label: "Principal", color: "var(--chart-principal)" },
  extra: { label: "Extra", color: "var(--chart-extra)" },
} satisfies ChartConfig

const labels = { interest: "Interest", principal: "Principal", extra: "Extra", fee: "Fees" }

export function YearlyChart({ data }: { data: YearPoint[] }) {
  const hasExtra = data.some((d) => d.extra > 0)
  return (
    <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
      <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickFormatter={compactKr} tickLine={false} axisLine={false} width={44} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={<ChartTip labels={labels} title={(p) => p?.year ?? ""} />}
        />
        <Bar dataKey="interest" stackId="a" fill="var(--color-interest)" stroke="var(--card)" strokeWidth={1} isAnimationActive={false} maxBarSize={28} />
        <Bar
          dataKey="principal"
          stackId="a"
          fill="var(--color-principal)"
          stroke="var(--card)"
          strokeWidth={1}
          isAnimationActive={false}
          maxBarSize={28}
          radius={hasExtra ? 0 : [4, 4, 0, 0]}
        />
        {hasExtra && (
          <Bar dataKey="extra" stackId="a" fill="var(--color-extra)" stroke="var(--card)" strokeWidth={1} isAnimationActive={false} maxBarSize={28} radius={[4, 4, 0, 0]} />
        )}
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}
