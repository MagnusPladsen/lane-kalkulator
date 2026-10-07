# Lånekalkulator

A loan calculator that answers the questions most bank tools dodge:

- **What if I pay a bit extra?** Monthly or one-off. See how many years fall off and how much interest you skip.
- **What if I need a break, or get a better rate for a while?** Add a period with a start and end month: interest only when money is tight, or a different rate such as 0 % or a fixed-rate deal. See what it really costs or saves.
- **What does it take to be done by a given year?** The goal tool works out the extra payment needed.

Everything runs in the browser. Nothing is collected or sent anywhere. Saved loans live in `localStorage`; export them as JSON if you want a backup.

## Features

- Annuity and serial loans, monthly fee, optional start date and remaining balance so the chart shows where you are today.
- Verdict banner plus four stat tiles: monthly payment, payoff date, total interest, total cost, each with the delta against the current plan.
- Charts: balance over time (history, current plan, with changes), yearly breakdown (interest / principal / extra), cumulative interest.
- "What if" tools: extra payments, a payoff goal, and custom periods (interest only, or another rate) with calendar start and end months.
- Full schedule table grouped by year, with interest-only months and months at another rate marked.
- My loans page: save, open, duplicate, delete, delete all, export/import JSON.
- Share link: the whole scenario encoded in the URL hash.
- Light and dark theme. Norwegian, English and Polish.

## Stack

Vite, React 19, TypeScript, Tailwind v4, shadcn/ui (Base UI), Recharts, Vitest. Package manager: bun.

```sh
bun install
bun run dev        # http://localhost:5173
bun run build
bunx vitest run    # engine tests
bun run lint
```

## Layout

| Path | What |
|---|---|
| `src/lib/loan/engine.ts` | Pure amortization engine (`annuityPayment`, `buildSchedule`, `analyze`). Unit-tested. |
| `src/lib/loan/types.ts` | Domain types: `LoanInput`, `ExtraPayment`, `InterestOnlyPeriod`, `Scenario`, `Analysis`. |
| `src/lib/scenarioReducer.ts` | Draft state reducer and input validation. |
| `src/lib/storage.ts` | localStorage persistence (draft, saved loans, theme). |
| `src/lib/share.ts` | Share-link encoding and JSON export/import. |
| `src/lib/chartData.ts` | Turns an `Analysis` into chart series. |
| `src/pages/` | `CalculatorPage`, `LoansPage`. |
| `src/components/` | Form panels, verdict, stat tiles, charts, schedule table, dialogs. |
| `docs/superpowers/specs/` | Design spec. |

## How the numbers are calculated

- **Interest** follows the loan's day count (rentedager), set under "Renteberegning": *365/365* actual days over 365 (366 in leap years, periods split at New Year), the usual one for floating-rate loans and the default; *365/360* actual days over 360, slightly dearer; or *360/360* where every month is exactly 1/12. The payment amount is priced on the nominal rate / 12 (for 365/360 scaled by 365.25/360 so the loan still ends on time); only the interest share inside each payment varies with the days, and the final payment absorbs the difference. Older saves without a setting use 365/365.
- **Annuity** payments use the standard formula. Whenever the payment is re-priced (a rate change, or the end of an interest-only pause that keeps the end date) it is spread over the months left to the plan's *current* end date. That end moves earlier when extra payments shorten the loan and later for each pause month that keeps the payment. **Serial** loans repay a fixed principal; rate changes only change the interest.
- **Monthly fee** (termingebyr) is added to every payment, pauses included. The **setup fee** (etableringsgebyr) counts once, at the start.
- **Extra payments** go straight to principal and keep the regular payment, so the loan ends sooner.
- **Start terms** on the loan itself (for example the first 3 years interest-only or at 0 %) are part of the loan, so they are in both the plan and the comparison. An interest-only start keeps the end date afterwards.
- **Dates.** Payment *k* is due *k* months after the start date. Extra payments and custom periods are stored as calendar months (`YYYY-MM`). With a start date the whole loan is simulated from the first payment, so items before today shape the history and today's balance. If you type in today's remaining balance, that balance wins: both plans continue from it, and items before today only change the history and the interest paid so far. Older saves with "month N from today" are converted on load.
- **Totals** cover the whole loan: history, the rest of the plan and the setup fee.
- **Effective rate** follows the Norwegian/EU definition: the monthly rate *m* where all payments (fees included), discounted at *m*, equal the amount paid out (loan minus setup fee); annual rate = (1 + *m*)¹² − 1. It assumes today's nominal rate for the whole term, after any start terms. Enter the bank's effective rate to check your fees; the app can solve for the monthly fee that matches it.
- The engine is checked against closed-form formulas in the tests and was cross-checked against an independent Python implementation over 18 000+ random loans.
- Estimates only. Banks round, accrue daily and change rates. Treat the numbers as a close approximation, not a quote.
