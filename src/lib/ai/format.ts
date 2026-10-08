/**
 * Turns an AI answer into a few safe blocks for the chat bubble. Only a tiny subset is
 * understood: blank-line paragraphs, "- " bullet lines and **bold**. Everything else stays
 * plain text, and nothing is ever rendered as HTML.
 */
export interface Span {
  text: string
  bold: boolean
}
export type Block = { kind: "p"; spans: Span[] } | { kind: "ul"; items: Span[][] }

const NBSP = " "

/**
 * Keeps numbers readable when the bubble wraps: "2 555 952 kr" never splits across lines,
 * and neither do "4,63 %", "79 kr" or "nov. 2026".
 */
export function keepTogether(text: string): string {
  return text
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
    .replace(/(\d) (?=(kr|%|mnd\.?|måneder|år|months|years|zł)(?![\p{L}]))/gu, `$1${NBSP}`)
    .replace(/(\b\p{L}{3,4}\.?) (?=\d{4}\b)/gu, `$1${NBSP}`)
}

function spans(line: string): Span[] {
  const out: Span[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false })
    out.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false })
  return out.map((s) => ({ ...s, text: keepTogether(s.text.replace(/\*\*/g, "")) }))
}

const BULLET = /^[ \t]*(?:[-*•–]|\d+[.)])[ \t]+/

export function parseReply(text: string): Block[] {
  const blocks: Block[] = []
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim())
    let para: string[] = []
    let list: Span[][] = []
    const flushPara = () => {
      if (para.length) blocks.push({ kind: "p", spans: spans(para.join(" ")) })
      para = []
    }
    const flushList = () => {
      if (list.length) blocks.push({ kind: "ul", items: list })
      list = []
    }
    for (const l of lines) {
      if (BULLET.test(l)) {
        flushPara()
        list.push(spans(l.replace(BULLET, "")))
      } else {
        flushList()
        para.push(l.trim())
      }
    }
    flushPara()
    flushList()
  }
  return blocks
}
