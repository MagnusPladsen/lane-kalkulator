import type { Response as OpenAIResponse, ResponseCreateParamsNonStreaming, ResponseInputItem } from "openai/resources/responses/responses"
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems"
import { sanitizeScenario } from "../loan/sanitize"
import type { Scenario } from "../loan/types"
import { INSTRUCTIONS } from "./prompt"
import { runTool, TOOL_DEFS } from "./tools"
import type { AiErrorCode, AiRequest, AiResponse, AiSource, Suggestion } from "./types"

/** The part of the OpenAI client this module uses, so tests can pass a fake. */
export interface OpenAILike {
  responses: { create(body: ResponseCreateParamsNonStreaming): Promise<OpenAIResponse> }
}

export class AiError extends Error {
  readonly code: AiErrorCode
  constructor(code: AiErrorCode, message: string = code) {
    super(message)
    this.code = code
  }
}

const MAX_MESSAGES = 12
const MAX_CHARS = 1_200
const MAX_TEXT = 6_000
const MAX_ROUNDS = 5
/** Stable key so requests sharing the static prefix land on the same cache. */
export const PROMPT_CACHE_KEY = "lane-kalkulator-v1"

/** Checks and trims an untrusted request body. */
export function validateRequest(body: unknown): AiRequest {
  if (!body || typeof body !== "object") throw new AiError("bad_request")
  const b = body as Record<string, unknown>
  const mode = b.mode === "parse" || b.mode === "rates" ? b.mode : "chat"
  const lang = b.lang === "en" || b.lang === "pl" ? b.lang : "nb"
  const raw = Array.isArray(b.messages) ? b.messages : []
  if (raw.length > MAX_MESSAGES) throw new AiError("too_long")
  const messages = raw.map((m) => {
    const r = m as Record<string, unknown>
    const content = typeof r.content === "string" ? r.content.trim() : ""
    if (content.length > MAX_CHARS) throw new AiError("too_long")
    return { role: r.role === "assistant" ? ("assistant" as const) : ("user" as const), content }
  })
  if (mode === "chat" && (messages.length === 0 || messages.at(-1)!.role !== "user" || !messages.at(-1)!.content))
    throw new AiError("bad_request")
  const text = typeof b.text === "string" ? b.text.slice(0, MAX_TEXT) : undefined
  if (mode === "parse" && !text?.trim()) throw new AiError("bad_request")
  const category = typeof b.category === "string" ? b.category.slice(0, 20) : undefined
  // Re-sanitize the loan and drop anything identifying.
  const s = b.scenario ? sanitizeScenario({ ...(b.scenario as object), id: "ai", savedAt: new Date(0).toISOString() }) : undefined
  const scenario = s ? { ...s, loan: { ...s.loan, name: "" } } : undefined
  const focus = typeof b.focus === "string" ? b.focus.slice(0, 60) : undefined
  return { mode, lang, messages, scenario, text, category, focus }
}

function contextMessage(req: AiRequest, today: string): ResponseInputItem {
  const ctx = {
    mode: req.mode,
    language: req.lang,
    today,
    focus: req.focus ?? null,
    category: req.category ?? null,
    has_loan: !!req.scenario,
  }
  return { role: "developer", content: `Context: ${JSON.stringify(ctx)}` }
}

function sourcesOf(resp: OpenAIResponse): AiSource[] {
  const out: AiSource[] = []
  for (const item of resp.output ?? []) {
    if (item.type !== "message") continue
    for (const c of item.content) {
      if (c.type !== "output_text") continue
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && !out.some((s) => s.url === a.url)) out.push({ url: a.url, title: a.title })
      }
    }
  }
  return out
}

/**
 * Runs one assistant turn: the model may call the app's engine through tools several times,
 * then answers. Suggestions only ever come from validated propose_change calls.
 */
export async function handleAi(
  req: AiRequest,
  deps: { client: OpenAILike; model: string; today: string; onUsage?: (u: OpenAIResponse["usage"]) => void },
): Promise<AiResponse> {
  const scenario: Scenario | undefined = req.scenario ? { ...req.scenario, id: "ai", savedAt: "" } : undefined
  const fnTools = req.mode === "rates" ? TOOL_DEFS.filter((t) => t.name === "propose_change" || t.name === "typical_rate") : TOOL_DEFS
  const tools: ResponseCreateParamsNonStreaming["tools"] =
    req.mode === "rates"
      ? [
          ...fnTools,
          {
            type: "web_search",
            filters: { allowed_domains: ["finansportalen.no", "ssb.no", "norges-bank.no", "lanekassen.no", "husbanken.no"] },
          },
        ]
      : fnTools

  const input: ResponseInputItem[] = [contextMessage(req, deps.today)]
  if (req.mode === "parse") input.push({ role: "user", content: `Loan text:\n"""\n${req.text}\n"""` })
  else if (req.mode === "rates") input.push({ role: "user", content: `Typical rate for: ${req.category}` })
  for (const m of req.messages) input.push({ role: m.role, content: m.content })

  const suggestions: Suggestion[] = []
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let resp: OpenAIResponse
    try {
      resp = await deps.client.responses.create({
        model: deps.model,
        instructions: INSTRUCTIONS,
        tools,
        input,
        store: false,
        include: ["reasoning.encrypted_content"],
        reasoning: { effort: "low" },
        max_output_tokens: 1_500,
        prompt_cache_key: PROMPT_CACHE_KEY,
        prompt_cache_options: { ttl: "30m" },
      })
    } catch (e) {
      throw new AiError("upstream", e instanceof Error ? e.message : "upstream")
    }
    deps.onUsage?.(resp.usage)
    const calls = (resp.output ?? []).filter((i) => i.type === "function_call")
    if (calls.length === 0) {
      return { reply: resp.output_text?.trim() ?? "", suggestions: suggestions.slice(0, 3), sources: sourcesOf(resp) }
    }
    input.push(...toResponseInputItems(resp.output))
    for (const call of calls) {
      const result = scenario
        ? await runTool(call.name, call.arguments, { scenario, today: deps.today })
        : call.name === "propose_change"
          ? await runTool(call.name, call.arguments, { scenario: emptyScenario(), today: deps.today })
          : { output: { error: "No loan is filled in yet." } }
      if (result.suggestion) suggestions.push(result.suggestion)
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.output) })
    }
  }
  return { reply: "", suggestions: suggestions.slice(0, 3) }
}

function emptyScenario(): Scenario {
  return {
    id: "ai",
    savedAt: "",
    loan: { name: "", principal: 1, annualRatePct: 0, termMonths: 12, loanType: "annuity", monthlyFee: 0 },
    extras: [],
    periods: [],
    afterInterestOnly: "keep-term",
  }
}
