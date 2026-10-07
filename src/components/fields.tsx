import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fmtNumber } from "@/lib/format"

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
  optional,
}: {
  label: string
  hint?: React.ReactNode
  error?: string
  htmlFor?: string
  className?: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
        {optional && <span className="ml-auto font-normal normal-case tracking-normal">optional</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/** Text input that shows nb-NO thousands separators and parses back to a number. */
export function MoneyInput({
  value,
  onChange,
  suffix = "kr",
  placeholder,
  id,
  className,
  allowEmpty,
  invalid,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  suffix?: string
  placeholder?: string
  id?: string
  className?: string
  allowEmpty?: boolean
  invalid?: boolean
}) {
  const [focused, setFocused] = React.useState(false)
  const [raw, setRaw] = React.useState("")

  const display = focused
    ? raw
    : value === undefined || Number.isNaN(value)
      ? ""
      : fmtNumber(value)

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={display}
        onFocus={() => {
          setRaw(value === undefined ? "" : String(Math.round(value)))
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "")
          setRaw(digits)
          if (digits === "") onChange(allowEmpty ? undefined : 0)
          else onChange(Number(digits))
        }}
        className="tnum pr-9 font-mono"
      />
      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  id,
  className,
  invalid,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  id?: string
  className?: string
  invalid?: boolean
}) {
  const [text, setText] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const display = focused ? text : Number.isFinite(value) ? String(value) : ""
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        aria-invalid={invalid || undefined}
        value={display}
        onFocus={() => {
          setText(Number.isFinite(value) ? String(value) : "")
          setFocused(true)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value !== "" && Number.isFinite(n)) onChange(n)
        }}
        className={cn("tnum font-mono", suffix && "pr-9")}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("grid h-8 w-full rounded-lg bg-muted p-[3px] text-sm", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-2 font-medium transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-sm dark:bg-input/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
