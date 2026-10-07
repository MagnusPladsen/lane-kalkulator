import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { currentLang, INTL_LOCALE } from "@/i18n"
import { fmtNumber } from "@/lib/format"
import { parseAmount } from "@/lib/parseAmount"

interface FieldContextValue {
  id: string
  labelId: string
  describedBy?: string
  invalid: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

/** Gives the control inside a Field its id, label and description wiring. */
function useField() {
  return React.useContext(FieldContext)
}

export function Field({
  label,
  hint,
  error,
  className,
  children,
  optional,
  optionalLabel,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string
  className?: string
  optional?: boolean
  optionalLabel?: string
  children: React.ReactNode
}) {
  const id = React.useId()
  const labelId = `${id}-label`
  const msgId = `${id}-msg`
  const value = React.useMemo(
    () => ({ id, labelId, describedBy: error || hint ? msgId : undefined, invalid: !!error }),
    [id, labelId, msgId, error, hint],
  )
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label id={labelId} htmlFor={id} className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
        {optional && (
          <span className="ml-auto font-normal tracking-normal normal-case">{optionalLabel}</span>
        )}
      </Label>
      <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
      {error ? (
        <p id={msgId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Plain text/date input wired to the surrounding Field. */
export function FieldInput(props: React.ComponentProps<typeof Input>) {
  const f = useField()
  return (
    <Input
      id={f?.id}
      aria-describedby={f?.describedBy}
      aria-invalid={f?.invalid || undefined}
      {...props}
    />
  )
}

function selectSoon(el: HTMLInputElement) {
  // Wait for the focused (raw) value to render, then select it so typing replaces it.
  requestAnimationFrame(() => {
    if (document.activeElement === el) el.select()
  })
}

/** Whole-krone amount with thousands separators. Accepts "1 000,50" and rounds to whole kroner. */
export function MoneyInput({
  value,
  onChange,
  suffix = "kr",
  placeholder,
  className,
  allowEmpty,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  suffix?: string
  placeholder?: string
  className?: string
  allowEmpty?: boolean
  disabled?: boolean
  "aria-label"?: string
}) {
  const f = useField()
  const [focused, setFocused] = React.useState(false)
  const [raw, setRaw] = React.useState("")

  const display = focused
    ? raw
    : value === undefined || !Number.isFinite(value)
      ? ""
      : fmtNumber(value)

  return (
    <div className={cn("relative", className)}>
      <Input
        id={ariaLabel ? undefined : f?.id}
        aria-label={ariaLabel}
        aria-describedby={f?.describedBy}
        aria-invalid={f?.invalid || undefined}
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={display}
        onFocus={(e) => {
          setRaw(value === undefined || !Number.isFinite(value) ? "" : String(Math.round(value)))
          setFocused(true)
          selectSoon(e.currentTarget)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          // Show what was typed; read it with the language's separators (see parseAmount).
          const next = e.target.value.replace(/[^\d\s\u00a0\u202f.,]/g, "")
          setRaw(next)
          const n = parseAmount(next, currentLang())
          if (n === undefined) onChange(allowEmpty ? undefined : 0)
          else onChange(Math.round(n))
        }}
        className="pr-9 font-mono tabular-nums"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground"
      >
        {suffix}
      </span>
    </div>
  )
}

function fmtDecimal(n: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[currentLang()], {
    maximumFractionDigits: 4,
    useGrouping: false,
  }).format(n)
}

/**
 * Number field as a text input with a numeric keyboard. Avoids type="number" so a
 * comma decimal works on every mobile keyboard and the mouse wheel never changes it.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  integer,
  className,
  "aria-label": ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  suffix?: string
  integer?: boolean
  className?: string
  "aria-label"?: string
}) {
  const f = useField()
  const [text, setText] = React.useState("")
  const [focused, setFocused] = React.useState(false)
  const display = focused ? text : Number.isFinite(value) ? fmtDecimal(value) : ""
  return (
    <div className={cn("relative", className)}>
      <Input
        id={ariaLabel ? undefined : f?.id}
        aria-label={ariaLabel}
        aria-describedby={ariaLabel ? undefined : f?.describedBy}
        aria-invalid={f?.invalid || undefined}
        inputMode={integer ? "numeric" : "decimal"}
        autoComplete="off"
        value={display}
        onFocus={(e) => {
          setText(Number.isFinite(value) ? fmtDecimal(value) : "")
          setFocused(true)
          selectSoon(e.currentTarget)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const re = integer ? /[^\d]/g : /[^\d.,]/g
          const next = e.target.value.replace(re, "")
          setText(next)
          const n = Number(next.replace(",", "."))
          if (next !== "" && Number.isFinite(n)) onChange(integer ? Math.round(n) : n)
        }}
        className={cn("font-mono tabular-nums", suffix && "pr-12")}
      />
      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground"
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

/**
 * Single-choice segmented control with real radio semantics:
 * one tab stop, arrow keys move and select, Home/End jump.
 */
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
  const f = useField()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const idx = Math.max(0, options.findIndex((o) => o.value === value))

  const move = (to: number) => {
    const n = (to + options.length) % options.length
    onChange(options[n].value)
    refs.current[n]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : f?.labelId}
      aria-describedby={f?.describedBy}
      className={cn("grid w-full rounded-lg bg-muted p-[3px] text-sm", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") move(idx + 1)
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(idx - 1)
        else if (e.key === "Home") move(0)
        else if (e.key === "End") move(options.length - 1)
        else return
        e.preventDefault()
      }}
    >
      {options.map((o, i) => {
        const active = i === idx
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            data-slot="segmented-item"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-8 cursor-pointer rounded-md px-2 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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

/** Card section heading: a real h2 so the page has an outline. */
export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("font-heading text-lg leading-snug font-medium", className)}>{children}</h2>
}

const selectClass =
  "h-9 min-w-0 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 [@media(pointer:coarse)]:h-11"

/**
 * Calendar month picker ("YYYY-MM") built from two native selects, which work the same
 * in every browser (type="month" does not exist in desktop Firefox or Safari).
 */
export function MonthPicker({
  value,
  onChange,
  minYear,
  maxYear,
  monthLabel,
  yearLabel,
}: {
  value: string
  onChange: (ym: string) => void
  minYear: number
  maxYear: number
  monthLabel: string
  yearLabel: string
}) {
  const f = useField()
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const monthNames = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(INTL_LOCALE[currentLang()], { month: "long", timeZone: "UTC" })
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))))
  }, [])
  const lo = Math.min(minYear, year)
  const hi = Math.max(maxYear, year)
  const years = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
  const emit = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, "0")}`)

  return (
    <div
      role="group"
      aria-labelledby={f?.labelId}
      aria-describedby={f?.describedBy}
      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-1.5"
    >
      <select
        id={f?.id}
        aria-label={monthLabel}
        aria-invalid={f?.invalid || undefined}
        className={cn(selectClass, "capitalize")}
        value={month}
        onChange={(e) => emit(year, Number(e.target.value))}
      >
        {monthNames.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label={yearLabel}
        aria-invalid={f?.invalid || undefined}
        className={cn(selectClass, "font-mono tabular-nums")}
        value={year}
        onChange={(e) => emit(Number(e.target.value), month)}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Groups several controls under one Field label, e.g. term years + months. */
export function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const f = useField()
  return (
    <div role="group" aria-labelledby={f?.labelId} aria-describedby={f?.describedBy} className={className}>
      {children}
    </div>
  )
}
