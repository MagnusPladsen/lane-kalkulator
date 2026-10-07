import { useCallback, useEffect, useReducer, useState } from "react"
import { CheckIcon, LinkIcon, PlusIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/AppShell"
import { SaveDialog } from "@/components/SaveDialog"
import { CalculatorPage } from "@/pages/CalculatorPage"
import { LoansPage } from "@/pages/LoansPage"
import { useHashRoute } from "@/hooks/useHashRoute"
import { uid } from "@/lib/ids"
import { loadDraft, newScenario, saveDraft, storageAvailable, useSavedScenarios, useTheme } from "@/lib/storage"
import { decodeShare, shareUrl } from "@/lib/share"
import { scenarioReducer } from "@/lib/scenarioReducer"
import type { Scenario } from "@/lib/loan/types"

function initialDraft(): Scenario {
  if (location.hash.startsWith("#/share/")) {
    const shared = decodeShare(location.hash.slice("#/share/".length))
    if (shared) {
      history.replaceState(null, "", location.pathname + "#/")
      return shared
    }
  }
  return loadDraft()
}

export default function App() {
  const [route, go] = useHashRoute()
  const { theme, toggle } = useTheme()
  const [scenario, dispatch] = useReducer(scenarioReducer, undefined, initialDraft)
  const saved = useSavedScenarios()
  const [saveOpen, setSaveOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [storageOk] = useState(storageAvailable)

  useEffect(() => {
    saveDraft(scenario)
  }, [scenario])

  // A share link opened while the app is already running (hash change, no reload).
  useEffect(() => {
    const onHash = () => {
      if (!location.hash.startsWith("#/share/")) return
      const shared = decodeShare(location.hash.slice("#/share/".length))
      history.replaceState(null, "", location.pathname + "#/")
      if (shared) dispatch({ type: "load", scenario: shared })
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  const exists = saved.items.some((s) => s.id === scenario.id)
  const savedVersion = saved.items.find((s) => s.id === scenario.id)
  const dirty = exists && JSON.stringify({ ...savedVersion, savedAt: "" }) !== JSON.stringify({ ...scenario, savedAt: "" })

  const onSave = useCallback(
    (name: string) => {
      const next = saved.save(scenario, name)
      dispatch({ type: "load", scenario: next })
      setSaveOpen(false)
    },
    [saved, scenario],
  )
  const onSaveCopy = useCallback(
    (name: string) => {
      const next = saved.saveAsCopy(scenario, name)
      dispatch({ type: "load", scenario: next })
      setSaveOpen(false)
    },
    [saved, scenario],
  )

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(scenario))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      prompt("Copy this link", shareUrl(scenario))
    }
  }

  const actions =
    route === "calc" ? (
      <>
        <Button variant="ghost" size="sm" onClick={copyLink} aria-label="Copy share link">
          {copied ? <CheckIcon data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dispatch({ type: "reset", scenario: newScenario() })}
          aria-label="New loan"
        >
          <PlusIcon data-icon="inline-start" />
          <span className="hidden sm:inline">New</span>
        </Button>
        <Button size="sm" onClick={() => setSaveOpen(true)} disabled={!storageOk}>
          <SaveIcon data-icon="inline-start" />
          {exists ? (dirty ? "Save changes" : "Saved") : "Save"}
        </Button>
      </>
    ) : null

  return (
    <AppShell route={route} go={go} theme={theme} onToggleTheme={toggle} actions={actions} savedCount={saved.items.length}>
      {!storageOk && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          This browser blocks local storage, so saving is off. The calculator still works.
        </p>
      )}
      {route === "calc" ? (
        <CalculatorPage scenario={scenario} dispatch={dispatch} />
      ) : (
        <LoansPage
          items={saved.items}
          currentId={scenario.id}
          onOpen={(s) => {
            dispatch({ type: "load", scenario: s })
            go("calc")
          }}
          onDuplicate={(s) => saved.saveAsCopy(s, `${s.loan.name} (copy)`)}
          onDelete={saved.remove}
          onDeleteAll={() => saved.items.forEach((s) => saved.remove(s.id))}
          onImport={(items) => items.forEach((s) => saved.save({ ...s, id: uid() }, s.loan.name))}
        />
      )}
      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        initialName={scenario.loan.name}
        exists={exists}
        onSave={onSave}
        onSaveCopy={onSaveCopy}
      />
    </AppShell>
  )
}
