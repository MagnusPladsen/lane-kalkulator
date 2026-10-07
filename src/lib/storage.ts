import { useCallback, useEffect, useState } from "react"
import { uid } from "./ids"
import type { Scenario } from "./loan/types"

const DRAFT_KEY = "lane-kalkulator:draft"
const LIST_KEY = "lane-kalkulator:scenarios"
const THEME_KEY = "lane-kalkulator:theme"
const VERSION = 1

interface Envelope<T> {
  v: number
  data: T
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
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
      name: "My mortgage",
      principal: 3_000_000,
      annualRatePct: 5.5,
      termMonths: 25 * 12,
      loanType: "annuity",
      monthlyFee: 0,
    },
    extras: [],
    interestOnly: [],
    afterInterestOnly: "keep-term",
  }
}

export function loadDraft(): Scenario {
  const d = read<Scenario>(DRAFT_KEY)
  return d ?? newScenario()
}

export function saveDraft(s: Scenario): void {
  write(DRAFT_KEY, s)
}

export function storageAvailable(): boolean {
  try {
    const k = "__lk_probe__"
    localStorage.setItem(k, "1")
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

export function useSavedScenarios() {
  const [items, setItems] = useState<Scenario[]>(() => read<Scenario[]>(LIST_KEY) ?? [])

  useEffect(() => {
    write(LIST_KEY, items)
  }, [items])

  const save = useCallback((s: Scenario, name: string): Scenario => {
    const next: Scenario = {
      ...s,
      loan: { ...s.loan, name },
      savedAt: new Date().toISOString(),
    }
    setItems((prev) => {
      const i = prev.findIndex((p) => p.id === s.id)
      if (i === -1) return [next, ...prev]
      const copy = prev.slice()
      copy[i] = next
      return copy
    })
    return next
  }, [])

  const saveAsCopy = useCallback(
    (s: Scenario, name: string): Scenario => save({ ...s, id: uid() }, name),
    [save],
  )

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { items, save, saveAsCopy, remove }
}

export type Theme = "light" | "dark"

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === "light" || t === "dark") return t
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), [])
  return { theme, toggle }
}
