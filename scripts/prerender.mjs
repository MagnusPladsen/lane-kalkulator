// Writes one ready HTML file per page after `vite build`: the rendered app inside #root,
// the page's own title, description, canonical URL and social tags, and JSON-LD.
// Run by `bun run build`; needs dist/ (client) and dist-ssr/ (server entry).
import { readFileSync, writeFileSync } from "node:fs"

const { render, ROUTE_META, SITE_NAME, SITE_URL, CALC_FAQ, COMPARE_FAQ } = await import("../dist-ssr/entry-server.js")
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

const pages = [
  { route: "calc", file: "dist/index.html", ld: [app, faq(CALC_FAQ)] },
  { route: "compare", file: "dist/sammenlign.html", ld: [faq(COMPARE_FAQ)] },
  { route: "loans", file: "dist/mine-lan.html", ld: [] },
]

for (const { route, file, ld } of pages) {
  const m = ROUTE_META[route]
  const url = SITE_URL + m.path
  let html = template
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(m.description)}" />`)
  html = setTag(html, /<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${m.index ? "index, follow" : "noindex, follow"}" />`)
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`)
  html = setTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`)
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(m.title)}" />`)
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${esc(m.description)}" />`)
  if (ld.length) html = html.replace("</head>", `    ${ld.map(jsonLd).join("\n    ")}\n  </head>`)
  html = setTag(html, /<div id="root"><\/div>/, `<div id="root">${await render(route)}</div>`)
  writeFileSync(file, html)
  console.log(`prerendered ${m.path} -> ${file} (${Math.round(html.length / 1024)} kB)`)
}

// Unknown addresses get a real 404 status with the calculator shown, never indexed.
let notFound = readFileSync("dist/index.html", "utf8")
notFound = notFound.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, follow" />')
writeFileSync("dist/404.html", notFound)
console.log("wrote dist/404.html")
