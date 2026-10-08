import { describe, expect, it } from "vitest"
import type { Response as OpenAIResponse, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses"
import { solveForTarget } from "../loan/engine"
import type { Scenario } from "../loan/types"
import { RateLimiter } from "./limits"
import { INSTRUCTIONS } from "./prompt"
import { AiError, handleAi, PROMPT_CACHE_KEY, tidy, tierOf, validateRequest, type OpenAILike } from "./server"
import { keepTogether, parseReply } from "./format"
import { runTool, TOOL_DEFS, toSuggestion } from "./tools"

const today = "2026-10-08"
const scenario: Scenario = {
  id: "t",
  savedAt: "",
  loan: { name: "Mitt lån", principal: 2_000_000, annualRatePct: 5, termMonths: 300, loanType: "annuity", monthlyFee: 50, dayCount: "30/360" },
  extras: [],
  periods: [],
  afterInterestOnly: "keep-term",
}
const ctx = { scenario, today }

describe("validateRequest", () => {
  it("strips the loan name and keeps the numbers", () => {
    const r = validateRequest({ mode: "chat", lang: "nb", messages: [{ role: "user", content: "Hei" }], scenario })
    expect(r.scenario?.loan.name).toBe("")
    expect(r.scenario?.loan.principal).toBe(2_000_000)
  })
  it("refuses long or malformed conversations", () => {
    const many = Array.from({ length: 13 }, () => ({ role: "user", content: "x" }))
    expect(() => validateRequest({ mode: "chat", messages: many })).toThrow(AiError)
    expect(() => validateRequest({ mode: "chat", messages: [{ role: "user", content: "x".repeat(1201) }] })).toThrow(/too_long/)
    expect(() => validateRequest({ mode: "chat", messages: [{ role: "assistant", content: "hi" }] })).toThrow(/bad_request/)
    expect(() => validateRequest(null)).toThrow(/bad_request/)
  })
  it("parse mode needs text", () => {
    expect(() => validateRequest({ mode: "parse", messages: [] })).toThrow(/bad_request/)
    expect(validateRequest({ mode: "parse", messages: [], text: "Lånebeløp 1 000 000" }).mode).toBe("parse")
  })
})

describe("toSuggestion", () => {
  it("builds an extra payment from the next month by default", () => {
    expect(toSuggestion({ kind: "extra_monthly", label: "Betal 1 000 kr ekstra", amount: 1000, from: null, to: null }, "2026-11")).toEqual({
      kind: "extra",
      label: "Betal 1 000 kr ekstra",
      extra: { kind: "recurring", amount: 1000, from: "2026-11", to: undefined },
    })
  })
  it("refuses incomplete or out-of-range changes instead of clamping", () => {
    expect(toSuggestion({ kind: "extra_monthly", label: "x", amount: -5 }, "2026-11")).toBeUndefined()
    expect(toSuggestion({ kind: "rate_period", label: "x", rate_pct: 80 }, "2026-11")).toBeUndefined()
    expect(toSuggestion({ kind: "interest_only_period", label: "x", from: "2027-05", to: "2027-01" }, "2026-11")).toBeUndefined()
    expect(toSuggestion({ kind: "extra_monthly", label: "", amount: 100 }, "2026-11")).toBeUndefined()
  })
  it("loan fields keep only valid values", () => {
    const s = toSuggestion({ kind: "loan_fields", label: "Bruk", loan: { principal: 500000, annual_rate_pct: 99, term_months: 120, loan_type: "serial", monthly_fee: 65, setup_fee: null, effective_rate_pct: 5.5, start_date: "2024-03-15", remaining_balance: null } }, "2026-11")
    expect(s).toEqual({ kind: "loan", label: "Bruk", patch: { principal: 500000, termMonths: 120, loanType: "serial", monthlyFee: 65, effectiveRatePct: 5.5, startDate: "2024-03-15" } })
  })
})

describe("tools run the real engine", () => {
  it("solve_payoff_by matches solveForTarget", async () => {
    const r = await runTool("solve_payoff_by", JSON.stringify({ target_month: "2041-10", kind: "monthly" }), ctx)
    const out = r.output as { extra_needed: number; payoff_month: string }
    // 2026-11 .. 2041-10 inclusive = 180 payments
    expect(out.extra_needed).toBe(solveForTarget(scenario, today, 180, "recurring")!.amount)
    expect(out.payoff_month <= "2041-10").toBe(true)
  })
  it("simulate shows a shorter loan with extra payments", async () => {
    const r = await runTool("simulate", JSON.stringify({ extra_monthly: 2000, extra_monthly_from: null, extra_monthly_to: null, one_off: null, one_off_month: null, new_rate_pct: null, rate_from: null, rate_to: null, interest_only_from: null, interest_only_to: null }), ctx)
    const out = r.output as { months_change: number; interest_change: number }
    expect(out.months_change).toBeLessThan(0)
    expect(out.interest_change).toBeLessThan(0)
  })
  it("check_refinance with a lower rate saves money", async () => {
    const r = await runTool("check_refinance", JSON.stringify({ new_rate_pct: 4.5, new_monthly_fee: null, switch_cost: null, new_term_months: null }), ctx)
    expect((r.output as { total_saving: number }).total_saving).toBeGreaterThan(0)
  })
  it("bad input comes back as an error, never a throw", async () => {
    expect((await runTool("solve_payoff_by", "{not json", ctx)).output).toMatchObject({ error: expect.any(String) })
    expect((await runTool("nope", "{}", ctx)).output).toMatchObject({ error: expect.stringMatching(/Unknown/) })
  })
  it("every tool definition is strict with all properties required", () => {
    for (const t of TOOL_DEFS) {
      expect(t.strict).toBe(true)
      const p = t.parameters as { properties: object; required: string[]; additionalProperties: boolean }
      expect(p.additionalProperties).toBe(false)
      expect(p.required.sort()).toEqual(Object.keys(p.properties).sort())
    }
  })
})

/** A fake client that answers with a scripted sequence and records every request. */
function fakeClient(script: Partial<OpenAIResponse>[]) {
  const calls: ResponseCreateParamsNonStreaming[] = []
  const client: OpenAILike = {
    responses: {
      create: async (body) => {
        calls.push(structuredClone(body))
        return { output_text: "", usage: undefined, ...script[calls.length - 1] } as OpenAIResponse
      },
    },
  }
  return { client, calls }
}

describe("handleAi", () => {
  it("runs tools, returns validated suggestions, and keeps the cached prefix identical", async () => {
    const { client, calls } = fakeClient([
      {
        output: [
          { type: "function_call", id: "fc1", call_id: "c1", name: "solve_payoff_by", arguments: JSON.stringify({ target_month: "2041-10", kind: "monthly" }), status: "completed" },
        ] as OpenAIResponse["output"],
      },
      {
        output: [
          { type: "function_call", id: "fc2", call_id: "c2", name: "propose_change", arguments: JSON.stringify({ kind: "extra_monthly", label: "Betal ekstra", amount: 3000, from: null, to: null, rate_pct: null, loan: null }), status: "completed" },
        ] as OpenAIResponse["output"],
      },
      { output: [], output_text: "Du må betale 3 000 kr ekstra i måneden." },
    ])
    const req = validateRequest({ mode: "chat", lang: "nb", messages: [{ role: "user", content: "Ferdig innen 2041?" }], scenario })
    const res = await handleAi(req, { client, model: "gpt-6-luna", today })
    expect(res.reply).toBe("Du må betale 3 000 kr ekstra i måneden.")
    expect(res.suggestions).toEqual([{ kind: "extra", label: "Betal ekstra", extra: { kind: "recurring", amount: 3000, from: "2026-11", to: undefined } }])
    expect(calls).toHaveLength(3)
    for (const c of calls) {
      expect(c.instructions).toBe(INSTRUCTIONS)
      expect(c.tools).toEqual(calls[0].tools)
      expect(c.prompt_cache_key).toBe(PROMPT_CACHE_KEY)
      expect(c).not.toHaveProperty("prompt_cache_options")
      expect(c.store).toBe(false)
    }
    // Context goes first in the input, never in the cached instructions.
    expect((calls[0].input as { role: string }[])[0].role).toBe("developer")
    const second = calls[1].input as { type?: string; call_id?: string; output?: string }[]
    const result = second.find((i) => i.type === "function_call_output")!
    expect(result.call_id).toBe("c1")
    expect(JSON.parse(result.output!)).toHaveProperty("extra_needed")
  })
  it("the static prefix is long enough to be cached (≥ 1 024 tokens ≈ 4 000 chars)", () => {
    expect(INSTRUCTIONS.length + JSON.stringify(TOOL_DEFS).length).toBeGreaterThan(4_500)
  })
})

describe("RateLimiter", () => {
  it("limits per minute, per day and globally, and resets at midnight UTC", () => {
    const rl = new RateLimiter({ perIpPerMinute: 2, perIpPerDay: 3, globalPerDay: 4 })
    const t0 = Date.parse("2026-10-08T10:00:00Z")
    expect(rl.take("a", t0).ok).toBe(true)
    expect(rl.take("a", t0 + 1).ok).toBe(true)
    expect(rl.take("a", t0 + 2).ok).toBe(false) // 3rd in a minute
    expect(rl.take("a", t0 + 61_000).ok).toBe(true) // 3rd today
    expect(rl.take("a", t0 + 122_000).ok).toBe(false) // daily cap
    expect(rl.take("b", t0 + 122_000).ok).toBe(true) // 4th globally
    expect(rl.take("c", t0 + 122_000).ok).toBe(false) // global cap
    expect(rl.take("a", Date.parse("2026-10-09T00:00:01Z")).ok).toBe(true)
  })
})

describe("answer polish", () => {
  it("keeps bold and bullets, drops the markdown the bubble cannot show", () => {
    expect(tidy("## Svar\nKalkulatoren får **5,46 %**, banken __5,55 %__.\n\n\n* gebyr `79 kr`\n• [kilde](https://ssb.no)")).toBe(
      "Svar\nKalkulatoren får **5,46 %**, banken **5,55 %**.\n\n- gebyr 79 kr\n- kilde",
    )
  })
  it("parses paragraphs, bullets and bold into safe blocks", () => {
    const b = parseReply("Ja, det lønner seg.\n\n- Du sparer **12 000 kr**\n- Ferdig i mai 2048\nSjekk med banken.")
    expect(b.map((x) => x.kind)).toEqual(["p", "ul", "p"])
    expect(b[1]).toEqual({
      kind: "ul",
      items: [
        [{ text: "Du sparer ", bold: false }, { text: "12\u00a0000\u00a0kr", bold: true }],
        [{ text: "Ferdig i mai\u00a02048", bold: false }],
      ],
    })
    expect(parseReply("<b>x</b> **ok")).toEqual([{ kind: "p", spans: [{ text: "<b>x</b> ok", bold: false }] }])
  })
  it("never lets a number split across lines", () => {
    expect(keepTogether("restgjeld 2 555 952 kr og 4,63 % fra nov. 2026")).toBe("restgjeld 2\u00a0555\u00a0952\u00a0kr og 4,63\u00a0% fra nov.\u00a02026")
    expect(keepTogether("i 3 måneder, 25 år")).toBe("i 3\u00a0måneder, 25\u00a0år")
  })
  it("overview says when principal overtakes interest, and simulate can switch loan type", async () => {
    const o = (await runTool("get_loan_overview", "{}", ctx)).output as { principal_exceeds_interest_from: string }
    expect(o.principal_exceeds_interest_from).toMatch(/^\d{4}-\d{2}$/)
    const sim = (await runTool("simulate", JSON.stringify({ extra_monthly: null, extra_monthly_from: null, extra_monthly_to: null, one_off: null, one_off_month: null, new_rate_pct: null, rate_from: null, rate_to: null, interest_only_from: null, interest_only_to: null, loan_type: "serial" }), ctx)).output as { interest_change: number; after: { loan_type: string } }
    expect(sim.interest_change).toBeLessThan(0) // serial pays less interest overall
  })
})

describe("model tier", () => {
  const q = [{ role: "user" as const, content: "Hva betyr dette?" }]
  it("a field's Ask AI button and pasted text use the small model", () => {
    expect(tierOf({ mode: "chat", lang: "nb", messages: q, focus: "field:dayCount" })).toBe("simple")
    expect(tierOf({ mode: "parse", lang: "nb", messages: [], text: "Lånebeløp 2 000 000" })).toBe("simple")
  })
  it("typed chat, follow-ups on a field question and the rate lookup use the chat model", () => {
    expect(tierOf({ mode: "chat", lang: "nb", messages: q, focus: "page:calc" })).toBe("advanced")
    expect(tierOf({ mode: "chat", lang: "nb", messages: q })).toBe("advanced")
    const followUp = [...q, { role: "assistant" as const, content: "Det betyr ..." }, { role: "user" as const, content: "Og for meg?" }]
    expect(tierOf({ mode: "chat", lang: "nb", messages: followUp, focus: "field:dayCount" })).toBe("advanced")
    expect(tierOf({ mode: "rates", lang: "nb", messages: [], category: "car" })).toBe("advanced")
  })
})

describe("fee guard", () => {
  const fee = (monthly_fee: number) =>
    JSON.stringify({ kind: "loan_fields", label: "Sett gebyr", amount: null, from: null, to: null, rate_pct: null, loan: { principal: null, annual_rate_pct: null, term_months: null, loan_type: null, monthly_fee, setup_fee: null, effective_rate_pct: null, start_date: null, remaining_balance: null } })
  it("does not offer a fee change the user did not ask for", async () => {
    const r = await runTool("propose_change", fee(200), { scenario, today })
    expect(r.suggestion).toBeUndefined()
    expect(r.output).toHaveProperty("error")
  })
  it("allows it when the user brought up fees or pasted loan text", async () => {
    const r = await runTool("propose_change", fee(200), { scenario, today, feeChangeAllowed: true })
    expect(r.suggestion).toMatchObject({ kind: "loan", patch: { monthlyFee: 200 } })
  })
})
