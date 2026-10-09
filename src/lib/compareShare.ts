import { fromBase64Url, toBase64Url } from "./share"
import { LIMITS } from "./scenarioReducer"
import type { Offer } from "./compare"

/** Hash prefix for a shared comparison on /sammenlign. The hash never reaches a server. */
export const COMPARE_SHARE_PREFIX = "#/tilbud/"

export function encodeOffers(a: Offer, b: Offer): string {
  return toBase64Url(JSON.stringify({ v: 1, a, b }))
}

export function compareShareUrl(a: Offer, b: Offer): string {
  return `${location.origin}/sammenlign${COMPARE_SHARE_PREFIX}${encodeOffers(a, b)}`
}

const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : undefined

/** Rebuilds one offer from untrusted input; anything out of range drops the whole offer. */
function sanitizeOffer(raw: unknown): Offer | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const o = raw as Record<string, unknown>
  const principal = num(o.principal, 1, LIMITS.principalMax)
  const annualRatePct = num(o.annualRatePct, 0, LIMITS.rateMax)
  const termMonths = num(o.termMonths, 1, LIMITS.termMax)
  const monthlyFee = num(o.monthlyFee ?? 0, 0, LIMITS.feeMax)
  const setupFee = num(o.setupFee ?? 0, 0, LIMITS.principalMax)
  if (principal === undefined || annualRatePct === undefined || termMonths === undefined) return undefined
  if (monthlyFee === undefined || setupFee === undefined) return undefined
  return {
    name: typeof o.name === "string" ? o.name.slice(0, 80) : "",
    principal: Math.round(principal),
    annualRatePct,
    termMonths: Math.round(termMonths),
    loanType: o.loanType === "serial" ? "serial" : "annuity",
    monthlyFee,
    setupFee,
    dayCount: o.dayCount === "30/360" || o.dayCount === "act/360" || o.dayCount === "act/act" ? o.dayCount : undefined,
  }
}

/** Reads a shared comparison. Malformed or hostile input yields undefined, never a throw. */
export function decodeOffers(code: string): { a: Offer; b: Offer } | undefined {
  try {
    let c = code
    try {
      c = decodeURIComponent(c)
    } catch {
      /* keep as is */
    }
    const parsed = JSON.parse(fromBase64Url(c.replace(/\s+/g, ""))) as { a?: unknown; b?: unknown }
    const a = sanitizeOffer(parsed.a)
    const b = sanitizeOffer(parsed.b)
    return a && b ? { a, b } : undefined
  } catch {
    return undefined
  }
}
