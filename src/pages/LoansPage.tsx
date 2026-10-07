import { useMemo, useRef, useState } from "react"
import { CopyIcon, DownloadIcon, FolderOpenIcon, ShieldCheckIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { analyze, todayIso } from "@/lib/loan/engine"
import { fmtDate, fmtDuration, fmtMoney } from "@/lib/format"
import { downloadText, exportJson, parseImport } from "@/lib/share"
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
  onImport: (items: Scenario[]) => void
}) {
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmOne, setConfirmOne] = useState<Scenario | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const today = todayIso()

  const sorted = useMemo(() => [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt)), [items])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const parsed = parseImport(await f.text())
      if (parsed.length === 0) throw new Error("No loans in that file")
      onImport(parsed)
      setImportError(null)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Could not read that file")
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rise flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl">My loans</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length === 0 ? "Nothing saved yet." : `${items.length} saved in this browser.`}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <UploadIcon data-icon="inline-start" /> Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={items.length === 0}
            onClick={() => downloadText(`lane-kalkulator-${today}.json`, exportJson(items))}
          >
            <DownloadIcon data-icon="inline-start" /> Export all
          </Button>
          <Button variant="destructive" size="sm" disabled={items.length === 0} onClick={() => setConfirmAll(true)}>
            <Trash2Icon data-icon="inline-start" /> Delete all
          </Button>
        </div>
      </div>

      {importError && <p className="text-sm text-destructive">{importError}</p>}

      <div className="rise rise-1 flex items-start gap-3 rounded-xl border bg-card/60 px-4 py-3 text-sm">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="grid gap-0.5">
          <p className="font-medium">Private by design</p>
          <p className="text-muted-foreground">
            Nothing you type is collected, tracked or sent anywhere. Loans are stored only in this browser's local
            storage. Clearing site data removes them, so use <span className="font-medium text-foreground">Export</span>{" "}
            to keep a backup or move between devices.
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card className="rise rise-2">
          <CardContent className="grid place-items-center gap-2 py-12 text-center">
            <FolderOpenIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Save a loan from the calculator and it shows up here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((s, idx) => {
            const a = analyze(s, today)
            const changes = s.extras.length + s.interestOnly.length
            const isCurrent = s.id === currentId
            return (
              <Card key={s.id} className={`rise rise-${Math.min(4, idx + 1)}`} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="truncate">{s.loan.name || "Untitled"}</span>
                    {isCurrent && <Badge variant="secondary">open</Badge>}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Saved {fmtDate(s.savedAt.slice(0, 10))}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <Row k="Amount" v={fmtMoney(s.loan.principal)} />
                    <Row k="Rate" v={`${s.loan.annualRatePct.toLocaleString("nb-NO")} %`} />
                    <Row k="Term" v={fmtDuration(s.loan.termMonths)} />
                    <Row k="Type" v={s.loan.loanType === "annuity" ? "Annuity" : "Serial"} />
                    <Row k="Monthly" v={fmtMoney(a.scenario.monthlyPayment)} />
                    <Row k="Paid off" v={a.scenario.payoffDate ? fmtDate(a.scenario.payoffDate) : `in ${fmtDuration(a.scenario.months)}`} />
                    <Row k="Total interest" v={fmtMoney(a.scenario.totalInterest)} />
                    <Row
                      k="Changes"
                      v={
                        changes
                          ? `${s.extras.length} extra · ${s.interestOnly.length} pause${
                              a.delta.totalCost ? ` · ${a.delta.totalCost < 0 ? "−" : "+"}${fmtMoney(Math.abs(a.delta.totalCost))}` : ""
                            }`
                          : "none"
                      }
                    />
                  </dl>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => onOpen(s)}>
                      Open
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onDuplicate(s)} aria-label="Duplicate">
                      <CopyIcon data-icon="inline-start" /> Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                      onClick={() => setConfirmOne(s)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Delete all saved loans?"
        description="This removes every saved loan from this browser. There is no undo, so export first if in doubt."
        confirmLabel="Delete everything"
        onConfirm={onDeleteAll}
      />
      <ConfirmDialog
        open={confirmOne !== null}
        onOpenChange={(o) => !o && setConfirmOne(null)}
        title={`Delete "${confirmOne?.loan.name ?? ""}"?`}
        description="Removes this loan from the browser. No undo."
        onConfirm={() => confirmOne && onDelete(confirmOne.id)}
      />
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tnum text-right font-mono">{v}</dd>
    </>
  )
}
