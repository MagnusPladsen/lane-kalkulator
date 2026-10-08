/**
 * Best-effort request limits, kept in memory per server instance. They stop casual abuse;
 * the hard stop is the monthly budget set on the OpenAI project.
 */
export interface LimitConfig {
  perIpPerMinute: number
  perIpPerDay: number
  globalPerDay: number
}

export const DEFAULT_LIMITS: LimitConfig = { perIpPerMinute: 6, perIpPerDay: 40, globalPerDay: 300 }

export class RateLimiter {
  private minute = new Map<string, number[]>()
  private day = new Map<string, number>()
  private dayKey = ""
  private global = 0
  private readonly cfg: LimitConfig

  constructor(cfg: LimitConfig = DEFAULT_LIMITS) {
    this.cfg = cfg
  }

  /** Records a request if allowed. Returns seconds to wait when it isn't. */
  take(ip: string, now: number = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
    const today = new Date(now).toISOString().slice(0, 10)
    if (today !== this.dayKey) {
      this.dayKey = today
      this.day.clear()
      this.global = 0
    }
    const untilMidnight = Math.ceil((Date.parse(`${today}T24:00:00Z`) - now) / 1000)
    if (this.global >= this.cfg.globalPerDay) return { ok: false, retryAfter: untilMidnight }
    if ((this.day.get(ip) ?? 0) >= this.cfg.perIpPerDay) return { ok: false, retryAfter: untilMidnight }
    const recent = (this.minute.get(ip) ?? []).filter((t) => now - t < 60_000)
    if (recent.length >= this.cfg.perIpPerMinute) return { ok: false, retryAfter: Math.ceil((60_000 - (now - recent[0])) / 1000) }
    recent.push(now)
    this.minute.set(ip, recent)
    this.day.set(ip, (this.day.get(ip) ?? 0) + 1)
    this.global++
    return { ok: true }
  }
}
