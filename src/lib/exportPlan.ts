import type { ScheduleRow } from "./loan/types"

/** Column headings, already translated. */
export interface PlanCsvLabels {
  month: string
  payment: string
  interest: string
  principal: string
  extra: string
  fee: string
  balance: string
  rate: string
}

// Norwegian Excel reads ";" between columns and "," as the decimal mark; plain digits, no spaces.
const n = (v: number) => v.toFixed(2).replace(".", ",")

/**
 * The repayment plan month by month as CSV that opens straight in Norwegian Excel and
 * Numbers. Starts with a byte-order mark so "æøå" in the headings survive.
 */
export function planCsv(rows: ScheduleRow[], monthOf: (i: number) => string, labels: PlanCsvLabels): string {
  const head = [labels.month, labels.payment, labels.interest, labels.principal, labels.extra, labels.fee, labels.balance, labels.rate]
  const lines = rows.map((r, i) =>
    [monthOf(i), n(r.payment), n(r.interest), n(r.principal), n(r.extra), n(r.fee), n(r.balance), n(r.ratePct)].join(";"),
  )
  return "﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n"
}
