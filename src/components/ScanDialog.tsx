import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ImageUpIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fmtDate, fmtDuration, fmtMoney, fmtRate } from "@/lib/format"
import { todayIso } from "@/lib/loan/engine"
import type { LoanInput } from "@/lib/loan/types"
import { parseLoanText, type ScannedLoan } from "@/lib/scan/parseLoanText"
import { scanToLoan, type DerivedKey } from "@/lib/scan/scanToLoan"

type Stage = { kind: "pick" } | { kind: "reading"; file: number; files: number; progress: number } | { kind: "review" } | { kind: "error" }

/** Fields shown for review, in form order. */
const FIELDS = [
  "name",
  "principal",
  "annualRatePct",
  "effectiveRatePct",
  "loanType",
  "startDate",
  "termMonths",
  "remainingBalance",
  "monthlyFee",
] as const satisfies readonly (keyof LoanInput)[]
type FieldKey = (typeof FIELDS)[number]

/** Where each field was read from in the scan, for the "source" line. */
const SOURCE: Partial<Record<FieldKey, keyof ScannedLoan>> = {
  name: "lender",
  principal: "principal",
  annualRatePct: "nominalRatePct",
  effectiveRatePct: "effectiveRatePct",
  loanType: "loanType",
  startDate: "startDate",
  termMonths: "endDate",
  remainingBalance: "currentBalance",
  monthlyFee: "fee",
}

/**
 * Reads loan details from bank screenshots with text recognition that runs in the
 * browser (Tesseract). Nothing is uploaded; the language data is fetched from a CDN.
 */
export function ScanDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onApply: (patch: Partial<LoanInput>) => void
}) {
  const { t } = useTranslation()
  const [stage, setStage] = useState<Stage>({ kind: "pick" })
  const [scan, setScan] = useState<ScannedLoan | null>(null)
  const [checked, setChecked] = useState<Set<FieldKey>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const proposal = useMemo(() => (scan ? scanToLoan(scan, todayIso()) : null), [scan])
  const found = FIELDS.filter((k) => proposal?.patch[k] !== undefined)

  const reset = () => {
    setStage({ kind: "pick" })
    setScan(null)
  }

  const read = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"))
    if (images.length === 0) return
    setStage({ kind: "reading", file: 1, files: images.length, progress: 0 })
    try {
      const { createWorker } = await import("tesseract.js")
      let current = 1
      const worker = await createWorker(["nor", "eng"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text")
            setStage({ kind: "reading", file: current, files: images.length, progress: m.progress })
        },
      })
      const texts: string[] = []
      for (const [i, img] of images.entries()) {
        current = i + 1
        texts.push((await worker.recognize(img)).data.text)
      }
      await worker.terminate()
      const result = parseLoanText(texts.join("\n"))
      const p = scanToLoan(result, todayIso())
      setScan(result)
      setChecked(new Set(FIELDS.filter((k) => p.patch[k] !== undefined)))
      setStage({ kind: "review" })
    } catch {
      setStage({ kind: "error" })
    }
  }

  // Paste a screenshot straight from the clipboard while the dialog is open.
  useEffect(() => {
    if (!open || stage.kind !== "pick") return
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])]
      if (files.length) {
        e.preventDefault()
        void read(files)
      }
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  })

  const label: Record<FieldKey, string> = {
    name: t("loan.name"),
    principal: t("loan.amount"),
    annualRatePct: t("loan.rate"),
    effectiveRatePct: t("loan.bankEffective"),
    loanType: t("loan.type"),
    startDate: t("loan.startDate"),
    termMonths: t("loan.term"),
    remainingBalance: t("loan.remaining"),
    monthlyFee: t("loan.fee"),
  }
  const show = (k: FieldKey, v: unknown): string => {
    switch (k) {
      case "principal":
      case "remainingBalance":
      case "monthlyFee":
        return fmtMoney(v as number)
      case "annualRatePct":
      case "effectiveRatePct":
        return `${fmtRate(v as number)} %`
      case "loanType":
        return v === "annuity" ? t("loan.annuity") : t("loan.serial")
      case "startDate":
        return fmtDate(v as string)
      case "termMonths":
        return fmtDuration(v as number, t)
      default:
        return String(v)
    }
  }
  const derivedNote: Record<string, string> = {
    dueDay: t("scan.derivedDueDay", { day: scan?.dueDay?.value }),
    endDate: t("scan.derivedEndDate"),
    remainingMonths: t("scan.derivedRemaining"),
    termAmount: t("scan.derivedFee"),
    currentBalance: t("scan.derivedBalance"),
    lender: t("scan.derivedName"),
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("scan.title")}</DialogTitle>
          <DialogDescription>{t("scan.desc")}</DialogDescription>
        </DialogHeader>

        {stage.kind === "pick" && (
          <div
            className="grid place-items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              void read([...e.dataTransfer.files])
            }}
          >
            <ImageUpIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm">{t("scan.drop")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void read([...(e.target.files ?? [])])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              {t("scan.choose")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("scan.tip")}</p>
          </div>
        )}

        {stage.kind === "reading" && (
          <div role="status" className="grid place-items-center gap-3 py-6 text-sm">
            <LoaderCircleIcon className="size-6 animate-spin text-muted-foreground" aria-hidden />
            <p>{t("scan.reading", { n: stage.file, total: stage.files })}</p>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(stage.progress * 100)}%` }} />
            </div>
          </div>
        )}

        {stage.kind === "error" && <p role="alert" className="text-sm text-destructive">{t("scan.error")}</p>}

        {stage.kind === "review" && proposal && (
          <div className="grid gap-2">
            {found.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("scan.nothing")}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t("scan.review")}</p>
                <ul className="grid max-h-[50vh] gap-1.5 overflow-y-auto">
                  {found.map((k) => {
                    const how = proposal.derived[k as DerivedKey]
                    const src = SOURCE[k] && scan?.[SOURCE[k]!]
                    const source = how ? derivedNote[how] : src && typeof src === "object" ? src.source : undefined
                    return (
                      <li key={k}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 has-checked:border-primary/40 has-checked:bg-accent/40">
                          <input
                            type="checkbox"
                            className="mt-1 size-4 accent-(--primary)"
                            checked={checked.has(k)}
                            onChange={(e) => {
                              const next = new Set(checked)
                              if (e.target.checked) next.add(k)
                              else next.delete(k)
                              setChecked(next)
                            }}
                          />
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                              <span className="text-xs tracking-wide text-muted-foreground uppercase">{label[k]}</span>
                              <span className="font-mono text-sm font-medium tabular-nums">{show(k, proposal.patch[k])}</span>
                            </span>
                            {source && <span className="truncate text-xs text-muted-foreground">{source}</span>}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheckIcon className="size-3.5 shrink-0" aria-hidden />
          {t("scan.privacy")}
        </p>

        <DialogFooter>
          {stage.kind === "review" || stage.kind === "error" ? (
            <Button variant="outline" onClick={reset}>
              {t("scan.again")}
            </Button>
          ) : null}
          {stage.kind === "review" && found.length > 0 && (
            <Button
              disabled={checked.size === 0}
              onClick={() => {
                const patch: Partial<LoanInput> = {}
                for (const k of checked) (patch as Record<string, unknown>)[k] = proposal!.patch[k]
                onApply(patch)
                reset()
                onOpenChange(false)
              }}
            >
              {t("scan.apply", { count: checked.size })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
