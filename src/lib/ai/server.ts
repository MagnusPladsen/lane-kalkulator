import type { Response as OpenAIResponse, ResponseCreateParamsNonStreaming, ResponseInputItem } from "openai/resources/responses/responses"
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems"
import { sanitizeScenario } from "../loan/sanitize.js"
import type { Scenario } from "../loan/types.js"
import { INSTRUCTIONS } from "./prompt.js"
import { runTool, TOOL_DEFS } from "./tools.js"
import type { AiErrorCode, AiRequest, AiResponse, AiSource, AiTier, Suggestion } from "./types.js"

/** The part of the OpenAI client this module uses, so tests can pass a fake. */
export interface OpenAILike {
  responses: { create(body: ResponseCreateParamsNonStreaming): Promise<OpenAIResponse> }
}

export class AiError extends Error {
  readonly code: AiErrorCode
  /** For upstream errors: OpenAI's short error code and parameter, safe to show. */
  readonly detail?: string
  constructor(code: AiErrorCode, message: string = code, detail?: string) {
    super(message)
    this.code = code
    this.detail = detail
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

/**
 * Which model tier a request needs. A field's "Ask AI" button sends one fixed question
 * and reading pasted text is extraction, so both go to the small model. Typed chat,
 * follow-ups and the web rate lookup need more judgement.
 */
export function tierOf(req: AiRequest): AiTier {
  if (req.mode === "parse") return "simple"
  if (req.mode === "chat" && req.focus?.startsWith("field:") && req.messages.length === 1) return "simple"
  return "advanced"
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

  // Fees came up in the conversation (the user asked, or said yes to an earlier offer).
  const feeChangeAllowed = req.mode === "parse" || req.messages.some((m) => /gebyr|fee|opłat/i.test(m.content))
  const suggestions: Suggestion[] = []
  const usage = { input: 0, cached: 0, output: 0, rounds: 0, model: deps.model }
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
        // Caching is automatic for a shared prefix; the key keeps our requests together.
        // No TTL option: newer models default to 30 min and older ones (gpt-5-mini) reject it.
        prompt_cache_key: PROMPT_CACHE_KEY,
      })
    } catch (e) {
      const err = e as { status?: number; code?: string | null; param?: string | null }
      const detail = [err.status, err.code, err.param].filter((x) => x !== undefined && x !== null && x !== "").join(" ") || undefined
      throw new AiError("upstream", e instanceof Error ? e.message : "upstream", detail)
    }
    deps.onUsage?.(resp.usage)
    usage.rounds++
    usage.input += resp.usage?.input_tokens ?? 0
    usage.cached += resp.usage?.input_tokens_details?.cached_tokens ?? 0
    usage.output += resp.usage?.output_tokens ?? 0
    const calls = (resp.output ?? []).filter((i) => i.type === "function_call")
    if (calls.length === 0) {
      return { reply: tidy(resp.output_text?.trim() ?? ""), suggestions: suggestions.slice(0, 3), sources: sourcesOf(resp), usage }
    }
    input.push(...toResponseInputItems(resp.output))
    for (const call of calls) {
      const result = scenario
        ? await runTool(call.name, call.arguments, { scenario, today: deps.today, feeChangeAllowed })
        : call.name === "propose_change"
          ? await runTool(call.name, call.arguments, { scenario: emptyScenario(), today: deps.today, feeChangeAllowed })
          : { output: { error: "No loan is filled in yet." } }
      if (result.suggestion) suggestions.push(result.suggestion)
      input.push({ type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result.output) })
    }
  }
  return { reply: "", suggestions: suggestions.slice(0, 3), usage }
}

/**
 * The chat bubble understands paragraphs, "- " bullets and **bold** (see format.ts).
 * Normalise what the model writes to that subset and drop the rest of markdown.
 */
export function tidy(text: string): string {
  let bold = 0
  const out = text
    .replace(/__(.+?)__/g, "**$1**")
    .replace(/^#+\s*/gm, "")
    .replace(/^[ \t]*[*•–][ \t]+/gm, "- ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    // A leading label adds nothing to an answer that is already short.
    .replace(/^(?:\*\*)?(?:kort|svar|kort svar|short answer|answer|in short|krótko)(?:\*\*)?\s*:\s*/i, "")
    // Bold only marks the key figures; past the first two it is noise.
    .replace(/\*\*(.+?)\*\*/g, (m, inner: string) => (++bold <= 2 ? m : inner))
  // The UI already invites a follow-up; drop a closing offer ("Vil du at jeg …?").
  const parts = out.split(/\n\n/)
  if (parts.length > 1 && OFFER.test(parts.at(-1)!)) parts.pop()
  return parts.join("\n\n")
}

/** A closing paragraph that only offers more: it opens with an offer or ends asking one. */
const OFFER =
  /^(?:vil du at jeg|hvis du vil|skal jeg|ønsker du at jeg|want me to|would you like me to|shall i|do you want me to|if you want, i can|chcesz, żebym|czy mam)|(?:vil du at jeg|skal jeg|ønsker du at jeg|want me to|would you like me to|shall i|do you want me to|chcesz, żebym|czy mam)[^.!?\n]*\?\s*$/i

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
