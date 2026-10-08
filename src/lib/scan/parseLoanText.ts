import { parseAmount } from "../parseAmount"
import type { LoanType } from "../loan/types"

/** A value found in the screenshot text, with the line it came from so the user can check it. */
export interface Found<T> {
  value: T
  source: string
}

export interface ScannedLoan {
  lender?: Found<string>
  isStartLoan?: boolean
  principal?: Found<number>
  currentBalance?: Found<number>
  nominalRatePct?: Found<number>
  effectiveRatePct?: Found<number>
  loanType?: Found<LoanType>
  termAmount?: Found<number>
  startDate?: Found<string>
  endDate?: Found<string>
  dueDay?: Found<number>
  fee?: Found<number>
  remainingMonths?: Found<number>
}

const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, january: 1,
  feb: 2, februar: 2, february: 2,
  mar: 3, mars: 3, march: 3,
  apr: 4, april: 4,
  mai: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11,
  des: 12, dec: 12, desember: 12, december: 12,
}

const pad = (n: number) => String(n).padStart(2, "0")

/** "19 May 2026", "19. mai 2026", "19.05.2026", "19.05.26", "2026-05-19" → ISO date. */
export function parseDate(s: string): string | undefined {
  const t = s.toLowerCase()
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = t.match(/(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{2,4})/)
  if (m) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1])
  m = t.match(/(\d{1,2})\.?\s+([a-zæøå]+)\.?\s+(\d{4})/)
  if (m && MONTHS[m[2]]) return valid(+m[3], MONTHS[m[2]], +m[1])
  return undefined
}

function valid(y: number, mo: number, d: number): string | undefined {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return undefined
  return `${y}-${pad(mo)}-${pad(d)}`
}

/** First percentage on the line: "4.375 %", "4,52%". */
function parseRate(s: string): number | undefined {
  const m = s.match(/(\d{1,2}(?:[.,]\d{1,4})?)\s*%/)
  if (!m) return undefined
  const n = Number(m[1].replace(",", "."))
  return n >= 0 && n <= 30 ? n : undefined
}

/** First amount on the line, sign ignored (OCR turns "−65" into "=65" or "—65"). */
function parseMoney(s: string): number | undefined {
  const m = s.match(/\d[\d\s .,]*\d|\d/)
  if (!m) return undefined
  const n = parseAmount(m[0].trim(), "nb")
  return n !== undefined && Number.isFinite(n) ? n : undefined
}

/** "42 years 5 months", "42 år 5 mnd", "8 months" → months. */
function parseDuration(s: string): number | undefined {
  const t = s.toLowerCase()
  const y = t.match(/(\d+)\s*(years?|år)/)
  const mo = t.match(/(\d+)\s*(months?|mnd|måneder|måned)/)
  if (!y && !mo) return undefined
  return (y ? +y[1] * 12 : 0) + (mo ? +mo[1] : 0)
}

type Rule = { key: keyof ScannedLoan; label: RegExp; read: (rest: string) => unknown }

