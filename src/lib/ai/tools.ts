import { evaluateOffer, refinance } from "../compare.js"
import { addYearMonths, analyze, isValidYearMonth, monthSpan, nextPaymentMonth, planEffectiveRate, solveForTarget, solveMonthlyFee } from "../loan/engine.js"
import type { Analysis, CalendarExtra, CustomPeriod, LoanCategory, LoanInput, LoanType, Scenario } from "../loan/types.js"
import { fetchMortgageRate, tableRate } from "../rates.js"
import type { Suggestion } from "./types.js"

/** Everything a tool may look at: the user's loan and today's date. */
export interface ToolContext {
  scenario: Scenario
  today: string
}

export interface ToolResult {
  /** JSON-serialisable result for the model. */
  output: unknown
  /** A change to offer the user, if the tool proposed one. */
  suggestion?: Suggestion
}

const NUM = { type: ["number", "null"] }
const MONTH = { type: ["string", "null"], description: "Calendar month YYYY-MM, or null for the next payment." }
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

/** Tool definitions for the Responses API. Static: part of the cached prompt prefix. */
export const TOOL_DEFS = [
  {
    type: "function" as const,
    name: "get_loan_overview",
    description: "The user's loan as it stands now: payment, balance today, payoff month, lifetime interest and cost, effective rate check. Call this first when you need any number about the loan.",
    parameters: obj({}),
    strict: true,
  },
  {
    type: "function" as const,
    name: "simulate",
    description: "What happens to the loan with extra payments, a different rate, or interest-only months, on top of the user's current plan. Leave a field null to not use it. Returns before/after and the difference.",
    parameters: obj({
      extra_monthly: { ...NUM, description: "Extra kroner every month." },
      extra_monthly_from: MONTH,
      extra_monthly_to: { type: ["string", "null"], description: "Last month YYYY-MM, or null for until paid off." },
      one_off: { ...NUM, description: "A single extra payment in kroner." },
      one_off_month: MONTH,
      new_rate_pct: { ...NUM, description: "Nominal annual rate in percent for a period, e.g. 6.5." },
      rate_from: MONTH,
      rate_to: { type: ["string", "null"], description: "Last month YYYY-MM, or null for the rest of the loan." },
      interest_only_from: MONTH,
      interest_only_to: { type: ["string", "null"], description: "Last interest-only month YYYY-MM." },
      loan_type: { type: ["string", "null"], enum: ["annuity", "serial", null], description: "Try the loan as annuity or serial instead." },
    }),
    strict: true,
  },
  {
    type: "function" as const,
    name: "solve_payoff_by",
    description: "How much extra the user must pay to be debt-free by a given month: either every month from the next payment, or as one lump sum now.",
    parameters: obj({
      target_month: { type: "string", description: "Payoff month YYYY-MM." },
      kind: { type: "string", enum: ["monthly", "oneoff"] },
    }),
    strict: true,
  },
  {
    type: "function" as const,
    name: "check_refinance",
    description: "Whether moving the current loan to another bank pays off: new payment, total saving, and the month the switching cost is earned back.",
    parameters: obj({
      new_rate_pct: { type: "number" },
      new_monthly_fee: { ...NUM, description: "Null keeps today's fee." },
      switch_cost: { ...NUM, description: "Setup fee + registration (tinglysing) etc. in kroner. Null means 2500." },
      new_term_months: { ...NUM, description: "Null keeps the remaining term." },
    }),
    strict: true,
  },
  {
    type: "function" as const,
    name: "compare_offers",
    description: "Compare two loan offers by real total cost: payment, interest, fees, effective rate.",
    parameters: obj({
      offers: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: obj({
          name: { type: "string" },
          principal: { type: "number" },
          rate_pct: { type: "number" },
          term_months: { type: "number" },
          loan_type: { type: "string", enum: ["annuity", "serial"] },
          monthly_fee: { type: "number" },
          setup_fee: { type: "number" },
        }),
      },
    }),
    strict: true,
  },
  {
    type: "function" as const,
    name: "explain_effective_rate",
    description: "Compares the effective rate implied by the user's inputs with the one their bank states, and finds the monthly fee that would close the gap.",
    parameters: obj({}),
    strict: true,
  },
  {
    type: "function" as const,
    name: "typical_rate",
    description: "Today's typical rate for a kind of loan in Norway, from official or curated sources (SSB for mortgages).",
    parameters: obj({ category: { type: "string", enum: ["mortgage", "startlan", "car", "consumer", "student"] } }),
    strict: true,
  },
  {
    type: "function" as const,
    name: "propose_change",
    description: "Offer the user a change they can apply to the calculator with one click. Use after you have checked the effect with a tool. kind: extra_monthly / extra_oneoff need amount and from (to optional); rate_period needs rate_pct, from, to; interest_only_period needs from and to; loan_fields needs loan.",
    parameters: obj({
      kind: { type: "string", enum: ["extra_monthly", "extra_oneoff", "rate_period", "interest_only_period", "loan_fields"] },
      label: { type: "string", description: "Short button text in the user's language, e.g. \"Betal 2 340 kr ekstra fra nov. 2026\"." },
      amount: NUM,
      from: { type: ["string", "null"] },
      to: { type: ["string", "null"] },
      rate_pct: NUM,
      loan: {
        anyOf: [
          { type: "null" },
          obj({
            principal: NUM,
            annual_rate_pct: NUM,
            term_months: NUM,
            loan_type: { type: ["string", "null"], enum: ["annuity", "serial", null] },
            monthly_fee: NUM,
            setup_fee: NUM,
            effective_rate_pct: NUM,
            start_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
            remaining_balance: NUM,
          }),
        ],
      },
    }),
    strict: true,
  },
]

