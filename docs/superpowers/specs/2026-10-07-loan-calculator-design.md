# Loan Calculator — Design Spec (2026-10-07)

## Purpose

A single-page React app where a person enters a loan (principal, interest, term, optional
start date and remaining balance), then plays with two kinds of changes and sees the effect:

1. **Extra payments** (recurring monthly and/or one-off) → how much interest is saved and how
   many months/years earlier the loan is paid off.
2. **Interest-only periods** ("avdragsfrihet") when money is tight → how much more the loan
   costs and how much longer it takes.

Success: a non-finance person can enter their mortgage in under a minute, add "500 kr extra
per month", and immediately see "paid off 3 yrs 2 mo earlier, 184 000 kr less interest" with a
graph that makes the difference obvious.

## Non-goals (YAGNI)

- No backend, no auth, no sync. Local storage only.
- Monthly payment frequency only.
- Single currency (NOK, formatted `nb-NO`). UI text in English.
- No variable-rate schedules (one rate for the whole loan).

## Stack

- Vite + React 19 + TypeScript, bun as package manager.
- Tailwind v4 + shadcn/ui (new-york style). Charts via shadcn `Chart` (Recharts).
- Vitest for the calculation engine. No UI tests beyond type-check and build.

## Domain model (`src/lib/loan/types.ts`)

```ts
type LoanType = "annuity" | "serial";

interface LoanInput {
  name: string;
  principal: number;          // original loan amount
  annualRatePct: number;      // nominal annual interest, e.g. 5.4
  termMonths: number;         // original term
  loanType: LoanType;
  monthlyFee: number;         // termingebyr, default 0
  startDate?: string;         // ISO yyyy-mm-dd, optional
  remainingBalance?: number;  // optional: balance today (only meaningful with startDate)
}

interface ExtraPayment {
  id: string;
  kind: "recurring" | "oneoff";
  amount: number;
  fromMonth: number;          // 1-based, months from "now"
  toMonth?: number;           // recurring only; undefined = until paid off
}

interface InterestOnlyPeriod {
  id: string;
  fromMonth: number;          // 1-based, months from "now"
  months: number;
}

type AfterInterestOnly = "keep-term" | "keep-payment";
// keep-term:    after the period, recompute payment so the original end date holds (payment rises)
// keep-payment: keep the old payment, loan runs longer

interface Scenario {
  id: string;
  savedAt: string;
  loan: LoanInput;
  extras: ExtraPayment[];
  interestOnly: InterestOnlyPeriod[];
  afterInterestOnly: AfterInterestOnly;
}
```

## Engine (`src/lib/loan/engine.ts`, pure functions, fully unit-tested)

- `monthsElapsed(startDate, today)` → 0 if no start date or start in future, else whole months.
- `annuityPayment(balance, monthlyRate, months)` — standard formula; rate 0 → balance/months.
- `buildSchedule({ balance, monthlyRate, months, loanType, fee, extras, interestOnly, afterInterestOnly })`
  → `ScheduleRow[]` with `{ month, interest, principal, extra, fee, payment, balance, cumInterest, cumPaid }`.
  - Annuity: fixed payment = annuityPayment(balance, rate, months). Serial: principal/months each month + interest.
  - Extra payment goes straight to principal; payment stays fixed; loan ends when balance hits 0.
  - Interest-only month: principal = 0, payment = interest + fee. Extras still apply if defined.
  - After an interest-only period: `keep-term` recomputes the base payment from remaining balance and
    remaining months; `keep-payment` keeps it.
  - Guard: max 1200 rows; stops when balance ≤ 0.005.
- `analyze(scenario, today)` → `{ offsetMonths, pastRows, baseline: Result, scenario: Result, delta }`
  - `offsetMonths = monthsElapsed(startDate)`; forward balance = `remainingBalance ?? originalSchedule[offset].balance`;
    remaining months = `termMonths - offsetMonths`.
  - `pastRows` = original schedule rows `[0, offset)` (only when a start date is set), for the muted "history" line.
  - `baseline` = forward schedule with no extras / no interest-only.
  - `scenario` = forward schedule with the user's modifications.
  - `Result = { rows, totalInterest, totalFees, totalPaid, months, payoffDate?, monthlyPayment }`.
  - `delta = { months, interest, totalCost }` (scenario − baseline; negative = saved).

## UI (`src/`)

Layout: header with app name + saved-scenarios menu; two-column on desktop (inputs left ~380px,
results right), stacked on mobile.

- **LoanForm** — name, principal, rate, term (years + months), type toggle, fee, start date (optional),
  remaining balance (optional, enabled only when start date set).
- **ExtraPaymentsPanel** — list of recurring/one-off extras; add/remove; month pickers show the
  equivalent date when start date is known.
- **InterestOnlyPanel** — list of periods + "afterwards" radio (keep end date / keep payment).
- **SummaryCards** — monthly payment, payoff (date + months), total interest, total cost; each shows
  baseline vs scenario and a coloured delta ("3 yrs 2 mo earlier", "−184 000 kr").
- **Charts** (tabs):
  1. Balance over time — history (muted), baseline, scenario; vertical "today" marker; x-axis in dates
     when start date is set, else "Month N".
  2. Yearly breakdown — stacked bars: interest / principal / extra per year (scenario).
  3. Cumulative interest — baseline vs scenario.
- **ScheduleTable** — grouped by year, expandable to months; marks interest-only months and extras.
- **Saved scenarios** — `localStorage` key `lane-kalkulator:scenarios` (array of Scenario),
  plus `lane-kalkulator:draft` autosaved on every change. Save / load / rename / delete / duplicate.

State: one `useReducer` in `App` holding the draft `Scenario`; `useMemo(analyze)`; a `useSavedScenarios`
hook wrapping localStorage with versioned JSON (`{ v: 1, items }`).

## Error handling

- Inputs validated with simple clamps (principal > 0, rate ≥ 0, term 1–480 months). Invalid → results area
  shows a hint instead of charts.
- Interest-only periods beyond payoff or overlapping extras are allowed; engine just ignores months after payoff.
- localStorage unavailable / corrupt → app works with in-memory state and shows a small warning.

## Testing

- `engine.test.ts`: annuity payment formula vs known values; serial schedule; extra recurring shortens term and
  reduces interest; one-off extra; interest-only extends under keep-payment and raises payment under keep-term;
  rate 0; remaining balance override; payoff date from start date.
- `bun run build` + `tsc --noEmit` clean.
