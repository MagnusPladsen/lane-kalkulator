import { uid } from "./ids"
import { sanitizeScenario } from "./loan/sanitize"
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
  const { loan, extras, periods, afterInterestOnly } = s
  return toBase64Url(JSON.stringify({ loan, extras, periods, afterInterestOnly }))
}

/** Decodes a share hash. Hostile or malformed input yields undefined, never a throw. */
export function decodeShare(hash: string): Scenario | undefined {
  try {
    const s = sanitizeScenario(JSON.parse(fromBase64Url(hash)))
    if (!s) return undefined
    // A shared link is a new loan for the receiver, never an update of one of theirs.
    return { ...s, id: uid(), savedAt: new Date().toISOString() }
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

export class ImportError extends Error {}

/** Parses an export file. Entries that cannot be sanitized are dropped; ids are kept so re-import updates instead of duplicating. */
export function parseImport(text: string): Scenario[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ImportError("notExport")
  }
  const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown } | null)?.items
  if (!Array.isArray(items)) throw new ImportError("notExport")
  return items.map((x) => sanitizeScenario(x)).filter((s): s is Scenario => s !== undefined)
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