type Args = Record<string, unknown>
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined
const month = (v: unknown): string | undefined => (isValidYearMonth(v) ? v : undefined)
const round = (n: number) => Math.round(n)

/** Key facts of a run. `next` is the calendar month of the first forward payment. */
function overview(a: Analysis, s: Scenario, next: string) {
  const r = a.scenario.rows[0]
  const turn = a.scenario.rows.findIndex((x) => !x.interestOnly && x.principal > x.interest)
  return {
    principal_exceeds_interest_from: turn < 0 ? null : turn === 0 ? "already" : addYearMonths(next, turn),
    monthly_payment: r ? round(r.interest + r.principal + r.fee) : 0,
    next_payment_split: r ? { interest: round(r.interest), principal: round(r.principal), fee: round(r.fee) } : null,
    balance_today: round(a.startingBalance),
    months_left: a.scenario.months,
    payoff_month: a.scenario.payoffDate?.slice(0, 7) ?? null,
    lifetime_interest: round(a.lifetime.scenario.interest),
    lifetime_cost: round(a.lifetime.scenario.paid),
    interest_paid_so_far: round(a.past.scenario.interest),
    nominal_rate_pct: s.loan.annualRatePct,
    loan_type: s.loan.loanType,
    monthly_fee: s.loan.monthlyFee,
    category: s.loan.category ?? null,
  }
}

function anchorOf(ctx: ToolContext, a: Analysis) {
  return nextPaymentMonth(ctx.scenario.loan.startDate ?? ctx.today, a.offsetMonths)
}

