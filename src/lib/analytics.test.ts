import { describe, expect, it } from "vitest"
import { scrubUrl } from "./analytics"

describe("scrubUrl", () => {
  it("never lets a share link's loan data through", () => {
    expect(scrubUrl("https://lane-kalkulator.pladsen.dev/#/share/eyJsb2FuIjp7InByaW5jaXBhbCI6MjQwMDAwMH19")).toBe(
      "https://lane-kalkulator.pladsen.dev/",
    )
  })
  it("keeps only which page it was", () => {
    expect(scrubUrl("https://lane-kalkulator.pladsen.dev/#/loans")).toBe("https://lane-kalkulator.pladsen.dev/mine-lan")
    expect(scrubUrl("https://lane-kalkulator.pladsen.dev/sammenlign?x=1")).toBe("https://lane-kalkulator.pladsen.dev/sammenlign")
    expect(scrubUrl("https://lane-kalkulator.pladsen.dev/noe-annet/2555951")).toBe("https://lane-kalkulator.pladsen.dev/")
    expect(scrubUrl("https://lane-kalkulator.pladsen.dev/?utm=x#/")).toBe("https://lane-kalkulator.pladsen.dev/")
  })
  it("returns a bare path for anything unparseable", () => {
    expect(scrubUrl("not a url")).toBe("/")
  })
})
