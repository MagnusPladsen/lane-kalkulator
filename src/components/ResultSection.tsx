import { useId, useState, type ReactNode } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A closed-by-default result row: title and a one-line summary, opening to the detail.
 * Keeps the page calm; only what the user opens is shown (and rendered).
 */
export function ResultSection({
  title,
  summary,
  defaultOpen = false,
  className,
  children,
}: {
  title: string
  summary?: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className={cn("rounded-2xl bg-card shadow-(--card-shadow)", className)}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-base font-semibold">{title}</span>
            {summary && !open && (
              <span className="block truncate font-sans text-sm font-normal tracking-normal text-muted-foreground">{summary}</span>
            )}
          </span>
          <ChevronDownIcon className={cn("size-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={id} className="px-4 pb-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      )}
    </section>
  )
}