/** Runs one tool. Never throws: errors come back as { error } for the model to explain. */
export async function runTool(name: string, rawArgs: string, ctx: ToolContext): Promise<ToolResult> {
  let args: Args
  try {
    args = JSON.parse(rawArgs || "{}") as Args
  } catch {
    return { output: { error: "Arguments were not valid JSON." } }
  }
  try {
    const base = analyze(ctx.scenario, ctx.today)
    const next = anchorOf(ctx, base)
    switch (name) {
      case "get_loan_overview":
        return { output: { ...overview(base, ctx.scenario, next), today: ctx.today, next_payment_month: next } }

      case "simulate": {
        const extras: CalendarExtra[] = [...ctx.scenario.extras]
        const periods: CustomPeriod[] = [...ctx.scenario.periods]
        const em = num(args.extra_monthly, 1, 10_000_000)
        if (em) extras.push({ id: "sim-m", kind: "recurring", amount: em, from: month(args.extra_monthly_from) ?? next, to: month(args.extra_monthly_to) })
        const oo = num(args.one_off, 1, 1_000_000_000)
        if (oo) extras.push({ id: "sim-o", kind: "oneoff", amount: oo, from: month(args.one_off_month) ?? next })
        const nr = num(args.new_rate_pct, 0, 30)
        if (nr !== undefined) {
          const from = month(args.rate_from) ?? next
          periods.push({ id: "sim-r", kind: "rate", from, to: month(args.rate_to) ?? addYearMonths(from, 600), annualRatePct: nr })
        }
        const ioFrom = month(args.interest_only_from)
        const ioTo = month(args.interest_only_to)
        if (ioFrom && ioTo) periods.push({ id: "sim-i", kind: "interest-only", from: ioFrom, to: ioTo, annualRatePct: 0 })
        const loanType: LoanType | undefined = args.loan_type === "serial" ? "serial" : args.loan_type === "annuity" ? "annuity" : undefined
        const simLoan = loanType ? { ...ctx.scenario.loan, loanType } : ctx.scenario.loan
        const after = analyze({ ...ctx.scenario, loan: simLoan, extras, periods }, ctx.today)
        return {
          output: {
            before: overview(base, ctx.scenario, next),
            after: overview(after, { ...ctx.scenario, loan: simLoan }, next),
            interest_change: round(after.lifetime.scenario.interest - base.lifetime.scenario.interest),
            cost_change: round(after.lifetime.scenario.paid - base.lifetime.scenario.paid),
            months_change: after.scenario.months - base.scenario.months,
          },
        }
      }

      case "solve_payoff_by": {
        const target = month(args.target_month)
        if (!target) return { output: { error: "target_month must be YYYY-MM." } }
        if (target < next) return { output: { error: `The next payment is ${next}; pick a later month.` } }
        const kind = args.kind === "oneoff" ? "oneoff" : "recurring"
        const sol = solveForTarget(ctx.scenario, ctx.today, monthSpan(next, target), kind)
        if (!sol) return { output: { error: "The loan is already paid off." } }
        return {
          output: {
            extra_needed: sol.amount,
            kind: kind === "oneoff" ? "one lump sum now" : `every month from ${next}`,
            payoff_month: addYearMonths(next, sol.months - 1),
            already_on_track: sol.amount === 0,
            interest_saved: round(sol.interestSaved),
          },
        }
      }

      case "check_refinance": {
        const rate = num(args.new_rate_pct, 0, 30)
        if (rate === undefined) return { output: { error: "new_rate_pct must be 0–30." } }
        const loan = ctx.scenario.loan
        const r = refinance(
          {
            balance: base.startingBalance,
            remainingMonths: base.baseline.months,
            current: { annualRatePct: loan.annualRatePct, monthlyFee: loan.monthlyFee, loanType: loan.loanType, dayCount: loan.dayCount },
            next: {
              annualRatePct: rate,
              monthlyFee: num(args.new_monthly_fee, 0, 1000) ?? loan.monthlyFee,
              loanType: loan.loanType,
              termMonths: Math.round(num(args.new_term_months, 1, 600) ?? base.baseline.months),
              dayCount: loan.dayCount,
            },
            switchCost: num(args.switch_cost, 0, 100_000) ?? 2_500,
          },
          ctx.today,
        )
        return {
          output: {
            payment_now: round(r.currentPayment),
            payment_new: round(r.newPayment),
            monthly_saving: round(r.monthlySaving),
            total_saving: round(r.totalSaving),
            break_even_month_number: r.breakEvenMonth ?? null,
            new_effective_rate_pct: r.newEffectiveRatePct === undefined ? null : Math.round(r.newEffectiveRatePct * 100) / 100,
          },
        }
      }

      case "compare_offers": {
        const offers = Array.isArray(args.offers) ? (args.offers as Args[]).slice(0, 2) : []
        if (offers.length < 2) return { output: { error: "Give exactly two offers." } }
        const results = offers.map((o) => {
          const r = evaluateOffer(
            {
              name: String(o.name ?? ""),
              principal: num(o.principal, 1, 1e9) ?? 0,
              annualRatePct: num(o.rate_pct, 0, 30) ?? 0,
              termMonths: Math.round(num(o.term_months, 1, 600) ?? 12),
              loanType: (o.loan_type === "serial" ? "serial" : "annuity") as LoanType,
              monthlyFee: num(o.monthly_fee, 0, 1000) ?? 0,
              setupFee: num(o.setup_fee, 0, 100_000) ?? 0,
            },
            ctx.today,
          )
          return {
            name: String(o.name ?? ""),
            first_payment: round(r.firstPayment),
            total_interest: round(r.totalInterest),
            total_fees: round(r.totalFees),
            total_cost: round(r.totalCost),
            effective_rate_pct: r.effectiveRatePct === undefined ? null : Math.round(r.effectiveRatePct * 100) / 100,
          }
        })
        return { output: { offers: results } }
      }

      case "explain_effective_rate": {
        const loan = ctx.scenario.loan
        const computed = planEffectiveRate(loan, ctx.today)
        const bank = loan.effectiveRatePct ?? null
        const fee = bank !== null && computed !== undefined && bank > computed ? solveMonthlyFee(loan, bank, ctx.today) : undefined
        return {
          output: {
            computed_effective_rate_pct: computed === undefined ? null : Math.round(computed * 100) / 100,
            bank_effective_rate_pct: bank,
            monthly_fee_now: loan.monthlyFee,
            setup_fee_now: loan.setupFee ?? 0,
            monthly_fee_that_matches_bank: fee ?? null,
            fee_is_plausible: fee === undefined ? null : fee <= 200,
            note: "Effective rate = nominal rate with monthly compounding plus all fees. A big gap usually means a missing fee, a different amount/term, or special start terms.",
          },
        }
      }

      case "typical_rate": {
        const category = String(args.category) as LoanCategory
        const rate = category === "mortgage" ? await fetchMortgageRate() : tableRate(category as Exclude<LoanCategory, "mortgage">, ctx.today)
        if (!rate) return { output: { error: "No typical rate available right now." } }
        return { output: { rate_pct: rate.ratePct, range_pct: rate.range ?? null, range_kind: rate.rangeKind ?? null, source: rate.source, as_of: rate.asOf } }
      }

      case "propose_change": {
        const s = toSuggestion(args, next)
        return s ? { output: { ok: true, shown_to_user: s.label }, suggestion: s } : { output: { error: "That change is incomplete or out of range; fix the fields and try again." } }
      }
    }
    return { output: { error: `Unknown tool ${name}.` } }
  } catch (e) {
    return { output: { error: e instanceof Error ? e.message : "Tool failed." } }
  }
}

