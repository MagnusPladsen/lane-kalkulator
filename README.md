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

## Engine notes

- Extra payments are counted from "now" (month 1 = next payment).
- Custom periods are stored as calendar months (`YYYY-MM`, inclusive) so a saved loan keeps its dates as time passes. A period that has already ended has no effect; one that started in the past counts from the next payment. Older saves with relative months are converted on load.
- A rate period re-prices an annuity over the months left when it starts, and again when it ends.
- With a start date, the forward projection starts at the balance after the elapsed months, or at the remaining balance you type in.
- Interest-only months: principal 0, payment = interest + fee. Afterwards either the payment is recomputed to hold the end date (`keep-term`) or kept, extending the loan (`keep-payment`).
- Estimates only. Banks round, charge differently, and change rates. Treat the numbers as a good approximation, not a quote.
