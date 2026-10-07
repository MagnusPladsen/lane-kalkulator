import type {
  AfterInterestOnly,
  Analysis,
  ExtraPayment,
  InterestOnlyPeriod,
  LoanType,
  Scenario,
  ScheduleResult,
  ScheduleRow,
} from "./types"

const MAX_MONTHS = 1200
const EPSILON = 0.005

/** Standard annuity payment. Zero rate degrades to straight division. */
export function annuityPayment(balance: number, monthlyRate: number, months: number): number {
  if (months <= 0) return balance
  if (monthlyRate === 0) return balance / months
  const f = Math.pow(1 + monthlyRate, -months)
  return (balance * monthlyRate) / (1 - f)
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number)
  return { y, m, d }
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Adds whole months to an ISO date, clamping the day to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const nd = Math.min(d, daysInMonth(ny, nm))
  return `${ny}-${pad(nm)}-${pad(nd)}`
}

/** Whole months from start to today. 0 when start is missing or in the future. */
export function monthsElapsed(start: string | undefined, today: string): number {
  if (!start) return 0
  const s = parseIso(start)
  const t = parseIso(today)
  let n = (t.y - s.y) * 12 + (t.m - s.m)
  if (t.d < s.d) n -= 1
  return Math.max(0, n)
}

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export interface BuildScheduleOptions {
  balance: number
  monthlyRate: number
  months: number
  loanType: LoanType
  fee: number
  extras: ExtraPayment[]
  interestOnly: InterestOnlyPeriod[]
  afterInterestOnly: AfterInterestOnly
}

function extraForMonth(extras: ExtraPayment[], month: number): number {
  let sum = 0
  for (const e of extras) {
    if (!(e.amount > 0)) continue
    if (e.kind === "oneoff") {
      if (e.fromMonth === month) sum += e.amount
    } else if (month >= e.fromMonth && (e.toMonth === undefined || month <= e.toMonth)) {
      sum += e.amount
    }
  }
  return sum
}

function interestOnlySet(periods: InterestOnlyPeriod[]): Set<number> {
  const s = new Set<number>()
  for (const p of periods) {
    for (let i = 0; i < p.months; i++) s.add(p.fromMonth + i)
  }
  return s
}

export function buildSchedule(o: BuildScheduleOptions): ScheduleResult {
  const rows: ScheduleRow[] = []
  const io = interestOnlySet(o.interestOnly)
  const r = o.monthlyRate
  let balance = o.balance
  let remaining = Math.max(1, Math.round(o.months))
  let basePayment = o.loanType === "annuity" ? annuityPayment(balance, r, remaining) : 0
  let serialPrincipal = o.loanType === "serial" ? balance / remaining : 0
  let cumInterest = 0
  let cumPaid = 0
  let monthlyPayment: number | undefined
  let maxMonthlyPayment = 0
  let prevWasIo = false

  for (let month = 1; balance > EPSILON && month <= MAX_MONTHS; month++) {
    const isIo = io.has(month)

    if (prevWasIo && !isIo && o.afterInterestOnly === "keep-term") {
      const left = Math.max(1, remaining)
      if (o.loanType === "annuity") basePayment = annuityPayment(balance, r, left)
      else serialPrincipal = balance / left
    }

    const interest = balance * r
    let principal = 0
    if (!isIo) {
      principal =
        o.loanType === "annuity" ? Math.max(0, basePayment - interest) : serialPrincipal
      principal = Math.min(principal, balance)
    }
    const extra = Math.min(extraForMonth(o.extras, month), Math.max(0, balance - principal))
    const fee = o.fee
    const payment = interest + principal + extra + fee

    balance = balance - principal - extra
    if (balance < EPSILON) balance = 0
    cumInterest += interest
    cumPaid += payment

    rows.push({
      month,
      interest,
      principal,
      extra,
      fee,
      payment,
      balance,
      cumInterest,
      cumPaid,
      interestOnly: isIo,
    })

    if (!isIo) {
      const basePay = interest + principal + fee
      if (monthlyPayment === undefined) monthlyPayment = basePay
      if (basePay > maxMonthlyPayment) maxMonthlyPayment = basePay
    }

    remaining -= 1
    prevWasIo = isIo
  }

  const totalFees = rows.length * o.fee
  return {
    rows,
    totalInterest: cumInterest,
    totalFees,
    totalPaid: cumPaid,
    months: rows.length,
    monthlyPayment: monthlyPayment ?? (rows[0]?.payment ?? 0),
    maxMonthlyPayment,
  }
}

export function analyze(scenario: Scenario, today: string = todayIso()): Analysis {
  const { loan } = scenario
  const monthlyRate = loan.annualRatePct / 100 / 12
  const termMonths = Math.max(1, Math.round(loan.termMonths))

  const offsetMonths = Math.min(monthsElapsed(loan.startDate, today), termMonths - 1)

  let pastRows: ScheduleRow[] = []
  let computedBalance = loan.principal
  if (loan.startDate) {
    const original = buildSchedule({
      balance: loan.principal,
      monthlyRate,
      months: termMonths,
      loanType: loan.loanType,
      fee: loan.monthlyFee,
      extras: [],
      interestOnly: [],
      afterInterestOnly: "keep-term",
    })
    pastRows = original.rows.slice(0, offsetMonths)
    if (pastRows.length) computedBalance = pastRows[pastRows.length - 1].balance
  }

  const startingBalance =
    loan.remainingBalance !== undefined && loan.remainingBalance > 0
      ? loan.remainingBalance
      : computedBalance
  const remainingMonths = Math.max(1, termMonths - offsetMonths)

  const common = {
    balance: startingBalance,
    monthlyRate,
    months: remainingMonths,
    loanType: loan.loanType,
    fee: loan.monthlyFee,
  }
  const baseline = buildSchedule({
    ...common,
    extras: [],
    interestOnly: [],
    afterInterestOnly: "keep-term",
  })
  const result = buildSchedule({
    ...common,
    extras: scenario.extras,
    interestOnly: scenario.interestOnly,
    afterInterestOnly: scenario.afterInterestOnly,
  })

  if (loan.startDate) {
    baseline.payoffDate = addMonths(loan.startDate, offsetMonths + baseline.months)
    result.payoffDate = addMonths(loan.startDate, offsetMonths + result.months)
  }

  return {
    offsetMonths,
    startingBalance,
    pastRows,
    baseline,
    scenario: result,
    delta: {
      months: result.months - baseline.months,
      interest: result.totalInterest - baseline.totalInterest,
      totalCost: result.totalPaid - baseline.totalPaid,
    },
  }
}
