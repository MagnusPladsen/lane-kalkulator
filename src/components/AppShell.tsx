import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  CalculatorIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  GlobeIcon,
  LinkIcon,
  MoonIcon,
  PlusIcon,
  ShieldCheckIcon,
  SunIcon,
  ScaleIcon,
  TrendingUpIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { go, LANG_PATH, ROUTE_HREF, TYPE_PATH, type Route } from "@/hooks/useRoute"
import type { LoanCategory } from "@/lib/loan/types"
import { LANGUAGES, setLang, currentLang, type Lang } from "@/i18n"
import type { Theme } from "@/lib/storage"

export function AppShell({
  route,
  theme,
  onToggleTheme,
  saveButton,
  onShare,
  onNew,
  savedCount,
  children,
}: {
  route: Route
  theme: Theme
  onToggleTheme: () => void
  /** Primary action shown in the header on the calculator page. */
  saveButton?: ReactNode
  onShare?: () => void
  onNew?: () => void
  savedCount: number
  children: ReactNode
}) {
  const { t } = useTranslation()
  const lang = currentLang()
  const langItems = LANGUAGES.map((l) => ({ value: l, label: t(`lang.${l}`) }))

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-6">
      <button
        type="button"
        className="sr-only-focusable fixed top-2 left-2 z-50 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
        onClick={() => document.getElementById("main")?.focus()}
      >
        {t("app.skip")}
      </button>

      <header className="app-header flex items-center gap-2 py-3 sm:gap-3 sm:py-5">
        <a
          href={ROUTE_HREF.calc}
          data-route="calc"
          className="flex min-w-0 items-center gap-2.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden className="size-7 shrink-0 rounded-full bg-highlight shadow-[inset_0_0_0_4px_var(--primary)]" />
          <span className="truncate font-heading text-xl font-extrabold tracking-tight sm:text-2xl">{t("app.title")}</span>
          <span className="hidden text-xs text-muted-foreground lg:inline">{t("app.tagline")}</span>
        </a>

        <nav className="ml-4 hidden gap-1 rounded-full border bg-card p-1 sm:flex" aria-label={t("nav.label")}>
          <NavLink route="calc" active={route === "calc"}>
            <CalculatorIcon /> {t("nav.calculator")}
          </NavLink>
          <NavLink route="compare" active={route === "compare"}>
            <ScaleIcon /> {t("nav.compare")}
          </NavLink>
          <NavLink route="loans" active={route === "loans"}>
            <FolderIcon /> {t("nav.loans")}
            {savedCount > 0 && <CountPill n={savedCount} />}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <Select items={langItems} value={lang} onValueChange={(v) => v && setLang(v as Lang)}>
              <SelectTrigger aria-label={t("lang.label")} className="gap-1.5">
                <GlobeIcon className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {langItems.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saveButton}

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={t("a11y.moreMenu")} />}>
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {(onShare || onNew) && (
                <>
                  <DropdownMenuGroup>
                    {onShare && (
                      <DropdownMenuItem onClick={onShare}>
                        <LinkIcon /> {t("actions.copyLink")}
                      </DropdownMenuItem>
                    )}
                    {onNew && (
                      <DropdownMenuItem onClick={onNew}>
                        <PlusIcon /> {t("actions.newLoan")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => go("rates")}>
                <TrendingUpIcon /> {t("rates.pageLink")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleTheme}>
                {theme === "dark" ? <SunIcon /> : <MoonIcon />} {t("theme.toggle")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("lang.label")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={lang} onValueChange={(v) => setLang(v as Lang)}>
                  {langItems.map((l) => (
                    <DropdownMenuRadioItem key={l.value} value={l.value} lang={l.value}>
                      {l.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex-1 pb-36 outline-none sm:pb-10">
        {children}
      </main>

      <footer className="mb-20 flex flex-wrap items-center gap-x-4 gap-y-1 border-t py-4 text-xs text-muted-foreground sm:mb-0">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5 shrink-0" aria-hidden />
          {t("footer.privacy")}
        </span>
        <a href={ROUTE_HREF.rates} data-route="rates" className="underline-offset-2 hover:underline">
          {t("rates.pageLink")}
        </a>
        <span className="sm:ml-auto">{t("footer.estimates")}</span>
        {/* Plain links (full page loads) so each page opens with its own starting loan and language. */}
        <nav aria-label={t("footer.calculators")} className="flex basis-full flex-wrap gap-x-3 gap-y-1">
          <span>{t("footer.calculators")}:</span>
          {(Object.keys(TYPE_PATH) as LoanCategory[]).map((c) => (
            <a key={c} href={TYPE_PATH[c]} className="underline-offset-2 hover:underline">
              {t(`rates.${c}`)}
            </a>
          ))}
          <a href={LANG_PATH.en} hrefLang="en" lang="en" className="underline-offset-2 hover:underline">
            English
          </a>
          <a href={LANG_PATH.pl} hrefLang="pl" lang="pl" className="underline-offset-2 hover:underline">
            Polski
          </a>
        </nav>
      </footer>

      {/* Phone navigation: thumb-reachable, always visible. */}
      <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
        <nav
          aria-label={t("nav.label")}
          className="grid grid-cols-3 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        >
          <TabLink route="calc" active={route === "calc"}>
            <CalculatorIcon /> {t("nav.calculator")}
          </TabLink>
          <TabLink route="compare" active={route === "compare"}>
            <ScaleIcon /> {t("nav.compare")}
          </TabLink>
          <TabLink route="loans" active={route === "loans"}>
            <span className="relative">
              <FolderIcon />
              {savedCount > 0 && (
                <span className="absolute -top-1.5 -right-3">
                  <CountPill n={savedCount} />
                </span>
              )}
            </span>
            {t("nav.loans")}
          </TabLink>
        </nav>
      </div>
    </div>
  )
}

function CountPill({ n }: { n: number }) {
  return (
    <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold tabular-nums">{n}</span>
  )
}

function NavLink({ route, active, children }: { route: Route; active: boolean; children: ReactNode }) {
  return (
    <a
      href={ROUTE_HREF[route]}
      data-route={route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </a>
  )
}

function TabLink({ route, active, children }: { route: Route; active: boolean; children: ReactNode }) {
  return (
    <a
      href={ROUTE_HREF[route]}
      data-route={route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:bg-muted [&_svg]:size-5",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {children}
    </a>
  )
}
