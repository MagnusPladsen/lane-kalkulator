import { useEffect, useEffectEvent, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/AppShell"
import { ConfirmDialog } from "@/components/ConfirmDialog"
import { SaveDialog } from "@/components/SaveDialog"
import { ShareFallbackDialog } from "@/components/ShareFallbackDialog"
import { CalculatorPage } from "@/pages/CalculatorPage"
import { LoansPage } from "@/pages/LoansPage"
import { ComparePage } from "@/pages/ComparePage"
import { go, useHashRoute } from "@/hooks/useHashRoute"
import { isPristine, loadDraft, newScenario, saveDraft, storageAvailable, useSavedScenarios, useTheme } from "@/lib/storage"
import { decodeShare, shareUrl } from "@/lib/share"
import { scenarioReducer } from "@/lib/scenarioReducer"
import type { Scenario } from "@/lib/loan/types"
import { Telemetry } from "@/components/Telemetry"
import { trackUsage } from "@/lib/analytics"

const SHARE_PREFIX = "#/share/"

type Reason = "share" | "new" | "open"

/** Pulls a shared scenario out of the URL and strips the hash so a reload doesn't re-apply it. */
/** Undefined: no share link in the URL. Null: a share link that could not be read. */
function takeSharedFromHash(): Scenario | null | undefined {
  if (!location.hash.startsWith(SHARE_PREFIX)) return undefined
  const shared = decodeShare(location.hash.slice(SHARE_PREFIX.length))
  history.replaceState(null, "", location.pathname + "#/")
  return shared ?? null
}

const sameContent = (a: Scenario, b: Scenario) =>
  JSON.stringify({ ...a, savedAt: "" }) === JSON.stringify({ ...b, savedAt: "" })

export default function App() {
  const { t } = useTranslation()
  const route = useHashRoute()
  const { theme, toggle } = useTheme()
  const [scenario, dispatch] = useReducer(scenarioReducer, undefined, loadDraft)
  const saved = useSavedScenarios()
  const [saveOpen, setSaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
  const [shareFailed, setShareFailed] = useState(false)
  const [storageOk] = useState(storageAvailable)
  /** A replacement waiting for the user to confirm losing unsaved work. */
  const [pending, setPending] = useState<{ scenario: Scenario; reason: Reason } | null>(null)

  const savedVersion = saved.items.find((s) => s.id === scenario.id)
  const exists = !!savedVersion
  const dirty = exists && !sameContent(savedVersion, scenario)
  const wouldLoseWork = !isPristine(scenario) && (!exists || dirty)

  useEffect(() => {
    saveDraft(scenario)
  }, [scenario])

  /** Swap in another scenario, asking first only when unsaved work would be lost. */
  const requestReplace = (next: Scenario, reason: Reason) => {
    if (wouldLoseWork) {
      setPending({ scenario: next, reason })
      return
    }
    dispatch({ type: "load", scenario: next })
    go("calc")
  }

  const onSharedLink = useEffectEvent((shared: Scenario) => requestReplace(shared, "share"))

  // Share links: on first load and when opened while the app is running.
  useEffect(() => {
    const handle = () => {
      const shared = takeSharedFromHash()
      if (shared) onSharedLink(shared)
      else if (shared === null) setShareFailed(true)
    }
    handle()
    window.addEventListener("hashchange", handle)
    return () => window.removeEventListener("hashchange", handle)
  }, [])

  const copyLink = async () => {
    const url = shareUrl(scenario)
    trackUsage("share_link_created")
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setFallbackUrl(url)
    }
  }

  const saveButton =
    route === "calc" ? (
      exists && !dirty ? (
        <Button variant="outline" onClick={() => setSaveOpen(true)} disabled={!storageOk} title={t("save.savedHint")}>
          <CheckIcon data-icon="inline-start" />
          {t("actions.saved")}
        </Button>
      ) : (
        <Button onClick={() => setSaveOpen(true)} disabled={!storageOk}>
          <SaveIcon data-icon="inline-start" />
          {exists ? t("actions.saveChanges") : t("actions.save")}
        </Button>
      )
    ) : undefined

  return (
    <AppShell
      route={route}
      theme={theme}
      onToggleTheme={toggle}
      saveButton={saveButton}
      onShare={route === "calc" ? copyLink : undefined}
      onNew={route === "calc" ? () => requestReplace(newScenario(), "new") : undefined}
      savedCount={saved.items.length}
    >
      <span role="status" className="sr-only">
        {copied ? t("actions.copied") : ""}
      </span>
      {copied && (
        <p className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {t("actions.copied")}
        </p>
      )}
      {!storageOk && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("storage.off")}
        </p>
      )}
      {shareFailed && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p className="flex-1">{t("share.failed")}</p>
          <Button variant="ghost" size="sm" onClick={() => setShareFailed(false)}>
            {t("share.dismiss")}
          </Button>
        </div>
      )}
      {saved.writeFailed && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("storage.writeFailed")}
        </p>
      )}

      {route === "calc" ? (
        <CalculatorPage key={scenario.id} scenario={scenario} dispatch={dispatch} />
      ) : route === "compare" ? (
        <ComparePage
          scenario={scenario}
          onUseLoan={(loan) => requestReplace({ ...newScenario(), loan: { ...newScenario().loan, ...loan } }, "new")}
        />
      ) : (
        <LoansPage
          items={saved.items}
          currentId={scenario.id}
          onOpen={(s) => requestReplace(s, "open")}
          onDuplicate={(s) => saved.saveAsCopy(s, `${s.loan.name || t("loans.untitled")} ${t("loans.copySuffix")}`)}
          onDelete={saved.remove}
          onDeleteAll={saved.removeAll}
          onImport={saved.importMany}
        />
      )}

      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        initialName={scenario.loan.name}
        exists={exists}
        onSave={(name) => {
          trackUsage("loan_saved")
          dispatch({ type: "load", scenario: saved.save(scenario, name) })
          setSaveOpen(false)
        }}
        onSaveCopy={(name) => {
          trackUsage("loan_saved")
          dispatch({ type: "load", scenario: saved.saveAsCopy(scenario, name) })
          setSaveOpen(false)
        }}
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("replace.title")}
        description={
          pending?.reason === "share"
            ? t("replace.descShare")
            : pending?.reason === "open"
              ? t("replace.descOpen")
              : t("replace.descNew")
        }
        confirmLabel={t("replace.replace")}
        onConfirm={() => {
          if (pending) dispatch({ type: "load", scenario: pending.scenario })
          setPending(null)
          go("calc")
        }}
      />
      <ShareFallbackDialog url={fallbackUrl} onOpenChange={(o) => !o && setFallbackUrl(null)} />
      <Telemetry route={route} />
    </AppShell>
  )
}
