/**
 * Pre-launch check: runs typical questions through two models and prints the answers side by side.
 * Needs OPENAI_API_KEY in .env.local. Run: bun scripts/ai-eval.ts [modelA] [modelB]
 * Costs a few cents. Uses the same server code as production, including the tools.
 */
import { readFileSync } from "node:fs"
import OpenAI from "openai"
import { handleAi } from "../src/lib/ai/server"
import type { AiRequest } from "../src/lib/ai/types"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
)
if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing in .env.local")
const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })
const models = [process.argv[2] ?? "gpt-6-luna", process.argv[3] ?? "gpt-5-mini"]
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" })

// A neutral example loan (not anyone's real loan).
const scenario: AiRequest["scenario"] = {
  loan: { name: "", category: "mortgage", principal: 3_000_000, annualRatePct: 5.3, termMonths: 300, loanType: "annuity", monthlyFee: 50, dayCount: "act/act", startDate: "2023-05-15", effectiveRatePct: 5.55 },
  extras: [],
  periods: [],
  afterInterestOnly: "keep-term",
}

const QUESTIONS = [
  "Jeg vil være ferdig med lånet innen 2040. Hvor mye må jeg betale ekstra hver måned?",
  "Hva skjer hvis jeg betaler 2 000 kr ekstra i måneden?",
  "Kan jeg ta en pause på 6 måneder neste år der jeg bare betaler renter? Hva koster det?",
  "Hva om renten stiger med 2 prosentpoeng?",
  "En annen bank tilbyr 4,9 % rente med 2 500 kr i etableringsgebyr. Lønner det seg å bytte?",
  "Sammenlign: Bank A 5,1 % og 0 kr gebyr, Bank B 4,95 % og 75 kr gebyr per måned, 3 millioner over 25 år.",
  "Hva betyr effektiv rente, og stemmer min?",
  "Banken sier effektiv rente er 5,55 %. Hvorfor får jeg noe annet?",
  "Hva er forskjellen på annuitet og serielån for meg?",
  "Hva betyr renteberegning 365/360?",
  "Hvor mye har jeg betalt i renter så langt?",
  "Når går mer av terminbeløpet til avdrag enn til renter?",
  "Hva er vanlig rente på boliglån nå?",
  "Jeg får 100 000 kr i arv. Bør jeg betale ned på lånet?",
  "Hvor mye sparer jeg på et engangsbeløp på 50 000 kr i januar?",
  "Hvordan blir det om jeg vil være ferdig før jeg fyller 60? Jeg er født i 1985.",
  "Hva er restgjelden min nå?",
  "Har jeg rett på avdragsfrihet hvis jeg mister jobben?",
  "Can you explain my loan in simple English?",
  "Skriv et dikt om været i Bergen.",
]

for (const [i, q] of QUESTIONS.entries()) {
  console.log(`\n${"=".repeat(100)}\nQ${i + 1}: ${q}`)
  for (const model of models) {
    const t0 = Date.now()
    let cached = 0
    let input = 0
    try {
      const r = await handleAi(
        { mode: "chat", lang: /[a-z]/i.test(q) && /explain/i.test(q) ? "en" : "nb", messages: [{ role: "user", content: q }], scenario },
        { client, model, today, onUsage: (u) => ((cached += u?.input_tokens_details?.cached_tokens ?? 0), (input += u?.input_tokens ?? 0)) },
      )
      console.log(`\n-- ${model} (${((Date.now() - t0) / 1000).toFixed(1)} s, input ${input} tok, cached ${cached})\n${r.reply}`)
      for (const s of r.suggestions) console.log(`   [button] ${s.label}`)
    } catch (e) {
      console.log(`\n-- ${model}: ERROR ${e instanceof Error ? e.message : e}`)
    }
  }
}