// Label at the start of a line, then the value. Order matters: specific labels first.
const RULES: Rule[] = [
  { key: "effectiveRatePct", label: /^(effective interest( rate)?|effektiv rente)\b/, read: parseRate },
  { key: "nominalRatePct", label: /^(nominal interest( rate)?|nominell rente|rentesats)\b/, read: parseRate },
  { key: "principal", label: /^(original loan amount|opprinnelig (lånebeløp|beløp)|innvilget (lånebeløp|beløp))\b/, read: parseMoney },
  { key: "currentBalance", label: /^(current loan amount|current balance|restgjeld|gjenstående (lån|gjeld|beløp)|utestående( beløp)?|saldo)\b/, read: parseMoney },
  { key: "principal", label: /^(lånebeløp|loan amount)\b/, read: parseMoney },
  { key: "termAmount", label: /^(next term amount|terminbeløp|neste terminbeløp|neste termin|monthly payment|månedlig beløp)\b/, read: parseMoney },
  { key: "loanType", label: /^(type|lånetype|nedbetalingsform|repayment type)\b/, read: (r) => (/annuit/i.test(r) ? "annuity" : /seri/i.test(r) ? "serial" : undefined) },
  { key: "startDate", label: /^(start date|startdato|utbetalingsdato|disbursement date)\b/, read: parseDate },
  { key: "endDate", label: /^(end date|sluttdato|siste termin(dato)?|maturity date)\b/, read: parseDate },
  { key: "dueDay", label: /^(due date|due day|forfallsdato|forfallsdag|betalingsdag)\b/, read: (r) => { const m = r.match(/^\s*(\d{1,2})\.?\s*$/); const d = m ? +m[1] : NaN; return d >= 1 && d <= 31 ? d : undefined } },
  { key: "fee", label: /^(termingebyr|fakturagebyr|gebyr|fee|administration fee)\b/, read: parseMoney },
  { key: "remainingMonths", label: /^(remaining repayment period|remaining term|gjenværende løpetid|restløpetid)\b/, read: parseDuration },
  { key: "lender", label: /^(lender|långiver|kreditor)\b/, read: (r) => titleCase(r.trim()) || undefined },
]

/** "EKSEMPEL KOMMUNE" → "Eksempel Kommune"; mixed case like "DNB Bank" is kept; short all-caps words stay (DNB, KLP). */
function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s
  return s
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ")
}

/**
 * Pulls loan fields out of OCR text from one or more bank screenshots.
 * Every candidate is kept; `pickPlausible` later chooses between repeats.
 */
export function collectCandidates(text: string): Map<keyof ScannedLoan, Found<unknown>[]> {
  const out = new Map<keyof ScannedLoan, Found<unknown>[]>()
  const add = (k: keyof ScannedLoan, f: Found<unknown>) => out.set(k, [...(out.get(k) ?? []), f])
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim()
    if (!line) continue
    const lower = line.toLowerCase().replace(/^[^a-zæøå0-9]+/, "")
    for (const rule of RULES) {
      const m = lower.match(rule.label)
      if (!m) continue
      const rest = line.slice(line.length - lower.length + m[0].length).replace(/^[\s:.\-–]+/, "")
      const value = rule.read(rest)
      if (value !== undefined) add(rule.key, { value, source: line })
      break
    }
    if (/\b(start ?loan|startlån)\b/i.test(line)) out.set("isStartLoan", [{ value: true, source: line }])
  }
  return out
}

/** Repeated fields: take the first value that passes a sanity check. */
export function parseLoanText(text: string): ScannedLoan {
  const c = collectCandidates(text)
  const first = <T,>(k: keyof ScannedLoan, ok: (v: T) => boolean = () => true): Found<T> | undefined =>
    (c.get(k) as Found<T>[] | undefined)?.find((f) => ok(f.value))

  const money = (v: number) => v > 0 && v < 1e9
  const principal = first<number>("principal", money)
  const currentBalance = first<number>("currentBalance", money)
  const size = principal?.value ?? currentBalance?.value
  // A payment is a sliver of the loan; "1120414" for "11 204,14" fails this.
  const termOk = (v: number) => v > 0 && (size === undefined || (v < size / 6 && v > size / 2000))

  return {
    lender: first<string>("lender"),
    isStartLoan: c.has("isStartLoan") || undefined,
    principal,
    currentBalance,
    nominalRatePct: first<number>("nominalRatePct"),
    effectiveRatePct: first<number>("effectiveRatePct"),
    loanType: first<LoanType>("loanType"),
    termAmount: first<number>("termAmount", termOk),
    startDate: first<string>("startDate"),
    endDate: first<string>("endDate"),
    dueDay: first<number>("dueDay"),
    fee: first<number>("fee", (v) => v >= 0 && v <= 1000),
    remainingMonths: first<number>("remainingMonths", (v) => v > 0 && v <= 600),
  }
}
