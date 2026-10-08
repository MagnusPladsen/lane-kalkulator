import { Fragment } from "react"
import { parseReply, type Span } from "@/lib/ai/format"

function Line({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.bold ? (
          <strong key={i} className="font-semibold">
            {s.text}
          </strong>
        ) : (
          <Fragment key={i}>{s.text}</Fragment>
        ),
      )}
    </>
  )
}

/** An assistant answer: short paragraphs, bullet lists and bold key figures. */
export function AiMessage({ text }: { text: string }) {
  return (
    <div className="grid gap-2">
      {parseReply(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            <Line spans={b.spans} />
          </p>
        ) : (
          <ul key={i} className="grid list-disc gap-1 pl-4 marker:text-muted-foreground">
            {b.items.map((item, j) => (
              <li key={j} className="pl-0.5">
                <Line spans={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  )
}
