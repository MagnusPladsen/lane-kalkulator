import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import nb from "./nb.json"
import en from "./en.json"
import pl from "./pl.json"

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
  resources: { nb: { translation: nb }, en: { translation: en }, pl: { translation: pl } },
  lng: storedLang(),
  fallbackLng: "nb",
  interpolation: { escapeValue: false },
  returnNull: false,
})

export function currentLang(): Lang {
  const l = i18n.language.slice(0, 2)
  return l === "en" || l === "pl" ? l : "nb"
}

export function setLang(l: Lang): void {
  void i18n.changeLanguage(l)
  document.documentElement.lang = l
  try {
    localStorage.setItem(LANG_KEY, l)
  } catch {
    /* ignore */
  }
}

document.documentElement.lang = currentLang()

export default i18n
