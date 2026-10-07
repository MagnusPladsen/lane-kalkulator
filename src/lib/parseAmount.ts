export type AmountLocale = "nb" | "en" | "pl"

/**
 * Reads a typed or pasted amount. Spaces are always grouping. When both "." and ","
 * appear, the last one is the decimal mark. A lone separator followed by exactly three
 * digits is grouping unless it is this language's decimal mark ("1.500" is 1500 in
 * Norwegian, "1,500" is 1500 in English). Repeated separators are grouping.
 */
export function parseAmount(input: string, locale: AmountLocale): number | undefined {
  const s = input.replace(/[\s  ']/g, "").replace(/[^\d.,]/g, "")
  if (!/\d/.test(s)) return undefined
  const commas = (s.match(/,/g) ?? []).length
  const dots = (s.match(/\./g) ?? []).length
  const last = Math.max(s.lastIndexOf(","), s.lastIndexOf("."))

  let decimal: "," | "." | null = null
  if (commas && dots) {
    decimal = s[last] as "," | "."
  } else if (commas + dots === 1) {
    const sep = commas ? "," : "."
    const localeDecimal = locale === "en" ? "." : ","
    const digitsAfter = s.length - last - 1
    decimal = digitsAfter === 3 && sep !== localeDecimal ? null : sep
  }

  let normalized: string
  if (decimal) {
    const i = s.lastIndexOf(decimal)
    normalized = s.slice(0, i).replace(/[.,]/g, "") + "." + s.slice(i + 1).replace(/[.,]/g, "")
  } else {
    normalized = s.replace(/[.,]/g, "")
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : undefined
}
