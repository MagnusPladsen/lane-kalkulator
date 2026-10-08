import { addMonths, analyze, todayIso } from "../loan/engine"
import type { LoanInput, Scenario } from "../loan/types"
import type { ScannedLoan } from "./parseLoanText"

export type DerivedKey = "name" | "startDate" | "termMonths" | "remainingBalance" | "monthlyFee"

export interface ScanProposal {
  /** Fields to write into the loan form. */
  patch: Partial<LoanInput>
  /** Fields that were worked out rather than read directly, with how. */
  derived: Partial<Record<DerivedKey, string>>
}

const pad = (n: number) => String(n).padStart(2, "0")
const ymIndex = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1

/**
 * Turns what was read from screenshots into loan settings.
 *
 * - Payments fall on the bank's due day: the start date is moved to that day in the start
 *   month, so payment k lands on the due day k months later.
 * - The term runs from there to the end date.
 * - The monthly fee, when not shown, is the payment minus the annuity part the engine prices.
 */
export function scanToLoan(scan: ScannedLoan, today: string = todayIso()): ScanProposal {
  const patch: Partial<LoanInput> = {}
  const derived: ScanProposal["derived"] = {}

  if (scan.lender || scan.isStartLoan) {
    patch.name = [scan.isStartLoan ? "Startlån" : undefined, scan.lender?.value].filter(Boolean).join(" – ")
    derived.name = "lender"
  }
  const principal = scan.principal?.value ?? scan.currentBalance?.value
  if (principal !== undefined) patch.principal = Math.round(principal * 100) / 100
  if (scan.nominalRatePct) patch.annualRatePct = scan.nominalRatePct.value
  if (scan.effectiveRatePct) patch.effectiveRatePct = scan.effectiveRatePct.value
  if (scan.loanType) patch.loanType = scan.loanType.value

  if (scan.startDate) {
    const start = scan.startDate.value
    let anchor = start
    if (scan.dueDay) {
      const y = Number(start.slice(0, 4))
      const m = Number(start.slice(5, 7))
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
      anchor = `${y}-${pad(m)}-${pad(Math.min(scan.dueDay.value, last))}`
      if (anchor !== start) derived.startDate = "dueDay"
    }
    patch.startDate = anchor
    if (scan.endDate) {
      const months = ymIndex(scan.endDate.value) - ymIndex(anchor)
      if (months >= 1 && months <= 600) {
        patch.termMonths = months
        derived.termMonths = "endDate"
      }
    }
    if (scan.currentBalance && scan.principal && Math.abs(scan.currentBalance.value - scan.principal.value) >= 1) {
      patch.remainingBalance = scan.currentBalance.value
      derived.remainingBalance = "currentBalance"
    }
  } else if (scan.remainingMonths) {
    // No dates: treat the loan as starting now with what is left.
    patch.termMonths = scan.remainingMonths.value
    derived.termMonths = "remainingMonths"
    if (scan.currentBalance) patch.principal = scan.currentBalance.value
  }

  if (scan.fee) {
    patch.monthlyFee = Math.round(scan.fee.value)
  } else if (scan.termAmount && patch.principal && patch.annualRatePct !== undefined && patch.termMonths) {
    const fee = feeFromPayment(patch, scan.termAmount.value, today)
    if (fee !== undefined) {
      patch.monthlyFee = fee
      derived.monthlyFee = "termAmount"
    }
  }
  return { patch, derived }
}

/** Payment − (interest + principal) of the next payment, when that leaves a plausible fee. */
function feeFromPayment(loan: Partial<LoanInput>, termAmount: number, today: string): number | undefined {
  const s: Scenario = {
    id: "scan",
    savedAt: "",
    loan: {
      name: "",
      principal: loan.principal!,
      annualRatePct: loan.annualRatePct!,
      termMonths: loan.termMonths!,
      loanType: loan.loanType ?? "annuity",
      monthlyFee: 0,
      dayCount: "act/act",
      startDate: loan.startDate,
      remainingBalance: loan.remainingBalance,
    },
    extras: [],
    periods: [],
    afterInterestOnly: "keep-term",
  }
  const row = analyze(s, today).scenario.rows[0]
  if (!row) return undefined
  const fee = termAmount - (row.interest + row.principal)
  if (fee < -0.5 || fee > 500) return undefined
  return Math.max(0, Math.round(fee))
}

/** For display: the first payment date implied by a start date. */
export function firstPaymentDate(startDate: string): string {
  return addMonths(startDate, 1)
}
