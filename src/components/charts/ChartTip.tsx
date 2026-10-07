import { fmtMoney, fmtMonthYear } from "@/lib/format"

export interface TipItem {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  payload?: { date?: string; year?: string }
}

export function ChartTip({
  active,
  payload,
  labels,
  title,
}: {
  active?: boolean
  payload?: readonly TipItem[]
  labels: Record<string, string>
  title?: (p: TipItem["payload"]) => string
}) {
  if (!active || !payload?.length) return null
  const first = payload[0]?.payload
  const heading = title ? title(first) : first?.date ? fmtMonthYear(first.date) : ""
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg ring-1 ring-foreground/5">
      {heading && <div className="font-medium">{heading}</div>}
      {payload
        .filter((p) => typeof p.value === "number")
        .map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: p.color }} />
            <span className="text-muted-foreground">{labels[String(p.dataKey)] ?? String(p.dataKey)}</span>
            <span className="ml-auto font-mono font-medium tabular-nums">{fmtMoney(p.value as number)}</span>
          </div>
        ))}
    </div>
  )
}
