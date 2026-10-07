# Lånekalkulator

A loan calculator that answers two questions most bank tools dodge:

- **What if I pay a bit extra?** Monthly or one-off. See how many years fall off and how much interest you skip.
- **What if I can only pay interest for a while?** Pick the months. See what the pause really costs, and whether to keep the end date (payment rises) or keep the payment (loan runs longer).

Everything runs in the browser. Nothing is collected or sent anywhere. Saved loans live in `localStorage`; export them as JSON if you want a backup.

## Features

- Annuity and serial loans, monthly fee, optional start date and remaining balance so the chart shows where you are today.
- Verdict banner plus four stat tiles: monthly payment, payoff date, total interest, total cost, each with the delta against the current plan.
- Charts: balance over time (history, current plan, with changes), yearly breakdown (interest / principal / extra), cumulative interest.
- Full schedule table grouped by year, interest-only months marked.
- My loans page: save, open, duplicate, delete, delete all, export/import JSON.
- Share link: the whole scenario encoded in the URL hash.
- Light and dark theme.

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

## Engine notes

- Months in extra payments and interest-only periods are counted from "now" (month 1 = next payment).
- With a start date, the forward projection starts at the balance after the elapsed months, or at the remaining balance you type in.
- Interest-only months: principal 0, payment = interest + fee. Afterwards either the payment is recomputed to hold the end date (`keep-term`) or kept, extending the loan (`keep-payment`).
- Estimates only. Banks round, charge differently, and change rates. Treat the numbers as a good approximation, not a quote.
