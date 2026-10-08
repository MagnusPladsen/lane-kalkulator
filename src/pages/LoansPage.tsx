import { useMemo, useRef, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { CopyIcon, DownloadIcon, FolderOpenIcon, ShieldCheckIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { analyze, todayIso } from "@/lib/loan/engine"
import { fmtDate, fmtDateTime, fmtDuration, fmtMoney, fmtRate } from "@/lib/format"
import { downloadText, exportJson, ImportError, parseImport } from "@/lib/share"
import { trackUsage } from "@/lib/analytics"
import type { Scenario } from "@/lib/loan/types"

export function LoansPage({
  items,
  currentId,
  onOpen,
  onDuplicate,
  onDelete,
  onDeleteAll,
  onImport,
}: {
  items: Scenario[]
  currentId: string
  onOpen: (s: Scenario) => void
  onDuplicate: (s: Scenario) => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
  onImport: (items: Scenario[]) => number
}) {
  const { t } = useTranslation()
  const [confirmAll, setConfirmAll] = useState(false)
  // Kept after closing so the dialog title doesn't flash empty during its exit animation.
  const [toDelete, setToDelete] = useState<Scenario | null>(null)
  const [confirmOneOpen, setConfirmOneOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayIso()

  const sorted = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map((s) => ({ s, a: analyze(s, today) })),
    [items, today],
  )

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setImportedCount(null)
    try {
      const parsed = parseImport(await f.text())
      if (parsed.length === 0) throw new ImportError("empty")
      setImportedCount(onImport(parsed))
      trackUsage("loans_imported")
      setImportError(null)
    } catch (e) {
      setImportError(t(`loans.importError.${e instanceof ImportError ? e.message : "notExport"}`))
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rise flex flex-wrap items-end gap-3">
        <div>
          <h1 className="font-heading text-3xl">{t("loans.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0 ? t("loans.none") : t("loans.count", { count: items.length })}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <UploadIcon data-icon="inline-start" /> {t("loans.import")}
          </Button>
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() => {
              downloadText(`lanekalkulator-${today}.json`, exportJson(items))
              trackUsage("loans_exported")
            }}
          >
            <DownloadIcon data-icon="inline-start" /> {t("loans.export")}
          </Button>
          <Button variant="destructive" disabled={items.length === 0} onClick={() => setConfirmAll(true)}>
            <Trash2Icon data-icon="inline-start" /> {t("loans.deleteAll")}
          </Button>
        </div>
      </div>

      {importError && (
        <p role="alert" className="text-sm text-destructive">
          {importError}
        </p>
      )}
      {importedCount !== null && (
        <p role="status" className="text-sm text-good">
          {t("loans.imported", { count: importedCount })}
        </p>
      )}

      <div className="rise rise-1 flex items-start gap-3 rounded-xl border bg-card/60 px-4 py-3 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="grid gap-0.5">
          <p className="font-medium">{t("loans.privacyTitle")}</p>
          <p className="text-muted-foreground">
            <Trans i18nKey="loans.privacyBody" components={[<span key="0" className="font-medium text-foreground" />]} />
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="rise rise-2">
          <CardContent className="grid place-items-center gap-2 py-12 text-center">
            <FolderOpenIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("loans.emptyHint")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map(({ s, a }, idx) => {
            const name = s.loan.name || t("loans.untitled")
            const changes = s.extras.length + s.periods.length
            const isCurrent = s.id === currentId
            return (
              <li key={s.id}>
                <Card className={`rise rise-${Math.min(4, idx + 1)} h-full`} size="sm">
                  <CardHeader>
                    <h2 className="flex items-center gap-2 font-heading text-base font-medium">
                      <span className="truncate">{name}</span>
                      {isCurrent && <Badge variant="secondary">{t("loans.current")}</Badge>}
                    </h2>
                    <p className="text-xs text-muted-foreground">{t("loans.saved", { date: fmtDateTime(s.savedAt) })}</p>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <Row k={t("loans.amount")} v={fmtMoney(s.loan.principal)} />
                      <Row k={t("loans.rate")} v={`${fmtRate(s.loan.annualRatePct)} %`} />
                      <Row k={t("loans.term")} v={fmtDuration(s.loan.termMonths, t)} />
                      <Row k={t("loans.type")} v={s.loan.loanType === "annuity" ? t("loan.annuity") : t("loan.serial")} />
                      <Row k={t("loans.monthly")} v={a.paidOff ? "–" : fmtMoney(a.scenario.monthlyPayment)} />
                      <Row
                        k={t("loans.paidOff")}
                        v={
                          a.paidOff
                            ? "✓"
                            : a.scenario.payoffDate
                              ? fmtDate(a.scenario.payoffDate)
                              : t("tiles.in", { duration: fmtDuration(a.scenario.months, t) })
                        }
                      />
                      <Row k={t("loans.totalInterest")} v={fmtMoney(a.lifetime.scenario.interest)} />
                      <Row
                        k={t("loans.changes")}
                        v={
                          changes
                            ? `${changes}${
                                Math.abs(a.delta.totalCost) >= 1
                                  ? ` · ${a.delta.totalCost < 0 ? "−" : "+"}${fmtMoney(Math.abs(a.delta.totalCost))}`
                                  : ""
                              }`
                            : t("loans.noChanges")
                        }
                      />
                    </dl>
                    <div className="flex gap-2">
                      <Button onClick={() => onOpen(s)} aria-label={t("loans.openNamed", { name })}>
                        {t("loans.open")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => onDuplicate(s)}
                        aria-label={t("loans.duplicateNamed", { name })}
                      >
                        <CopyIcon data-icon="inline-start" /> {t("loans.duplicate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        aria-label={t("loans.deleteNamed", { name })}
                        onClick={() => {
                          setToDelete(s)
                          setConfirmOneOpen(true)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t("loans.deleteAllTitle")}
        description={t("loans.deleteAllDesc")}
        confirmLabel={t("loans.deleteAllConfirm")}
        onConfirm={onDeleteAll}
      />
      <ConfirmDialog
        open={confirmOneOpen}
        onOpenChange={setConfirmOneOpen}
        title={t("loans.deleteOneTitle", { name: toDelete?.loan.name || t("loans.untitled") })}
        description={t("loans.deleteOneDesc")}
        confirmLabel={t("loans.delete")}
        onConfirm={() => toDelete && onDelete(toDelete.id)}
      />
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-mono tabular-nums">{v}</dd>
    </>
  )
}
