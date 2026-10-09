import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowRightIcon, ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Segmented } from "@/components/fields"
import { RateChart } from "@/components/charts/lazy"
import { SERIES_COLOR } from "@/lib/rateColors"
import { go } from "@/hooks/useRoute"
import { fmtMonthYear, fmtRate } from "@/lib/format"
import { freshRateHistory, latest, rateSnapshot, SERIES, SSB_TABLE_URL, type RateHistory, type SeriesKey } from "@/lib/rateHistory"

const RANGES = { "2": 24, "5": 60, "10": 120 } as const
type Range = keyof typeof RANGES

/** "+0,03" / "−0,07" percentage points. */
function signed(v: number): string {
  const r = Math.round(v * 100) / 100
  return `${r > 0 ? "+" : r < 0 ? "−" : "±"}${fmtRate(Math.abs(r))}`
}

/**
 * "Boliglånsrenten nå": SSB's average rates on new mortgages, floating and fixed, with ten
 * years of history. Prerendered with the figures fetched at build; refreshed in the browser.
 */
export function RatesPage() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<RateHistory | undefined>(rateSnapshot)
  const [failed, setFailed] = useState(false)
  const [range, setRange] = useState<Range>("10")
  const [shown, setShown] = useState<SeriesKey[]>(["floating", "fixed1to3"])

  useEffect(() => {
    const ac = new AbortController()
    freshRateHistory(ac.signal)
      .then((h) => {
        if (h && (!history || h.months.at(-1)! > history.months.at(-1)!)) setHistory(h)
        if (!h && !history) setFailed(true)
      })
      .catch(() => {
        if (!ac.signal.aborted && !history) setFailed(true)
      })
    return () => ac.abort()
    // Only on first show; the snapshot is the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const floating = history ? latest(history, "floating") : undefined

  return (
    <div className="grid gap-5">
      <div className="rise grid gap-1">
        <h1 className="font-heading text-3xl">{t("ratesPage.title")}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{t("ratesPage.lede")}</p>
      </div>

      {!history ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground" role="status">
            {failed ? t("ratesPage.failed") : t("ratesPage.loading")}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            {floating && (
              <Card className="rise rise-1">
                <CardContent className="grid gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("ratesPage.floatingNow")}</p>
                  <p className="font-heading text-5xl font-extrabold tracking-tight">
                    <span className="highlight">{fmtRate(floating.value)} %</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{t("ratesPage.asOf", { month: fmtMonthYear(`${floating.month}-15`) })}</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {floating.change1 !== undefined && (
                      <span className="rounded-full bg-muted px-2.5 py-1">{t("ratesPage.change1", { pp: signed(floating.change1) })}</span>
                    )}
                    {floating.change12 !== undefined && (
                      <span className="rounded-full bg-muted px-2.5 py-1">{t("ratesPage.change12", { pp: signed(floating.change12) })}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="rise rise-2">
              <CardContent className="grid gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("ratesPage.fixedTitle")}</p>
                <dl className="divide-y">
                  {(["fixed1to3", "fixed3to5", "fixedOver5"] as const).map((k) => {
                    const l = latest(history, k)
                    return (
                      <div key={k} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
                        <dt className="min-w-0 flex-1 text-sm">{t(`ratesPage.series.${k}`)}</dt>
                        <dd className="font-mono text-xl font-semibold tabular-nums">{l ? `${fmtRate(l.value)} %` : "–"}</dd>
                        {l?.change12 !== undefined && (
                          <dd className="basis-full text-xs text-muted-foreground">{t("ratesPage.change12", { pp: signed(l.change12) })}</dd>
                        )}
                      </div>
                    )
                  })}
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card className="rise rise-2">
            <CardHeader className="gap-3">
              <h2 className="font-heading text-xl">{t("ratesPage.chartTitle")}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<Range>
                  aria-label={t("ratesPage.range")}
                  className="w-auto"
                  value={range}
                  onChange={setRange}
                  options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: t("ratesPage.years", { count: Number(r) }) }))}
                />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("ratesPage.seriesLabel")}>
                  {SERIES.map((k) => {
                    const on = shown.includes(k)
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setShown(on ? (shown.length > 1 ? shown.filter((x) => x !== k) : shown) : [...shown, k])}
                        className={cn(
                          "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:min-h-10",
                          on ? "border-foreground/40 bg-card font-medium" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <span aria-hidden className={cn("size-2.5 rounded-full", !on && "opacity-40")} style={{ background: SERIES_COLOR[k] }} />
                        {t(`ratesPage.series.${k}`)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <RateChart history={history} shown={shown} months={RANGES[range]} />
            </CardContent>
          </Card>
        </>
      )}

      <Card className="rise rise-3">
        <CardContent className="grid gap-3">
          <h2 className="font-heading text-xl">{t("ratesPage.meaningTitle")}</h2>
          <p className="max-w-prose text-sm leading-relaxed">{t("ratesPage.meaning1")}</p>
          <p className="max-w-prose text-sm leading-relaxed">{t("ratesPage.meaning2")}</p>
          <Button className="w-fit" onClick={() => go("calc")}>
            {t("ratesPage.cta")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t("ratesPage.source")}{" "}
        <a href={SSB_TABLE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2">
          SSB, tabell 10748
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
        . {t("ratesPage.license")}
      </p>
    </div>
  )
}
