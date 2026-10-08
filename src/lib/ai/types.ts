import type { CalendarExtra, CustomPeriod, LoanInput, Scenario } from "../loan/types.js"

/** What the browser sends. Never contains the loan's name. */
export interface AiRequest {
  mode: "chat" | "parse" | "rates"
  /** Conversation so far, oldest first. User text only from the user. */
  messages: { role: "user" | "assistant"; content: string }[]
  /** The loan in the calculator, without name or id. */
  scenario?: Omit<Scenario, "id" | "savedAt">
  /** Which page or field the question came from, e.g. "field:effectiveRatePct". */
  focus?: string
  /** UI language for the answer. */
  lang: "nb" | "en" | "pl"
  /** "parse": pasted loan text. "rates": loan category to look up. */
  text?: string
  category?: string
}

/** A change the user can apply with one click. Always produced through a tool, never free text. */
export type Suggestion =
  | { kind: "extra"; label: string; extra: Omit<CalendarExtra, "id"> }
  | { kind: "period"; label: string; period: Omit<CustomPeriod, "id"> }
  | { kind: "loan"; label: string; patch: Partial<LoanInput> }

export interface AiSource {
  url: string
  title: string
}

export interface AiResponse {
  reply: string
  suggestions: Suggestion[]
  sources?: AiSource[]
  /** Token totals for this turn; cached shows whether the prompt prefix was reused. */
  usage?: { input: number; cached: number; output: number; rounds: number; model?: string }
}

/** simple: a field's "Ask AI" button or reading pasted text. advanced: the chat and web rate lookup. */
export type AiTier = "simple" | "advanced"

export interface AiStatus {
  enabled: boolean
  models?: Record<AiTier, string>
}

export type AiErrorCode = "disabled" | "rate_limited" | "bad_request" | "upstream" | "too_long"
