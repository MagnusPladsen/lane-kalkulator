import { describe, expect, it } from "vitest"
import { routeOf } from "./useRoute"

describe("routeOf", () => {
  it("maps paths and old hash routes to pages", () => {
    expect(routeOf("/")).toBe("calc")
    expect(routeOf("/sammenlign")).toBe("compare")
    expect(routeOf("/sammenlign/")).toBe("compare")
    expect(routeOf("/mine-lan")).toBe("loans")
    expect(routeOf("/", "#/compare")).toBe("compare")
    expect(routeOf("/", "#/loans")).toBe("loans")
    expect(routeOf("/", "#/share/abc")).toBe("calc")
    expect(routeOf("/finnes-ikke")).toBe("calc")
  })
})
