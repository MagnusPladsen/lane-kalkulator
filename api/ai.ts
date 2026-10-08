import OpenAI from "openai"
import { DEFAULT_LIMITS, RateLimiter } from "../src/lib/ai/limits.js"
import { AiError, handleAi, tierOf, validateRequest } from "../src/lib/ai/server.js"
import type { AiStatus, AiTier } from "../src/lib/ai/types.js"

export const config = { maxDuration: 30 }

const env = (k: string) => process.env[k]
const intEnv = (k: string, d: number) => {
  const n = Number(env(k))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d
}
/** Small fast model for field buttons and pasted text; stronger model for the chat. */
const MODELS: Record<AiTier, string> = {
  simple: env("AI_MODEL_SIMPLE") || "gpt-6-luna",
  advanced: env("AI_MODEL_CHAT") || "gpt-5-mini",
}
const limiter = new RateLimiter({
  perIpPerMinute: intEnv("AI_LIMIT_PER_MINUTE", DEFAULT_LIMITS.perIpPerMinute),
  perIpPerDay: intEnv("AI_LIMIT_PER_DAY", DEFAULT_LIMITS.perIpPerDay),
  globalPerDay: intEnv("AI_LIMIT_GLOBAL_PER_DAY", DEFAULT_LIMITS.globalPerDay),
})

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } })

function clientIp(request: Request): string {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim()
}

const STATUS_FOR: Record<string, number> = { disabled: 503, rate_limited: 429, bad_request: 400, too_long: 413, upstream: 502 }

export default {
  async fetch(request: Request): Promise<Response> {
    const key = env("OPENAI_API_KEY")
    if (request.method === "GET") return json({ enabled: !!key, models: key ? MODELS : undefined } satisfies AiStatus)
    if (request.method !== "POST") return json({ error: "bad_request" }, 405)
    if (!key) return json({ error: "disabled" }, 503)
    if (Number(request.headers.get("content-length") ?? 0) > 32_000) return json({ error: "too_long" }, 413)

    const gate = limiter.take(clientIp(request))
    if (!gate.ok) return json({ error: "rate_limited" }, 429, { "retry-after": String(gate.retryAfter) })

    try {
      const req = validateRequest(await request.json())
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" })
      const client = new OpenAI({ apiKey: key })
      const run = (model: string) =>
        handleAi(req, {
          client,
          model,
          today,
          // Cache check: cached_tokens should be > 0 from the second request on.
          onUsage: (u) => console.log(JSON.stringify({ ai_usage: { model, input: u?.input_tokens, cached: u?.input_tokens_details?.cached_tokens, output: u?.output_tokens } })),
        })
      const tier = tierOf(req)
      try {
        return json(await run(MODELS[tier]))
      } catch (e) {
        // If the chat model fails upstream, answer with the small model rather than not at all.
        if (tier === "simple" || !(e instanceof AiError) || e.code !== "upstream" || MODELS.simple === MODELS.advanced) throw e
        console.error("ai chat model failed, falling back", MODELS.advanced, e.message)
        const result = await run(MODELS.simple)
        return json({ ...result, usage: result.usage && { ...result.usage, fallbackFrom: MODELS.advanced, fallbackReason: e.detail } })
      }
    } catch (e) {
      const code = e instanceof AiError ? e.code : "upstream"
      if (code === "upstream") console.error("ai upstream error", e instanceof Error ? e.message : e)
      return json({ error: code }, STATUS_FOR[code] ?? 500)
    }
  },
}
