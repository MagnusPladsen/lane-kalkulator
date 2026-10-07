/** Month index within the forward plan → ISO date of that payment. */
export type MonthDate = (month: number) => string

export function clampMonth(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)))
}
