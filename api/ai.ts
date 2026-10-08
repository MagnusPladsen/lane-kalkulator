import OpenAI from "openai"
import { DEFAULT_LIMITS, RateLimiter } from "../src/lib/ai/limits"
import { AiError, handleAi, validateRequest } from "../src/lib/ai/server"
import type { AiStatus } from "../src/lib/ai/types"

export const config = { maxDuration: 30 }

const env = (k: string) => process.env[k]
const intEnv = (k: string, d: number) => {
  const n = Number(env(k))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : d
}
const MODEL = env("AI_MODEL") || "gpt-6-luna"
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
    if (request.method === "GET") return json({ enabled: !!key, model: key ? MODEL : undefined } satisfies AiStatus)
    if (request.method !== "POST") return json({ error: "bad_request" }, 405)
    if (!key) return json({ error: "disabled" }, 503)
    if (Number(request.headers.get("content-length") ?? 0) > 32_000) return json({ error: "too_long" }, 413)

    const gate = limiter.take(clientIp(request))
    if (!gate.ok) return json({ error: "rate_limited" }, 429, { "retry-after": String(gate.retryAfter) })

    try {
      const req = validateRequest(await request.json())
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" })
      const result = await handleAi(req, {
        client: new OpenAI({ apiKey: key }),
        model: MODEL,
        today,
        // Cache check: cached_tokens should be > 0 from the second request on.
        onUsage: (u) => console.log(JSON.stringify({ ai_usage: { input: u?.input_tokens, cached: u?.input_tokens_details?.cached_tokens, output: u?.output_tokens } })),
      })
      return json(result)
    } catch (e) {
      const code = e instanceof AiError ? e.code : "upstream"
      if (code === "upstream") console.error("ai upstream error", e instanceof Error ? e.message : e)
      return json({ error: code }, STATUS_FOR[code] ?? 500)
    }
  },
}
