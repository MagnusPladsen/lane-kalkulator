// Writes one ready HTML file per page after `vite build`: the rendered app inside #root,
// the page's own title, description, canonical URL and social tags, and JSON-LD.
// Run by `bun run build`; needs dist/ (client) and dist-ssr/ (server entry).
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"

const {
  render,
  ROUTE_META,
  TYPE_META,
  LANG_META,
  TYPE_PATH,
  LANG_PATH,
  SITE_NAME,
  SITE_URL,
  CALC_FAQ,
  COMPARE_FAQ,
  fetchRateHistory,
  setRateSnapshot,
} = await import(
  "../dist-ssr/entry-server.js"
)

// Mortgage rates for /renter, baked into the page. If SSB is unreachable the page fetches in the browser.
const rates = await fetchRateHistory().catch(() => undefined)
setRateSnapshot(rates)
console.log(rates ? `rates: ${rates.months.length} months to ${rates.months.at(-1)}` : "rates: SSB unreachable, page will fetch live")
const nb = JSON.parse(readFileSync(new URL("../src/i18n/nb.json", import.meta.url), "utf8"))
const template = readFileSync("dist/index.html", "utf8")

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`

function setTag(html, re, replacement) {
  if (!re.test(html)) throw new Error(`prerender: tag not found: ${re}`)
  return html.replace(re, replacement)
}

const app = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL + "/",
  description: ROUTE_META.calc.description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  inLanguage: "nb",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "NOK" },
}
const faq = (ids) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ids.map((id) => ({
    "@type": "Question",
    name: nb.faq.items[id].q,
    acceptedAnswer: { "@type": "Answer", text: nb.faq.items[id].a },
  })),
})

const dataset = rates && {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Renter på nye boliglån til husholdninger",
  description: ROUTE_META.rates.description,
  url: SITE_URL + ROUTE_META.rates.path,
  isBasedOn: "https://www.ssb.no/statbank/table/10748",
  creator: { "@type": "Organization", name: "Statistisk sentralbyrå", url: "https://www.ssb.no" },
  license: "https://creativecommons.org/licenses/by/4.0/",
  temporalCoverage: `${rates.months[0]}/${rates.months.at(-1)}`,
  inLanguage: "nb",
}

const appFor = (description, url, inLanguage = "nb") => ({ ...app, description, url, inLanguage })
// The calculator exists in three languages; each version lists the others for search engines.
const langAlternates = [
  ["nb", SITE_URL + "/"],
  ["en", SITE_URL + LANG_PATH.en],
  ["pl", SITE_URL + LANG_PATH.pl],
  ["x-default", SITE_URL + "/"],
]
const meta = (m) => ({ title: m.title, description: m.description, index: m.index ?? true })

const pages = [
  { path: "/", file: "dist/index.html", meta: meta(ROUTE_META.calc), ld: [app, faq(CALC_FAQ)], alternates: langAlternates },
  { path: "/sammenlign", file: "dist/sammenlign.html", meta: meta(ROUTE_META.compare), ld: [faq(COMPARE_FAQ)] },
  {
    path: "/renter",
    file: "dist/renter.html",
    meta: meta(ROUTE_META.rates),
    ld: dataset ? [dataset] : [],
    data: rates && { id: "rate-snapshot", value: rates },
  },
  { path: "/mine-lan", file: "dist/mine-lan.html", meta: meta(ROUTE_META.loans), ld: [] },
  ...Object.entries(TYPE_PATH).map(([category, path]) => ({
    path,
    file: `dist${path}.html`,
    meta: meta(TYPE_META[category]),
    ld: [appFor(TYPE_META[category].description, SITE_URL + path)],
  })),
  ...Object.entries(LANG_PATH).map(([lang, path]) => ({
    path,
    file: `dist${path}.html`,
    meta: meta(LANG_META[lang]),
    lang,
    locale: LANG_META[lang].locale,
    ld: [appFor(LANG_META[lang].description, SITE_URL + path, lang)],
    alternates: langAlternates,
  })),
]

for (const { path, file, meta: m, ld, data, lang, locale, alternates } of pages) {
  const url = SITE_URL + path
  let html = template
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(m.description)}" />`)
  html = setTag(html, /<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${m.index ? "index, follow" : "noindex, follow"}" />`)
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
  html = setTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(m.title)}" />`)
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(m.description)}" />`)
  if (lang) {
    html = setTag(html, /<html lang="nb">/, `<html lang="${lang}">`)
    html = setTag(html, /<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${locale}" />`)
  }
  const head = [
    ...(alternates ?? []).map(([hl, href]) => `<link rel="alternate" hreflang="${hl}" href="${href}" />`),
    ...ld.map(jsonLd),
  ]
  if (head.length) html = html.replace("</head>", `    ${head.join("\n    ")}\n  </head>`)
  const embedded = data
    ? `\n    <script id="${data.id}" type="application/json">${JSON.stringify(data.value).replace(/</g, "\\u003c")}</script>`
    : ""
  html = setTag(html, /<div id="root"><\/div>/, `<div id="root">${await render(path)}</div>${embedded}`)
  writeFileSync(file, html)
  console.log(`prerendered ${path} -> ${file} (${Math.round(html.length / 1024)} kB)`)
}

// Unknown addresses get a real 404 status with the calculator shown, never indexed.
let notFound = readFileSync("dist/index.html", "utf8")
notFound = notFound.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, follow" />')
writeFileSync("dist/404.html", notFound)
console.log("wrote dist/404.html")

// Offline: a service worker that stores the pages above plus the built code, styles and
// Latin fonts. Its build id changes whenever any of those files change.
const assets = readdirSync("dist/assets")
  .filter((f) => /\.(js|css)$/.test(f) || /(latin|latin-ext)-wght-normal-.*\.woff2$/.test(f))
  .map((f) => `/assets/${f}`)
const precache = [...pages.filter((p) => p.meta.index).map((p) => p.path), ...assets]
const build = createHash("sha256").update(precache.join("|") + readFileSync("dist/index.html", "utf8")).digest("hex").slice(0, 12)
const sw = readFileSync(new URL("./sw.template.js", import.meta.url), "utf8")
  .replace('"__BUILD__"', JSON.stringify(build))
  .replace("__PRECACHE__", JSON.stringify(precache))
writeFileSync("dist/sw.js", sw)
console.log(`wrote dist/sw.js (${precache.length} files, build ${build})`)
