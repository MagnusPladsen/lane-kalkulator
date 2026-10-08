import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CircleHelpIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** A small "?" that explains a field in plain words, on hover or tap. No AI involved. */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        aria-label={t("help.aria", { field: label })}
        className="inline-grid size-5 cursor-help place-items-center rounded-full text-muted-foreground/80 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:size-7"
      >
        <CircleHelpIcon className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-72 text-xs leading-relaxed">
        <p className="font-medium normal-case">{label}</p>
        <p className="text-muted-foreground normal-case">{children}</p>
      </PopoverContent>
    </Popover>
  )
}
