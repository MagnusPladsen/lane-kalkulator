import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtMoney, fmtMonthYear, fmtRate } from "@/lib/format"
import type { DateForIndex } from "@/lib/chartData"
import type { ScheduleRow } from "@/lib/loan/types"

interface YearGroup {
  year: string
  rows: { row: ScheduleRow; date: string }[]
  interest: number
  principal: number
  extra: number
  payment: number
  endBalance: number
  ioMonths: number
  rateMonths: number
}

const stickyCell = "sticky left-0 z-10"

export function ScheduleTable({
  rows,
  offset,
  dateFor,
  hasExtra,
  baseRatePct,
  open,
  onOpenChange,
}: {
  rows: ScheduleRow[]
  offset: number
  dateFor: DateForIndex
  hasExtra: boolean
  /** The loan's normal rate; months at another rate are tagged. */
  baseRatePct: number
  /** Expanded years, owned by the parent so they survive tab switches. */
  open: Set<string>
  onOpenChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation()
  const groups = useMemo(() => {
    const map = new Map<string, YearGroup>()
    rows.forEach((row, idx) => {
      const date = dateFor(offset + idx + 1)
      const year = date.slice(0, 4)
      let g = map.get(year)
      if (!g) {
        g = { year, rows: [], interest: 0, principal: 0, extra: 0, payment: 0, endBalance: 0, ioMonths: 0, rateMonths: 0 }
        map.set(year, g)
      }
      g.rows.push({ row, date })
      g.interest += row.interest
      g.principal += row.principal
      g.extra += row.extra
      g.payment += row.payment
      g.endBalance = row.balance
      if (row.interestOnly) g.ioMonths += 1
      if (Math.abs(row.ratePct - baseRatePct) > 1e-9) g.rateMonths += 1
    })
    return [...map.values()]
  }, [rows, offset, dateFor, baseRatePct])

  const toggle = (y: string) => {
    const next = new Set(open)
    if (next.has(y)) next.delete(y)
    else next.add(y)
    onOpenChange(next)
  }

  return (
    <Table
      className="font-mono text-xs tabular-nums"
      containerProps={{
        tabIndex: 0,
        role: "region",
        "aria-label": t("table.region"),
        className: "rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
      }}
    >
      <TableHeader>
        <TableRow className="font-sans">
          <TableHead scope="col" className={cn(stickyCell, "w-36 bg-card")}>
            {t("table.period")}
          </TableHead>
          <TableHead scope="col" className="text-right">{t("table.payment")}</TableHead>
          <TableHead scope="col" className="text-right">{t("table.interest")}</TableHead>
          <TableHead scope="col" className="text-right">{t("table.principal")}</TableHead>
          {hasExtra && <TableHead scope="col" className="text-right">{t("table.extra")}</TableHead>}
          <TableHead scope="col" className="text-right">{t("table.balance")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => {
          const isOpen = open.has(g.year)
          return (
            <YearRows
              key={g.year}
              g={g}
              isOpen={isOpen}
              toggle={() => toggle(g.year)}
              hasExtra={hasExtra}
              baseRatePct={baseRatePct}
            />
          )
        })}
      </TableBody>
    </Table>
  )
}

function YearRows({
  g,
  isOpen,
  toggle,
  hasExtra,
  baseRatePct,
}: {
  g: YearGroup
  isOpen: boolean
  toggle: () => void
  hasExtra: boolean
  baseRatePct: number
}) {
  const { t } = useTranslation()
  return (
    <>
      {/* Row click is a mouse convenience; the button in the first cell is the real control. */}
      <TableRow className="cursor-pointer bg-muted font-medium hover:bg-muted" onClick={toggle}>
        <TableHead scope="row" className={cn(stickyCell, "bg-muted p-0 font-sans")}>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={t("table.toggle", { year: g.year })}
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
            className="flex min-h-10 w-full cursor-pointer items-center gap-1.5 px-2 text-left font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChevronRightIcon className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-90")} aria-hidden />
            {g.year}
            {g.ioMonths > 0 && (
              <Badge variant="outline" className="ml-1 font-sans text-[10px]">
                {t("table.interestOnlyMonths", { count: g.ioMonths })}
              </Badge>
            )}
            {g.rateMonths > 0 && (
              <Badge variant="outline" className="ml-1 font-sans text-[10px]">
                {t("tiles.ratePeriods", { count: g.rateMonths })}
              </Badge>
            )}
          </button>
        </TableHead>
        <TableCell className="text-right">{fmtMoney(g.payment)}</TableCell>
        <TableCell className="text-right">{fmtMoney(g.interest)}</TableCell>
        <TableCell className="text-right">{fmtMoney(g.principal)}</TableCell>
        {hasExtra && <TableCell className="text-right">{g.extra ? fmtMoney(g.extra) : "–"}</TableCell>}
        <TableCell className="text-right">{fmtMoney(g.endBalance)}</TableCell>
      </TableRow>
      {isOpen &&
        g.rows.map(({ row, date }) => (
          <TableRow key={row.month} className={cn(row.interestOnly && "text-muted-foreground")}>
            <TableHead scope="row" className={cn(stickyCell, "bg-card pl-8 font-sans font-normal text-muted-foreground")}>
              {fmtMonthYear(date)}
              {row.interestOnly && <span className="ml-1.5 text-[10px] uppercase">{t("table.interestOnly")}</span>}
              {Math.abs(row.ratePct - baseRatePct) > 1e-9 && (
                <span className="ml-1.5 text-[10px]">{fmtRate(row.ratePct)} %</span>
              )}
            </TableHead>
            <TableCell className="text-right">{fmtMoney(row.payment)}</TableCell>
            <TableCell className="text-right">{fmtMoney(row.interest)}</TableCell>
            <TableCell className="text-right">{fmtMoney(row.principal)}</TableCell>
            {hasExtra && (
              <TableCell className={cn("text-right", row.extra > 0 && "text-good")}>
                {row.extra ? fmtMoney(row.extra) : "–"}
              </TableCell>
            )}
            <TableCell className="text-right">{fmtMoney(row.balance)}</TableCell>
          </TableRow>
        ))}
    </>
  )
}
