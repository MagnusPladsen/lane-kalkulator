import { useCallback, useEffect, useState } from "react"
import { uid } from "./ids"
import { sanitizeScenario } from "./loan/sanitize"
import type { Scenario } from "./loan/types"

const DRAFT_KEY = "lane-kalkulator:draft"
const LIST_KEY = "lane-kalkulator:scenarios"
const BACKUP_KEY = "lane-kalkulator:scenarios.unreadable"
const THEME_KEY = "lane-kalkulator:theme"
const VERSION = 1

interface Envelope<T> {
  v: number
  data: T
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Returns the stored payload, or undefined when missing, unparsable or from another version. */
function read<T>(key: string): T | undefined {
  const raw = readRaw(key)
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Envelope<T>
    if (parsed?.v !== VERSION) return undefined
    return parsed.data
  } catch {
    return undefined
  }
}

function write<T>(key: string, data: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, data } satisfies Envelope<T>))
    return true
  } catch {
    return false
  }
}

export function newScenario(): Scenario {
  return {
    id: uid(),
    savedAt: new Date().toISOString(),
    loan: {
      name: "",
      principal: 3_000_000,
      annualRatePct: 5.5,
      termMonths: 25 * 12,
      loanType: "annuity",
      monthlyFee: 0,
      dayCount: "act/act",
    },
    extras: [],
    periods: [],
    afterInterestOnly: "keep-term",
  }
}

/** True when the draft is still the untouched default (safe to replace without asking). */
export function isPristine(s: Scenario): boolean {
  const d = newScenario()
  return JSON.stringify({ ...s, id: "", savedAt: "" }) === JSON.stringify({ ...d, id: "", savedAt: "" })
}

export function loadDraft(): Scenario {
  return sanitizeScenario(read<unknown>(DRAFT_KEY)) ?? newScenario()
}

export function saveDraft(s: Scenario): void {
  write(DRAFT_KEY, s)
}

export function storageAvailable(): boolean {
  // Prerendering has no browser storage; the real check runs again in the browser.
  if (typeof window === "undefined") return true
  try {
    const k = "__lk_probe__"
    localStorage.setItem(k, "1")
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

/** Wipes everything this app stored. Used by the error boundary's reset. */
/** Drops only the working draft. Saved loans, backups and settings stay. */
export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

function readList(): Scenario[] {
  const data = read<unknown>(LIST_KEY)
  if (data === undefined) {
    // Keep whatever was there so a newer or corrupt payload is never silently destroyed.
    const raw = readRaw(LIST_KEY)
    if (raw && !readRaw(BACKUP_KEY)) {
      try {
        localStorage.setItem(BACKUP_KEY, raw)
      } catch {
        /* ignore */
      }
    }
    return []
  }
  if (!Array.isArray(data)) return []
  return data.map((x) => sanitizeScenario(x)).filter((s): s is Scenario => s !== undefined)
}

export function useSavedScenarios() {
  const [items, setItems] = useState<Scenario[]>(readList)
  const [writeFailed, setWriteFailed] = useState(false)

  // Another tab saved or deleted something: pick it up instead of overwriting it later.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LIST_KEY || e.key === null) setItems(readList())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const commit = useCallback((next: Scenario[]) => {
    setItems(next)
    setWriteFailed(!write(LIST_KEY, next))
  }, [])

  const save = useCallback(
    (s: Scenario, name: string): Scenario => {
      const next: Scenario = { ...s, loan: { ...s.loan, name }, savedAt: new Date().toISOString() }
      const current = readList()
      const i = current.findIndex((p) => p.id === s.id)
      if (i === -1) commit([next, ...current])
      else {
        const copy = current.slice()
        copy[i] = next
        commit(copy)
      }
      return next
    },
    [commit],
  )

  const saveAsCopy = useCallback(
    (s: Scenario, name: string): Scenario => save({ ...s, id: uid() }, name),
    [save],
  )

  /** Import keeps ids, so re-importing the same backup updates rather than duplicates. */
  const importMany = useCallback(
    (incoming: Scenario[]): number => {
      const current = readList()
      const byId = new Map(current.map((s) => [s.id, s]))
      for (const s of incoming) byId.set(s.id, s)
      commit([...byId.values()])
      return incoming.length
    },
    [commit],
  )

  const remove = useCallback(
    (id: string) => commit(readList().filter((p) => p.id !== id)),
    [commit],
  )

  const removeAll = useCallback(() => commit([]), [commit])

  return { items, writeFailed, save, saveAsCopy, importMany, remove, removeAll }
}

export type Theme = "light" | "dark"

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === "light" || t === "dark") return t
  } catch {
    /* ignore */
  }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])
  // Only an explicit toggle is a user choice worth persisting; the OS default is not.
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark"
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return { theme, toggle }
}
