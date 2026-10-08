import { track } from "@vercel/analytics"

/**
 * The only URL analytics ever sees: the site plus "/" or "/loans".
 * The hash can hold a share link with loan details, and the query is never needed,
 * so both are dropped before anything leaves the browser.
 */
export function scrubUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return u.origin + (u.hash.startsWith("#/loans") ? "/loans" : "/")
  } catch {
    return "/"
  }
}

export type UsageEvent = "loan_saved" | "share_link_created" | "loans_imported" | "loans_exported"

/** Anonymous usage count. Never pass loan data here. */
export function trackUsage(event: UsageEvent): void {
  try {
    track(event)
  } catch {
    /* analytics must never break the app */
  }
}
