import { useTranslation } from "react-i18next"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { compactKr, type YearPoint } from "@/lib/chartData"
import { ChartTip } from "./ChartTip"

export function YearlyChart({ data }: { data: YearPoint[] }) {
  const { t } = useTranslation()
  const hasExtra = data.some((d) => d.extra > 0)
  const hasFee = data.some((d) => d.fee > 0)
  const config = {
    interest: { label: t("series.interest"), color: "var(--chart-interest)" },
    principal: { label: t("series.principal"), color: "var(--chart-principal)" },
    extra: { label: t("series.extra"), color: "var(--chart-extra)" },
    fee: { label: t("series.fee"), color: "var(--chart-history)" },
  } satisfies ChartConfig
  const labels = {
    interest: t("series.interest"),
    principal: t("series.principal"),
    extra: t("series.extra"),
    fee: t("series.fee"),
  }
  // The topmost visible segment gets the rounded cap.
  const top = hasExtra ? "extra" : "principal"
  const bar = { stackId: "a", stroke: "var(--card)", strokeWidth: 1, isAnimationActive: false, maxBarSize: 28 }
  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full sm:h-[320px]">
      <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="year" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickFormatter={compactKr} tickLine={false} axisLine={false} width={52} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
          content={<ChartTip labels={labels} title={(p) => p?.year ?? ""} />}
        />
        {hasFee && <Bar dataKey="fee" fill="var(--color-fee)" {...bar} />}
        <Bar dataKey="interest" fill="var(--color-interest)" {...bar} />
        <Bar dataKey="principal" fill="var(--color-principal)" {...bar} radius={top === "principal" ? [4, 4, 0, 0] : 0} />
        {hasExtra && <Bar dataKey="extra" fill="var(--color-extra)" {...bar} radius={[4, 4, 0, 0]} />}
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}
