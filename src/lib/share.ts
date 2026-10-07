import { uid } from "./ids"
import type { Scenario } from "./loan/types"

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(s: Scenario): string {
  const { loan, extras, interestOnly, afterInterestOnly } = s
  return toBase64Url(JSON.stringify({ loan, extras, interestOnly, afterInterestOnly }))
}

export function decodeShare(hash: string): Scenario | undefined {
  try {
    const raw = JSON.parse(fromBase64Url(hash)) as Partial<Scenario>
    if (!raw.loan || typeof raw.loan.principal !== "number") return undefined
    return {
      id: uid(),
      savedAt: new Date().toISOString(),
      loan: raw.loan,
      extras: raw.extras ?? [],
      interestOnly: raw.interestOnly ?? [],
      afterInterestOnly: raw.afterInterestOnly ?? "keep-term",
    }
  } catch {
    return undefined
  }
}

export function shareUrl(s: Scenario): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}#/share/${encodeShare(s)}`
}

export function exportJson(items: Scenario[]): string {
  return JSON.stringify({ app: "lane-kalkulator", v: 1, exportedAt: new Date().toISOString(), items }, null, 2)
}

export function parseImport(text: string): Scenario[] {
  const parsed = JSON.parse(text) as { items?: unknown }
  const items = Array.isArray(parsed) ? parsed : parsed.items
  if (!Array.isArray(items)) throw new Error("Not a lane-kalkulator export")
  return items
    .filter((i): i is Scenario => !!i && typeof i === "object" && "loan" in i)
    .map((i) => ({ ...i, id: i.id || uid() }))
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
