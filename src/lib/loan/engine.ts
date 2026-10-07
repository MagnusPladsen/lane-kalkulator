import type {
  CustomPeriod,
  AfterInterestOnly,
  Analysis,
  ExtraPayment,
  InterestOnlyPeriod,
  LoanType,
  RatePeriod,
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

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0")
}

/** Adds whole months to an ISO date, clamping the day to the target month's length. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const nd = Math.min(d, daysInMonth(ny, nm))
  return `${pad(ny, 4)}-${pad(nm)}-${pad(nd)}`
}

/** True for a real calendar date in ISO form within 1900–2100. */
export function isValidIsoDate(iso: unknown): iso is string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { y, m, d } = parseIso(iso)
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return false
  return d >= 1 && d <= daysInMonth(y, m)
}

/** Whole months from start to today. 0 when start is missing or in the future. */
export function monthsElapsed(start: string | undefined, today: string): number {
  if (!start) return 0
  const s = parseIso(start)
  const t = parseIso(today)
  let n = (t.y - s.y) * 12 + (t.m - s.m)
  // Compare against the real due date so month-end clamping agrees with addMonths.
  if (n > 0 && addMonths(start, n) > today) n -= 1
  return Math.max(0, n)
}

/** True for "YYYY-MM" with a year in 1900–2100. */
export function isValidYearMonth(ym: unknown): ym is string {
  if (typeof ym !== "string" || !/^\d{4}-\d{2}$/.test(ym)) return false
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12
}

function ymIndex(ym: string): number {
  return Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1
}

/** "YYYY-MM" of an ISO date. */
export function yearMonthOf(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * Where a calendar period falls in the forward plan, where month 1 is the next payment.
 * Payment m is due in the calendar month of addMonths(anchor, offset + m).
 * Returns undefined when the period is already over. A period that started in the
 * past counts from the next payment.
 */
export function periodToMonths(
  p: Pick<CustomPeriod, "from" | "to">,
  anchor: string,
  offset: number,
): { fromMonth: number; months: number } | undefined {
  if (!isValidYearMonth(p.from) || !isValidYearMonth(p.to)) return undefined
  const base = ymIndex(yearMonthOf(anchor)) + offset
  const first = Math.max(1, ymIndex(p.from) - base)
  const last = Math.min(MAX_MONTHS, ymIndex(p.to) - base)
  if (last < first) return undefined
  return { fromMonth: first, months: last - first + 1 }
}

/** Splits the user's calendar periods into the engine's interest-only and rate lists. */
export function periodsToSchedule(
  periods: CustomPeriod[],
  anchor: string,
  offset: number,
): { interestOnly: InterestOnlyPeriod[]; ratePeriods: RatePeriod[] } {
  const interestOnly: InterestOnlyPeriod[] = []
  const ratePeriods: RatePeriod[] = []
  for (const p of periods) {
    const span = periodToMonths(p, anchor, offset)
    if (!span) continue
    if (p.kind === "interest-only") interestOnly.push({ id: p.id, ...span })
    else ratePeriods.push({ id: p.id, ...span, annualRatePct: p.annualRatePct })
  }
  return { interestOnly, ratePeriods }
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
  ratePeriods?: RatePeriod[]
  afterInterestOnly: AfterInterestOnly
}

/** Later periods win when they overlap. */
function rateForMonth(periods: RatePeriod[], month: number, baseMonthlyRate: number): number {
  let rate = baseMonthlyRate
  for (const p of periods) {
    if (month >= p.fromMonth && month < p.fromMonth + p.months) rate = p.annualRatePct / 100 / 12
  }
  return rate
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
    const from = Math.max(1, Math.floor(p.fromMonth))
    const end = Math.min(MAX_MONTHS, from + Math.floor(p.months) - 1)
    for (let i = from; i <= end; i++) s.add(i)
  }
  return s
}

export function buildSchedule(o: BuildScheduleOptions): ScheduleResult {
  const rows: ScheduleRow[] = []
  const io = interestOnlySet(o.interestOnly)
  const ratePeriods = o.ratePeriods ?? []
  let r = rateForMonth(ratePeriods, 1, o.monthlyRate)
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

    // A rate change re-prices the annuity over the months left, as a bank would.
    const monthRate = rateForMonth(ratePeriods, month, o.monthlyRate)
    if (monthRate !== r) {
      r = monthRate
      if (o.loanType === "annuity" && remaining >= 1) basePayment = annuityPayment(balance, r, remaining)
    }

    // After a pause under keep-term, recompute so the original end date holds.
    // If the pause already ran past the end date there is nothing to hold; fall
    // back to the old payment rather than demanding everything in one month.
    if (prevWasIo && !isIo && o.afterInterestOnly === "keep-term" && remaining >= 1) {
      if (o.loanType === "annuity") basePayment = annuityPayment(balance, r, remaining)
      else serialPrincipal = balance / remaining
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
      ratePct: r * 12 * 100,
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
    truncated: balance > EPSILON,
  }
}

export function analyze(scenario: Scenario, today: string = todayIso()): Analysis {
  const { loan } = scenario
  const monthlyRate = loan.annualRatePct / 100 / 12
  const termMonths = Math.max(1, Math.round(loan.termMonths))

  const offsetMonths = Math.min(monthsElapsed(loan.startDate, today), termMonths)

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

  // A remaining balance only means something relative to a start date; 0 means paid off.
  const startingBalance =
    loan.startDate && loan.remainingBalance !== undefined && Number.isFinite(loan.remainingBalance)
      ? Math.max(0, loan.remainingBalance)
      : computedBalance
  const paidOff = startingBalance <= EPSILON
  // If the term is over but something is still owed, give it one month (a settlement).
  const remainingMonths = paidOff ? 0 : Math.max(1, termMonths - offsetMonths)

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
    ...periodsToSchedule(scenario.periods, loan.startDate ?? today, offsetMonths),
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
    paidOff,
    baseline,
    scenario: result,
    delta: {
      months: result.months - baseline.months,
      interest: result.totalInterest - baseline.totalInterest,
      totalCost: result.totalPaid - baseline.totalPaid,
    },
  }
}

export interface TargetSolution {
  /** Extra amount needed, rounded up to whole 10 kr. 0 when already on track. */
  amount: number
  /** Months to payoff with the extra applied. */
  months: number
  /** Interest saved versus the current scenario. */
  interestSaved: number
}

/**
 * How much extra (monthly from next month, or a one-off next month) on top of the
 * current scenario gets the loan paid off within `targetMonths` from now.
 * Payoff months fall monotonically with the extra amount, so a binary search suffices.
 */
export function solveForTarget(
  scenario: Scenario,
  today: string,
  targetMonths: number,
  kind: ExtraPayment["kind"],
): TargetSolution | undefined {
  const current = analyze(scenario, today)
  if (current.paidOff) return undefined
  const target = Math.max(1, Math.floor(targetMonths))
  if (current.scenario.months <= target) {
    return { amount: 0, months: current.scenario.months, interestSaved: 0 }
  }

  const run = (amount: number) =>
    analyze(
      { ...scenario, extras: [...scenario.extras, { id: "__goal", kind, amount, fromMonth: 1 }] },
      today,
    ).scenario

  const step = 10
  let lo = 0
  let hi = Math.ceil(current.startingBalance / step) // in units of 10 kr; paying it all off always works
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (run(mid * step).months <= target) hi = mid
    else lo = mid + 1
  }
  const amount = lo * step
  const result = run(amount)
  return {
    amount,
    months: result.months,
    interestSaved: current.scenario.totalInterest - result.totalInterest,
  }
}
