import type { ReactNode } from "react"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{children}</p>
  )
}

/** One editable row (an extra payment, a pause, a rate period) with a labelled remove button. */
export function ItemBox({
  children,
  onRemove,
  removeLabel,
  header,
}: {
  children: ReactNode
  onRemove: () => void
  removeLabel: string
  header?: ReactNode
}) {
  return (
    <div className="grid gap-3 rounded-xl border bg-background/50 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{header}</div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      {children}
    </div>
  )
}
