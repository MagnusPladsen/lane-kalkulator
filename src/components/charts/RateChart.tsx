import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { fmtMonthYear, fmtRate } from "@/lib/format"
import type { RateHistory, SeriesKey } from "@/lib/rateHistory"
import { SERIES_COLOR } from "@/lib/rateColors"

/** Monthly average rates on new mortgages, one line per selected series. */
export function RateChart({ history, shown, months }: { history: RateHistory; shown: SeriesKey[]; months: number }) {
  const { t } = useTranslation()
  const config = Object.fromEntries(shown.map((k) => [k, { label: t(`ratesPage.series.${k}`), color: SERIES_COLOR[k] }])) satisfies ChartConfig
  const data = useMemo(() => {
    const from = Math.max(0, history.months.length - months)
    return history.months.slice(from).map((m, i) => {
      const row: Record<string, string | number | null> = { month: m }
      for (const k of shown) row[k] = history.series[k][from + i]
      return row
    })
  }, [history, shown, months])
  const values = data.flatMap((d) => shown.map((k) => d[k])).filter((v): v is number => typeof v === "number")
  const lo = Math.floor(Math.min(...values) - 0.25)
  const hi = Math.ceil(Math.max(...values) + 0.25)
  const yearTicks = data.filter((d) => String(d.month).endsWith("-01")).map((d) => d.month as string)

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full sm:h-[320px]">
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="month"
          ticks={yearTicks}
          tickFormatter={(m: string) => m.slice(0, 4)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={20}
        />
        <YAxis
          domain={[Math.max(0, lo), hi]}
          ticks={Array.from({ length: hi - Math.max(0, lo) + 1 }, (_, i) => Math.max(0, lo) + i)}
          tickFormatter={(v: number) => `${fmtRate(v)} %`}
          tickLine={false}
          axisLine={false}
          width={56}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="grid gap-1 rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-medium">{fmtMonthYear(`${label}-15`)}</p>
                {payload.map((p) => (
                  <p key={String(p.dataKey)} className="flex items-center gap-2">
                    <span aria-hidden className="size-2.5 rounded-full" style={{ background: SERIES_COLOR[p.dataKey as SeriesKey] }} />
                    {t(`ratesPage.series.${String(p.dataKey)}`)}
                    <span className="ml-auto font-mono font-semibold tabular-nums">
                      {typeof p.value === "number" ? `${fmtRate(p.value)} %` : "–"}
                    </span>
                  </p>
                ))}
              </div>
            ) : null
          }
        />
        {shown.map((k) => (
          <Line
            key={k}
            dataKey={k}
            type="monotone"
            stroke={SERIES_COLOR[k]}
            strokeWidth={k === "floating" ? 2.5 : 2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </LineChart>
    </ChartContainer>
  )
}
