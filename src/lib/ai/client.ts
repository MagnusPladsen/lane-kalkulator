import type { Scenario } from "../loan/types"
import type { AiErrorCode, AiRequest, AiResponse, AiStatus } from "./types"

let statusPromise: Promise<AiStatus> | null = null

/** Whether the AI endpoint is configured. Fails closed: any error means disabled. */
export function aiStatus(): Promise<AiStatus> {
  statusPromise ??= fetch("/api/ai", { headers: { accept: "application/json" } })
    .then(async (r) => (r.ok && r.headers.get("content-type")?.includes("json") ? ((await r.json()) as AiStatus) : { enabled: false }))
    .catch(() => ({ enabled: false }))
  return statusPromise
}

export class AiRequestError extends Error {
  readonly code: AiErrorCode
  constructor(code: AiErrorCode) {
    super(code)
    this.code = code
  }
}

/** Strips anything identifying before the loan leaves the browser. */
export function shareableScenario(s: Scenario): AiRequest["scenario"] {
  const { id: _id, savedAt: _savedAt, ...rest } = s
  return { ...rest, loan: { ...rest.loan, name: "" } }
}

export async function askAi(req: AiRequest, signal?: AbortSignal): Promise<AiResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: AiErrorCode }
    throw new AiRequestError(body.error ?? (res.status === 429 ? "rate_limited" : "upstream"))
  }
  return (await res.json()) as AiResponse
}
