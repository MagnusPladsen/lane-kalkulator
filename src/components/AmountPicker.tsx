import { useId } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui/slider"
import { fmtMoney } from "@/lib/format"

/**
 * Quick-pick amounts and a slider for an amount that also has a typed field above it.
 * Typing stays the precise way in; this is for trying values fast.
 */
export function AmountPicker({
  value,
  onChange,
  presets,
  max,
  step,
  label,
}: {
  value: number
  onChange: (v: number) => void
  presets: number[]
  max: number
  step: number
  /** Accessible name for the slider. */
  label: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const top = Math.max(max, value)
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1" role="group" aria-label={t("amounts.quick")}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={cn(
              "min-h-8 cursor-pointer rounded-full border px-2.5 font-mono text-sm tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:min-h-10",
              value === p ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
            )}
          >
            {fmtMoney(p)}
          </button>
        ))}
      </div>
      <span id={id} className="sr-only">
        {label}
      </span>
      <Slider
        aria-labelledby={id}
        min={0}
        max={top}
        step={step}
        value={[Math.min(value, top)]}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        className="py-2.5 [&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-track]]:h-2"
      />
    </div>
  )
}
