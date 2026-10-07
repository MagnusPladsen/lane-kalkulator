import type { ReactNode } from "react"
import { CalculatorIcon, FolderIcon, MoonIcon, ShieldCheckIcon, SunIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Route } from "@/hooks/useHashRoute"
import type { Theme } from "@/lib/storage"

export function AppShell({
  route,
  go,
  theme,
  onToggleTheme,
  actions,
  savedCount,
  children,
}: {
  route: Route
  go: (r: Route) => void
  theme: Theme
  onToggleTheme: () => void
  actions?: ReactNode
  savedCount: number
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-6">
      <header className="flex flex-wrap items-center gap-3 py-5">
        <button
          type="button"
          onClick={() => go("calc")}
          className="group flex items-baseline gap-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-md"
        >
          <span className="font-heading text-2xl italic tracking-tight">Lånekalkulator</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">what your loan really costs</span>
        </button>

        <nav className="order-last flex w-full gap-1 sm:order-none sm:ml-6 sm:w-auto" aria-label="Pages">
          <NavButton active={route === "calc"} onClick={() => go("calc")}>
            <CalculatorIcon /> Calculator
          </NavButton>
          <NavButton active={route === "loans"} onClick={() => go("loans")}>
            <FolderIcon /> My loans
            {savedCount > 0 && (
              <span className="tnum ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px] font-semibold">{savedCount}</span>
            )}
          </NavButton>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {actions}
          <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={onToggleTheme}>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
        </div>
      </header>

      <main className="flex-1 pb-10">{children}</main>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t py-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5" />
          Nothing is collected or sent anywhere. Your loans live only in this browser.
        </span>
        <span className="ml-auto">Estimates only. Your bank's numbers are the ones that count.</span>
      </footer>
    </div>
  )
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
