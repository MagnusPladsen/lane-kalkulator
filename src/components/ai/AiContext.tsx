import { createContext, useContext } from "react"
import type { Suggestion } from "@/lib/ai/types"

export interface AiApi {
  enabled: boolean
  /** Opens the chat, optionally sending a first question about a field or page. */
  ask: (opts?: { question?: string; focus?: string }) => void
  /** Asks the AI to read pasted loan text; resolves with what it found. */
  parse: (text: string) => Promise<Suggestion[]>
  /** Asks the AI to look up today's typical rate for a loan type (opens the chat with the answer). */
  lookupRate: (category: string) => void
}

export const AiContext = createContext<AiApi>({
  enabled: false,
  ask: () => {},
  parse: async () => [],
  lookupRate: () => {},
})

export const useAi = () => useContext(AiContext)
