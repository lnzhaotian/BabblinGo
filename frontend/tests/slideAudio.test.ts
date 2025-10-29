import { describe, it, expect } from "vitest"
import { computeHasAudio, computeSlideAudio } from "@/hooks/slide-audio-helpers"

// Minimal stub for resolveMediaUrl pathing is baked into helpers via import

describe("useSlideAudio helpers", () => {
  it("computes hasAudio correctly", () => {
    const modules = [
      { id: "1", title: "A", audio: { url: "https://cdn/a.mp3" } },
      { id: "2", title: "B", audio: null },
      { id: "3", title: "C" },
    ] as any
    const mockResolver = (media: any) => (media && media.url ? media.url : null)
    const hasAudio = computeHasAudio(modules, mockResolver)
    expect(hasAudio).toEqual([true, false, false])
  })

  it("maps slideAudio and substitutes cached urls when available", () => {
    const modules = [
      { id: "1", title: "A", audio: { url: "https://cdn/a.mp3" } },
      { id: "2", title: "B", audio: { url: "https://cdn/b.mp3" } },
      { id: "3", title: "C", audio: null },
    ] as any
    const cachedMedia: Record<string, string> = {
      "https://cdn/a.mp3": "/cache/a.mp3",
    }

    const mockResolver = (media: any) => (media && media.url ? media.url : null)
    const slideAudio = computeSlideAudio(modules, cachedMedia, mockResolver)
    expect(slideAudio).toEqual([
      { id: "1", title: "A", audioUrl: "/cache/a.mp3" },
      { id: "2", title: "B", audioUrl: "https://cdn/b.mp3" },
      { id: "3", title: "C", audioUrl: null },
    ])
  })

  it("handles empty modules array", () => {
    const modules: any[] = []
    const cachedMedia = {}
    const resolver = (m: any) => (m && m.url ? m.url : null)
    expect(computeHasAudio(modules, resolver)).toEqual([])
    expect(computeSlideAudio(modules, cachedMedia, resolver)).toEqual([])
  })
})
