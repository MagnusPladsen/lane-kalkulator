import { useMemo, useState } from "react"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtMoney, fmtMonthYear } from "@/lib/format"
import type { DateForIndex } from "@/lib/chartData"
import type { ScheduleRow } from "@/lib/loan/types"

interface YearGroup {
  year: string
  rows: { row: ScheduleRow; date: string }[]
  interest: number
  principal: number
  extra: number
  fee: number
  payment: number
  endBalance: number
  ioMonths: number
}

export function ScheduleTable({
  rows,
  offset,
  dateFor,
  hasExtra,
}: {
  rows: ScheduleRow[]
  offset: number
  dateFor: DateForIndex
  hasExtra: boolean
}) {
  const groups = useMemo(() => {
    const map = new Map<string, YearGroup>()
    rows.forEach((row, idx) => {
      const date = dateFor(offset + idx + 1)
      const year = date.slice(0, 4)
      let g = map.get(year)
      if (!g) {
        g = { year, rows: [], interest: 0, principal: 0, extra: 0, fee: 0, payment: 0, endBalance: 0, ioMonths: 0 }
        map.set(year, g)
      }
      g.rows.push({ row, date })
      g.interest += row.interest
      g.principal += row.principal
      g.extra += row.extra
      g.fee += row.fee
      g.payment += row.payment
      g.endBalance = row.balance
      if (row.interestOnly) g.ioMonths += 1
    })
    return [...map.values()]
  }, [rows, offset, dateFor])

  const [open, setOpen] = useState<Set<string>>(() => new Set(groups[0] ? [groups[0].year] : []))
  const toggle = (y: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(y)) next.delete(y)
      else next.add(y)
      return next
    })

  const cols = hasExtra ? 6 : 5

  return (
    <div className="overflow-x-auto">
      <Table className="tnum font-mono text-xs">
        <TableHeader>
          <TableRow className="font-sans">
            <TableHead className="w-36">Period</TableHead>
            <TableHead className="text-right">Payment</TableHead>
            <TableHead className="text-right">Interest</TableHead>
            <TableHead className="text-right">Principal</TableHead>
            {hasExtra && <TableHead className="text-right">Extra</TableHead>}
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((g) => {
            const isOpen = open.has(g.year)
            return (
              <YearRows key={g.year} g={g} isOpen={isOpen} toggle={() => toggle(g.year)} hasExtra={hasExtra} cols={cols} />
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function YearRows({
  g,
  isOpen,
  toggle,
  hasExtra,
}: {
  g: YearGroup
  isOpen: boolean
  toggle: () => void
  hasExtra: boolean
  cols: number
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/40 font-medium select-none hover:bg-muted/70"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <TableCell className="font-sans">
          <span className="inline-flex items-center gap-1.5">
            <ChevronRightIcon className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
            {g.year}
            {g.ioMonths > 0 && (
              <Badge variant="outline" className="ml-1 font-sans text-[10px]">
                {g.ioMonths} mo interest-only
              </Badge>
            )}
          </span>
        </TableCell>
        <TableCell className="text-right">{fmtMoney(g.payment)}</TableCell>
        <TableCell className="text-right">{fmtMoney(g.interest)}</TableCell>
        <TableCell className="text-right">{fmtMoney(g.principal)}</TableCell>
        {hasExtra && <TableCell className="text-right">{fmtMoney(g.extra)}</TableCell>}
        <TableCell className="text-right">{fmtMoney(g.endBalance)}</TableCell>
      </TableRow>
      {isOpen &&
        g.rows.map(({ row, date }) => (
          <TableRow key={row.month} className={cn(row.interestOnly && "text-muted-foreground")}>
            <TableCell className="pl-8 font-sans text-muted-foreground">
              {fmtMonthYear(date)}
              {row.interestOnly && <span className="ml-1.5 text-[10px] uppercase">interest only</span>}
            </TableCell>
            <TableCell className="text-right">{fmtMoney(row.payment)}</TableCell>
            <TableCell className="text-right">{fmtMoney(row.interest)}</TableCell>
            <TableCell className="text-right">{fmtMoney(row.principal)}</TableCell>
            {hasExtra && <TableCell className={cn("text-right", row.extra > 0 && "text-good")}>{row.extra ? fmtMoney(row.extra) : "–"}</TableCell>}
            <TableCell className="text-right">{fmtMoney(row.balance)}</TableCell>
          </TableRow>
        ))}
    </>
  )
}
