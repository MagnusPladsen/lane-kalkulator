import { useTranslation } from "react-i18next"
import { InfoIcon, TriangleAlertIcon } from "lucide-react"
import type { Timing } from "./timing"

export function TimingHint({ timing }: { timing: Timing }) {
  const { t } = useTranslation()
  if (timing === "ok") return null
  const Icon = timing === "pinnedPast" ? InfoIcon : TriangleAlertIcon
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      {t(`timing.${timing}`)}
    </p>
  )
}
