import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeftIcon, ArrowRightIcon, BookOpenIcon, ExternalLinkIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { currentLang } from "@/i18n"
import { currentPath, guideSlugOfPath, ROUTE_HREF } from "@/hooks/useRoute"
import { fmtDate } from "@/lib/format"
import { GUIDES, guideBySlug, type Guide } from "@/content/guides"
import { ROUTE_META } from "@/lib/seo"
import { keepTogether } from "@/lib/ai/format"

/** /guider lists the guides; /guider/<slug> shows one. Content is Norwegian only. */
export function GuidesPage() {
  const slug = guideSlugOfPath(currentPath())
  const guide = slug ? guideBySlug(slug) : undefined
  return guide ? <Article guide={guide} /> : <List />
}

function NorwegianOnly() {
  const { t } = useTranslation()
  if (currentLang() === "nb") return null
  return <p className="rounded-2xl bg-muted px-3.5 py-2.5 text-sm">{t("guides.norwegianOnly")}</p>
}

function List() {
  const { t } = useTranslation()
  return (
    <div className="grid max-w-3xl gap-5">
      <div className="rise grid gap-1">
        <h1 className="font-heading text-3xl">{t("guides.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("guides.lede")}</p>
      </div>
      <NorwegianOnly />
      <ul className="grid gap-3">
        {GUIDES.map((g, i) => (
          <li key={g.slug}>
            <a
              href={`${ROUTE_HREF.guides}/${g.slug}`}
              className={cn(
                `rise rise-${Math.min(4, i + 1)}`,
                "group grid gap-1 rounded-2xl bg-card px-5 py-4 shadow-(--card-shadow) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              <span className="flex items-center gap-2 font-heading text-lg font-semibold group-hover:underline">
                <BookOpenIcon className="size-4 shrink-0 text-primary" aria-hidden />
                {g.title}
              </span>
              <span className="text-sm text-muted-foreground">{g.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Article({ guide }: { guide: Guide }) {
  const { t } = useTranslation()
  // Client-side arrivals get the guide's own title and description too.
  useEffect(() => {
    document.title = `${guide.title} | Lånekalkulator`
    document.head.querySelector('meta[name="description"]')?.setAttribute("content", guide.description)
    return () => {
      document.title = ROUTE_META.guides.title
    }
  }, [guide])

  return (
    <article className="grid max-w-prose gap-5">
      <a
        href={ROUTE_HREF.guides}
        className="inline-flex w-fit items-center gap-1.5 rounded-full text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeftIcon className="size-4" aria-hidden />
        {t("guides.all")}
      </a>
      <header className="grid gap-2">
        <h1 className="font-heading text-3xl leading-tight text-balance sm:text-4xl">{guide.title}</h1>
        <p className="text-xs text-muted-foreground">{t("guides.updated", { date: fmtDate(guide.updated) })}</p>
      </header>
      <NorwegianOnly />
      <p className="text-lg leading-relaxed">{keepTogether(guide.intro)}</p>
      {guide.sections.map((s) => (
        <section key={s.heading} className="grid gap-2.5">
          <h2 className="font-heading text-2xl">{s.heading}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="leading-relaxed">
              {keepTogether(p)}
            </p>
          ))}
          {s.bullets && (
            <ul className="grid list-disc gap-1.5 pl-5 leading-relaxed marker:text-muted-foreground">
              {s.bullets.map((b) => (
                <li key={b}>{keepTogether(b)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{t("guides.try")}</p>
          <a href={guide.cta.path} className={buttonVariants()}>
            {guide.cta.text}
            <ArrowRightIcon data-icon="inline-end" />
          </a>
        </CardContent>
      </Card>
      <section aria-labelledby="sources-h" className="grid gap-2 border-t pt-4 text-sm">
        <h2 id="sources-h" className="font-heading text-lg">
          {t("guides.sources")}
        </h2>
        <ul className="grid gap-1.5">
          {guide.sources.map((src) => (
            <li key={src.url}>
              <a href={src.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 underline underline-offset-2">
                {src.title}
                <ExternalLinkIcon className="mt-1 size-3 shrink-0" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("guides.disclaimer")}</p>
      </section>
    </article>
  )
}
