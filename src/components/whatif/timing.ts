import { nextPaymentMonth } from "@/lib/loan/engine"

export interface TimingContext {
  /** Loan start date, when known. */
  startDate?: string
  /** Start date, or today when unknown. */
  anchor: string
  /** Payments already made. */
  offset: number
  /** Today's balance was typed in, so history can't move it. */
  pinned: boolean
}

export type Timing = "ok" | "needsStart" | "outside" | "pinnedPast"

/**
 * How a dated item relates to the loan. `inLoan(anchor, offset)` is the item's own
 * conversion to plan months; it returns undefined when nothing of it falls in range.
 */
export function timingOf(
  from: string,
  inLoan: (anchor: string, offset: number) => unknown,
  ctx: TimingContext,
): Timing {
  const beforeToday = from < nextPaymentMonth(ctx.anchor, ctx.offset)
  if (!ctx.startDate) {
    if (beforeToday) return "needsStart"
    return inLoan(ctx.anchor, ctx.offset) ? "ok" : "outside"
  }
  if (!inLoan(ctx.startDate, 0)) return "outside"
  return ctx.pinned && beforeToday ? "pinnedPast" : "ok"
}
