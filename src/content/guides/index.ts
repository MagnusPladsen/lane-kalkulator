import ekstra from "./betale-ekstra-pa-lanet.json"
import effektiv from "./effektiv-og-nominell-rente.json"
import forhandle from "./forhandle-boliglansrenten.json"
import avdragsfrihet from "./avdragsfrihet.json"

/**
 * Plain-language guides (Norwegian). Every figure was computed with the app's own engine;
 * each file's "figures" list records the scenario behind it, so it can be re-checked.
 */
export interface Guide {
  slug: string
  title: string
  description: string
  updated: string
  intro: string
  sections: { heading: string; paragraphs?: string[]; bullets?: string[] }[]
  cta: { text: string; path: string }
  sources: { title: string; url: string }[]
}

export const GUIDES: Guide[] = [ekstra, effektiv, forhandle, avdragsfrihet]

export const guideBySlug = (slug: string): Guide | undefined => GUIDES.find((g) => g.slug === slug)