/** Validates a proposed change. Anything out of range is refused rather than clamped silently. */
export function toSuggestion(args: Args, nextMonth: string): Suggestion | undefined {
  const label = typeof args.label === "string" && args.label.trim() ? args.label.trim().slice(0, 80) : undefined
  if (!label) return undefined
  const from = month(args.from) ?? nextMonth
  const to = month(args.to)
  switch (args.kind) {
    case "extra_monthly": {
      const amount = num(args.amount, 1, 10_000_000)
      return amount ? { kind: "extra", label, extra: { kind: "recurring", amount: round(amount), from, to: to && to >= from ? to : undefined } } : undefined
    }
    case "extra_oneoff": {
      const amount = num(args.amount, 1, 1_000_000_000)
      return amount ? { kind: "extra", label, extra: { kind: "oneoff", amount: round(amount), from } } : undefined
    }
    case "rate_period": {
      const rate = num(args.rate_pct, 0, 30)
      return rate !== undefined ? { kind: "period", label, period: { kind: "rate", from, to: to && to >= from ? to : addYearMonths(from, 600), annualRatePct: rate } } : undefined
    }
    case "interest_only_period":
      return to && to >= from ? { kind: "period", label, period: { kind: "interest-only", from, to, annualRatePct: 0 } } : undefined
    case "loan_fields": {
      const l = (args.loan ?? null) as Args | null
      if (!l) return undefined
      const patch: Partial<LoanInput> = {}
      const p = num(l.principal, 1, 1e9)
      if (p) patch.principal = p
      const r = num(l.annual_rate_pct, 0, 30)
      if (r !== undefined) patch.annualRatePct = r
      const tm = num(l.term_months, 1, 600)
      if (tm) patch.termMonths = Math.round(tm)
      if (l.loan_type === "annuity" || l.loan_type === "serial") patch.loanType = l.loan_type
      const f = num(l.monthly_fee, 0, 1000)
      if (f !== undefined) patch.monthlyFee = round(f)
      const sf = num(l.setup_fee, 0, 100_000)
      if (sf !== undefined) patch.setupFee = round(sf)
      const e = num(l.effective_rate_pct, 0, 30)
      if (e !== undefined) patch.effectiveRatePct = e
      if (typeof l.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.start_date)) patch.startDate = l.start_date
      const rb = num(l.remaining_balance, 0, 1e9)
      if (rb !== undefined) patch.remainingBalance = rb
      return Object.keys(patch).length ? { kind: "loan", label, patch } : undefined
    }
  }
  return undefined
}
