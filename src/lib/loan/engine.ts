import type {
  CalendarExtra,
  DayCount,
  CustomPeriod,
  AfterInterestOnly,
  LoanInput,
  Totals,
  Analysis,
  ExtraPayment,
  InterestOnlyPeriod,
  LoanType,
  RatePeriod,
  Scenario,
  ScheduleResult,
  ScheduleRow,
} from "./types.js"

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

function dayNumber(iso: string): number {
  const { y, m, d } = parseIso(iso)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

function daysInYear(y: number): number {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365
}

/** Share of a year from `from` to `to` (ISO dates) under a day count. */
export function yearFraction(from: string, to: string, dayCount: DayCount): number {
  const a = dayNumber(from)
  const b = dayNumber(to)
  if (dayCount === "30/360") {
    // 30/360 with month-end dates as day 30 (30E/360 ISDA). Schedules don't use this
    // branch: under 30/360 every payment period is exactly 1/12 of a year.
    const day30 = (p: { y: number; m: number; d: number }) => (p.d >= daysInMonth(p.y, p.m) ? 30 : Math.min(p.d, 30))
    const f = parseIso(from)
    const t = parseIso(to)
    return ((t.y - f.y) * 360 + (t.m - f.m) * 30 + (day30(t) - day30(f))) / 360
  }
  if (dayCount === "act/360") return (b - a) / 360
  // act/act: days in each calendar year over that year's length.
  let frac = 0
  let cur = a
  let y = parseIso(from).y
  while (cur < b) {
    const yearEnd = Date.UTC(y + 1, 0, 1) / 86_400_000
    const end = Math.min(b, yearEnd)
    frac += (end - cur) / daysInYear(y)
    cur = end
    y++
  }
  return frac
}

/**
 * Year fraction of each payment period for a loan anchored at `anchor` (payment k due
 * addMonths(anchor, k)), counted after `offset` payments. Undefined for 30/360.
 */
export function periodYearFractions(
  dayCount: DayCount | undefined,
  anchor: string,
  offset: number,
): ((month: number) => number) | undefined {
  if (!dayCount || dayCount === "30/360") return undefined
  const cache = new Map<number, number>()
  return (m) => {
    let f = cache.get(m)
    if (f === undefined) {
      f = yearFraction(addMonths(anchor, offset + m - 1), addMonths(anchor, offset + m), dayCount)
      cache.set(m, f)
    }
    return f
  }
}

/**
 * How much more interest a day count charges over a year than rate / 12 assumes,
 * on average. The payment is priced with it so the loan still ends on time.
 */
export function pricingFactor(dayCount: DayCount | undefined): number {
  return dayCount === "act/360" ? 365.25 / 360 : 1
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

/** Number of calendar months from `from` to `to`, both inclusive. */
export function monthSpan(from: string, to: string): number {
  return ymIndex(to) - ymIndex(from) + 1
}

/** Adds months to a "YYYY-MM". */
export function addYearMonths(ym: string, months: number): string {
  return yearMonthOf(addMonths(`${ym}-01`, months))
}

/** The calendar month of the next payment. */
export function nextPaymentMonth(anchor: string, offset: number): string {
  return yearMonthOf(addMonths(anchor, offset + 1))
}

/**
 * A calendar extra payment as forward-plan months. Undefined when it lies entirely
 * in the past. A recurring one that started earlier counts from the next payment.
 */
export function extraToSchedule(e: CalendarExtra, anchor: string, offset: number): ExtraPayment | undefined {
  if (!(e.amount > 0) || !isValidYearMonth(e.from)) return undefined
  const base = ymIndex(yearMonthOf(anchor)) + offset
  const first = ymIndex(e.from) - base
  if (e.kind === "oneoff") {
    if (first < 1 || first > MAX_MONTHS) return undefined
    return { id: e.id, kind: "oneoff", amount: e.amount, fromMonth: first }
  }
  const from = Math.max(1, first)
  const to = e.to !== undefined && isValidYearMonth(e.to) ? ymIndex(e.to) - base : undefined
  if (from > MAX_MONTHS || (to !== undefined && to < from)) return undefined
  return { id: e.id, kind: "recurring", amount: e.amount, fromMonth: from, toMonth: to }
}

export function extrasToSchedule(extras: CalendarExtra[], anchor: string, offset: number): ExtraPayment[] {
  const out: ExtraPayment[] = []
  for (const e of extras) {
    const x = extraToSchedule(e, anchor, offset)
    if (x) out.push(x)
  }
  return out
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
  /**
   * Share of a year that payment period `month` covers, for day-count interest.
   * Undefined means 30/360: every month is exactly 1/12.
   */
  yearFraction?: (month: number) => number
  /**
   * Scales the rate used to price the payment, so it fits the term under the day count:
   * 365.25/360 for act/360, otherwise 1.
   */
  pricingFactor?: number
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

/** Interest-only months, each mapped to what should happen after its period (undefined = scenario default). */
function interestOnlyMonths(periods: InterestOnlyPeriod[]): Map<number, AfterInterestOnly | undefined> {
  const m = new Map<number, AfterInterestOnly | undefined>()
  for (const p of periods) {
    const from = Math.max(1, Math.floor(p.fromMonth))
    const end = Math.min(MAX_MONTHS, from + Math.floor(p.months) - 1)
    for (let i = from; i <= end; i++) m.set(i, p.after)
  }
  return m
}

/**
 * Whole payments needed to clear `balance` at monthly rate `r` with a fixed annuity
 * `payment`. Undefined when the payment never covers the interest.
 */
function monthsToPayoff(balance: number, r: number, payment: number): number | undefined {
  if (balance <= EPSILON) return 0
  if (!(payment > 0)) return undefined
  if (r === 0) return Math.ceil(balance / payment - 1e-9)
  const x = 1 - (balance * r) / payment
  if (x <= 0) return undefined
  return Math.ceil(-Math.log(x) / Math.log(1 + r) - 1e-9)
}

/**
 * Month-by-month schedule.
 *
 * The plan has a current end month (`plannedEnd`). It starts at the agreed term,
 * moves earlier when extra payments shorten the loan, and moves later for each
 * interest-only month under keep-payment. Whenever the payment is re-priced (a rate
 * change, or the end of a pause under keep-term) it is spread over the months left
 * to that end, so earlier changes are never silently undone.
 */
export function buildSchedule(o: BuildScheduleOptions): ScheduleResult {
  const rows: ScheduleRow[] = []
  const io = interestOnlyMonths(o.interestOnly)
  const ratePeriods = o.ratePeriods ?? []
  const annuity = o.loanType === "annuity"
  const k = o.pricingFactor ?? 1
  let r = rateForMonth(ratePeriods, 1, o.monthlyRate)
  let balance = o.balance
  const term = Math.max(1, Math.round(o.months))
  let plannedEnd = term
  let basePayment = annuity ? annuityPayment(balance, r * k, term) : 0
  let serialPrincipal = annuity ? 0 : balance / term
  let cumInterest = 0
  let cumPaid = 0
  let prevWasIo = false
  /** The rate changed during a pause; re-price when the pause ends. */
  let repriceAfterPause = false

  const repriceOver = (months: number) => {
    if (annuity) basePayment = annuityPayment(balance, r * k, months)
    else serialPrincipal = balance / months
  }

  for (let month = 1; balance > EPSILON && month <= MAX_MONTHS; month++) {
    const isIo = io.has(month)
    const oldR = r
    r = rateForMonth(ratePeriods, month, o.monthlyRate)
    const rateChanged = r !== oldR
    const left = plannedEnd - month + 1

    if (prevWasIo && !isIo) {
      // A pause just ended.
      const after = io.get(month - 1) ?? o.afterInterestOnly
      if (after === "keep-term" || repriceAfterPause || rateChanged) {
        // If a keep-term pause ran past the end date there is nothing to hold;
        // keep the old payment rather than demand everything at once.
        if (left >= 1) repriceOver(left)
        else plannedEnd = month - 1 + (annuity ? (monthsToPayoff(balance, r * k, basePayment) ?? 1) : Math.ceil(balance / serialPrincipal))
      }
      repriceAfterPause = false
    } else if (rateChanged) {
      // A bank re-prices an annuity to keep the current end date. Serial principal is unaffected.
      if (isIo) repriceAfterPause = true
      else if (annuity) {
        const n = left >= 1 ? left : (monthsToPayoff(balance, oldR * k, basePayment) ?? 1)
        basePayment = annuityPayment(balance, r * k, Math.max(1, n))
      }
    }

    // The payment is priced on rate / 12 (× pricingFactor, so act/360 still ends on time);
    // the interest inside it follows the actual days in the period when a day count is set.
    const interest = o.yearFraction ? balance * r * 12 * o.yearFraction(month) : balance * r
    let principal = 0
    if (!isIo) {
      principal = annuity ? Math.max(0, basePayment - interest) : serialPrincipal
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

    // Move the planned end: a keep-payment pause adds a month, an extra payment shortens the plan.
    if (isIo && (io.get(month) ?? o.afterInterestOnly) === "keep-payment") plannedEnd += 1
    if (!isIo && extra > 0 && balance > EPSILON) {
      const n = annuity ? monthsToPayoff(balance, r * k, basePayment) : Math.ceil(balance / serialPrincipal - 1e-9)
      if (n !== undefined) plannedEnd = month + n
    }
    prevWasIo = isIo
  }

  return summarize(rows, balance > EPSILON)
}

/** Totals and headline payments for a list of rows. */
export function summarize(rows: ScheduleRow[], truncated: boolean): ScheduleResult {
  let totalInterest = 0
  let totalFees = 0
  let totalPaid = 0
  let monthlyPayment: number | undefined
  let maxMonthlyPayment = 0
  for (const r of rows) {
    totalInterest += r.interest
    totalFees += r.fee
    totalPaid += r.payment
    if (!r.interestOnly) {
      const basePay = r.interest + r.principal + r.fee
      if (monthlyPayment === undefined) monthlyPayment = basePay
      if (basePay > maxMonthlyPayment) maxMonthlyPayment = basePay
    }
  }
  return {
    rows,
    totalInterest,
    totalFees,
    totalPaid,
    months: rows.length,
    monthlyPayment: monthlyPayment ?? rows[0]?.payment ?? 0,
    maxMonthlyPayment,
    truncated,
  }
}

/** The part of a whole-life schedule after `offset` payments, renumbered from month 1. */
function tailOf(full: ScheduleResult, offset: number): ScheduleResult {
  const before = full.rows[offset - 1]
  const ci = before?.cumInterest ?? 0
  const cp = before?.cumPaid ?? 0
  const rows = full.rows
    .slice(offset)
    .map((r, i) => ({ ...r, month: i + 1, cumInterest: r.cumInterest - ci, cumPaid: r.cumPaid - cp }))
  return summarize(rows, full.truncated)
}

function totalsOf(rows: ScheduleRow[]): Totals {
  let interest = 0
  let fees = 0
  let paid = 0
  for (const r of rows) {
    interest += r.interest
    fees += r.fee
    paid += r.payment
  }
  return { interest, fees, paid }
}

function plus(...ts: Totals[]): Totals {
  return ts.reduce((a, b) => ({ interest: a.interest + b.interest, fees: a.fees + b.fees, paid: a.paid + b.paid }), {
    interest: 0,
    fees: 0,
    paid: 0,
  })
}

/**
 * The loan's own start terms (LoanInput.intro) as plan months from the first payment,
 * minus the `offset` payments already made. An intro interest-only period keeps the
 * end date afterwards, as banks do.
 */
function introSchedule(loan: LoanInput, offset: number): { interestOnly: InterestOnlyPeriod[]; ratePeriods: RatePeriod[] } {
  const intro = loan.intro
  const months = intro ? Math.min(MAX_MONTHS, Math.round(intro.months)) - offset : 0
  if (!intro || months < 1) return { interestOnly: [], ratePeriods: [] }
  return intro.kind === "interest-only"
    ? { interestOnly: [{ id: "__intro", fromMonth: 1, months, after: "keep-term" }], ratePeriods: [] }
    : { interestOnly: [], ratePeriods: [{ id: "__intro", fromMonth: 1, months, annualRatePct: intro.annualRatePct }] }
}

/** The loan as agreed, without any what-if changes. */
function loanTerms(loan: LoanInput, offset: number) {
  return { extras: [] as ExtraPayment[], ...introSchedule(loan, offset), afterInterestOnly: "keep-term" as const }
}

/**
 * Runs the loan with and without the user's changes.
 *
 * With a start date the whole loan is simulated from its first payment, so periods and
 * extra payments before today shape the history and today's balance. If the user typed
 * in today's remaining balance, that wins: both plans continue from it, and changes
 * before today only affect the history and the interest paid so far.
 */
export function analyze(scenario: Scenario, today: string = todayIso()): Analysis {
  const { loan } = scenario
  const monthlyRate = loan.annualRatePct / 100 / 12
  const termMonths = Math.max(1, Math.round(loan.termMonths))
  const offsetMonths = Math.min(monthsElapsed(loan.startDate, today), termMonths)
  const common = { monthlyRate, loanType: loan.loanType, fee: loan.monthlyFee }
  // The loan's intro terms first, so the user's own periods win where they overlap.
  const changesFrom = (anchor: string, offset: number) => {
    const intro = introSchedule(loan, offset)
    const user = periodsToSchedule(scenario.periods, anchor, offset)
    return {
      extras: extrasToSchedule(scenario.extras, anchor, offset),
      interestOnly: [...intro.interestOnly, ...user.interestOnly],
      ratePeriods: [...intro.ratePeriods, ...user.ratePeriods],
      afterInterestOnly: scenario.afterInterestOnly,
    }
  }

  let baseline: ScheduleResult
  let result: ScheduleResult
  let pastB: ScheduleRow[] = []
  let pastS: ScheduleRow[] = []
  let startB = loan.principal
  let startS = loan.principal
  let balancePinned = false

  if (!loan.startDate) {
    const forward = {
      ...common,
      balance: loan.principal,
      months: termMonths,
      yearFraction: periodYearFractions(loan.dayCount, today, 0),
      pricingFactor: pricingFactor(loan.dayCount),
    }
    baseline = buildSchedule({ ...forward, ...loanTerms(loan, 0) })
    result = buildSchedule({ ...forward, ...changesFrom(today, 0) })
  } else {
    const start = loan.startDate
    const life = {
      ...common,
      balance: loan.principal,
      months: termMonths,
      yearFraction: periodYearFractions(loan.dayCount, start, 0),
      pricingFactor: pricingFactor(loan.dayCount),
    }
    const fullB = buildSchedule({ ...life, ...loanTerms(loan, 0) })
    const fullS = buildSchedule({ ...life, ...changesFrom(start, 0) })
    pastB = fullB.rows.slice(0, offsetMonths)
    pastS = fullS.rows.slice(0, offsetMonths)
    balancePinned = loan.remainingBalance !== undefined && Number.isFinite(loan.remainingBalance)

    if (balancePinned) {
      startB = startS = Math.max(0, loan.remainingBalance!)
      // If the term is over but something is still owed, give it one month (a settlement).
      const months = startS <= EPSILON ? 0 : Math.max(1, termMonths - offsetMonths)
      const forward = {
        ...common,
        balance: startS,
        months,
        yearFraction: periodYearFractions(loan.dayCount, start, offsetMonths),
        pricingFactor: pricingFactor(loan.dayCount),
      }
      baseline = buildSchedule({ ...forward, ...loanTerms(loan, offsetMonths) })
      result = buildSchedule({ ...forward, ...changesFrom(start, offsetMonths) })
    } else {
      startB = offsetMonths === 0 ? loan.principal : (pastB.at(-1)?.balance ?? 0)
      startS = offsetMonths === 0 ? loan.principal : (pastS.at(-1)?.balance ?? 0)
      baseline = tailOf(fullB, offsetMonths)
      result = tailOf(fullS, offsetMonths)
    }
  }

  if (loan.startDate) {
    baseline.payoffDate = addMonths(loan.startDate, offsetMonths + baseline.months)
    result.payoffDate = addMonths(loan.startDate, offsetMonths + result.months)
  }

  const setupFee = Math.max(0, loan.setupFee ?? 0)
  const setup: Totals = { interest: 0, fees: setupFee, paid: setupFee }
  // With a typed-in balance, principal repaid so far is a fact (loan − balance); only the
  // interest and fees of the history are simulated. Otherwise lifetime principal could
  // add up to more than was borrowed.
  const pastTotals = (rows: ScheduleRow[]): Totals => {
    const t = totalsOf(rows)
    return balancePinned ? { ...t, paid: t.interest + t.fees + Math.max(0, loan.principal - startS) } : t
  }
  const past = { baseline: pastTotals(pastB), scenario: pastTotals(pastS) }
  const lifetime = {
    baseline: plus(setup, past.baseline, totalsOf(baseline.rows)),
    scenario: plus(setup, past.scenario, totalsOf(result.rows)),
  }

  return {
    offsetMonths,
    startingBalance: startS,
    baselineStartingBalance: startB,
    balancePinned,
    pastRows: pastS,
    baselinePastRows: pastB,
    paidOff: startS <= EPSILON,
    past,
    lifetime,
    baseline,
    scenario: result,
    delta: {
      months: result.months - baseline.months,
      interest: lifetime.scenario.interest - lifetime.baseline.interest,
      totalCost: lifetime.scenario.paid - lifetime.baseline.paid,
    },
  }
}

/**
 * Annual effective rate in percent for a loan paid out as `netAmount` today and repaid
 * with `payments[k]` at the end of month k+1: the monthly rate m that makes the payments'
 * present value equal the amount paid out, compounded to a year, (1 + m)^12 − 1.
 * This is the Norwegian/EU definition (finansavtaleloven), with time in twelfths of a year.
 */
export function effectiveRateOf(netAmount: number, payments: number[]): number | undefined {
  if (!(netAmount > 0) || payments.length === 0) return undefined
  const pv = (m: number) => {
    let sum = 0
    let discount = 1
    for (const p of payments) {
      discount /= 1 + m
      sum += p * discount
    }
    return sum - netAmount
  }
  let lo = -0.09
  let hi = 1
  if (pv(lo) < 0 || pv(hi) > 0) return undefined
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (pv(mid) > 0) lo = mid
    else hi = mid
  }
  return (Math.pow(1 + (lo + hi) / 2, 12) - 1) * 100
}

/**
 * The effective rate a bank quotes for this loan at signing: the plain plan with today's
 * nominal rate for the whole term, monthly fees, and the setup fee taken off the payout.
 */
export function planEffectiveRate(loan: LoanInput, today: string = todayIso()): number | undefined {
  const plan = buildSchedule({
    yearFraction: periodYearFractions(loan.dayCount, loan.startDate ?? today, 0),
    pricingFactor: pricingFactor(loan.dayCount),
    balance: loan.principal,
    monthlyRate: loan.annualRatePct / 100 / 12,
    months: Math.max(1, Math.round(loan.termMonths)),
    loanType: loan.loanType,
    fee: loan.monthlyFee,
    ...loanTerms(loan, 0),
  })
  return effectiveRateOf(loan.principal - Math.max(0, loan.setupFee ?? 0), plan.rows.map((r) => r.payment))
}

/**
 * The monthly fee, in whole kroner, that makes planEffectiveRate hit `targetPct`,
 * keeping everything else. Undefined when no fee between 0 and 10 000 kr gets there.
 */
export function solveMonthlyFee(loan: LoanInput, targetPct: number, today: string = todayIso()): number | undefined {
  const eff = (fee: number) => planEffectiveRate({ ...loan, monthlyFee: fee }, today)
  const at0 = eff(0)
  const atMax = eff(10_000)
  if (at0 === undefined || atMax === undefined) return undefined
  if (targetPct < at0 - 0.005 || targetPct > atMax) return undefined
  let lo = 0
  let hi = 10_000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if ((eff(mid) ?? Infinity) < targetPct) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
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

  const from = nextPaymentMonth(scenario.loan.startDate ?? today, current.offsetMonths)
  const run = (amount: number) =>
    analyze({ ...scenario, extras: [...scenario.extras, { id: "__goal", kind, amount, from }] }, today).scenario

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
