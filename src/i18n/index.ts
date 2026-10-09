import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import nb from "./nb.json"

export const LANGUAGES = ["nb", "en", "pl"] as const
export type Lang = (typeof LANGUAGES)[number]
import { LANG_KEY } from "@/lib/keys"
export { LANG_KEY }

/** BCP 47 tags used for Intl formatting per UI language. Currency stays NOK everywhere. */
export const INTL_LOCALE: Record<Lang, string> = { nb: "nb-NO", en: "en-GB", pl: "pl-PL" }

function storedLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY)
    if (v === "nb" || v === "en" || v === "pl") return v
  } catch {
    /* ignore */
  }
  return "nb"
}

void i18n.use(initReactI18next).init({
  // Norwegian ships with the page; English and Polish load when chosen.
  resources: { nb: { translation: nb } },
  lng: "nb",
  fallbackLng: "nb",
  interpolation: { escapeValue: false },
  returnNull: false,
  // Resources are bundled, so start synchronously: the first render never waits.
  initAsync: false,
})

export function currentLang(): Lang {
  const l = i18n.language.slice(0, 2)
  return l === "en" || l === "pl" ? l : "nb"
}

const LOADERS: Record<Exclude<Lang, "nb">, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("./en.json"),
  pl: () => import("./pl.json"),
}

async function ensureLang(l: Lang): Promise<void> {
  if (l === "nb" || i18n.hasResourceBundle(l, "translation")) return
  const { default: res } = await LOADERS[l]()
  i18n.addResourceBundle(l, "translation", res, true, true)
}

/** Loads and switches to the stored language, if not Norwegian. Await before the first render. */
/** /en and /pl are the calculator in that language for search; the address wins over the saved choice. */
function pathLang(): Lang | undefined {
  if (typeof location === "undefined") return undefined
  const p = location.pathname.replace(/\/+$/, "")
  return p === "/en" ? "en" : p === "/pl" ? "pl" : undefined
}

export async function initLang(): Promise<void> {
  const l = pathLang() ?? storedLang()
  if (l === "nb") return
  try {
    await ensureLang(l)
    await i18n.changeLanguage(l)
    document.documentElement.lang = l
  } catch {
    /* stay on Norwegian if the file cannot load */
  }
}

export function setLang(l: Lang): void {
  void ensureLang(l).then(() => i18n.changeLanguage(l))
  document.documentElement.lang = l
  try {
    localStorage.setItem(LANG_KEY, l)
  } catch {
    /* ignore */
  }
}

if (typeof document !== "undefined") document.documentElement.lang = currentLang()

export default i18n
