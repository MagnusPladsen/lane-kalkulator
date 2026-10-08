import { useTranslation } from "react-i18next"
import { ChevronDownIcon } from "lucide-react"

import type { FaqId } from "@/lib/faq"

/**
 * Plain questions and answers below the tools. Native <details> keeps every answer in the
 * page for search engines and screen readers, and works without JavaScript.
 */
export function Faq({ ids, titleKey = "faq.title" }: { ids: readonly FaqId[]; titleKey?: string }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="faq-heading" className="mt-10 grid gap-3">
      <h2 id="faq-heading" className="font-heading text-2xl">
        {t(titleKey)}
      </h2>
      <div className="divide-y rounded-xl border bg-card">
        {ids.map((id) => (
          <details key={id} className="group px-4">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-3 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              <h3 className="flex-1 text-base">{t(`faq.items.${id}.q`)}</h3>
              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <p className="max-w-prose pb-4 leading-relaxed text-muted-foreground">{t(`faq.items.${id}.a`)}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
