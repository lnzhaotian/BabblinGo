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

  it("supports string audio paths and filename-based media", () => {
    const modules = [
      { id: "1", title: "A", audio: "https://cdn/a.mp3" },
      { id: "2", title: "B", audio: { filename: "/media/b.mp3" } },
      { id: "3", /* no title */ audio: null },
    ] as any

    const resolver = (media: any) => {
      if (!media) return null
      if (typeof media === 'string') return media
      if (media.url) return media.url
      if (media.filename) return media.filename
      return null
    }

    const hasAudio = computeHasAudio(modules, resolver)
    expect(hasAudio).toEqual([true, true, false])

    const cachedMedia: Record<string, string> = {
      "https://cdn/a.mp3": "/cache/a.mp3",
    }

    const slideAudio = computeSlideAudio(modules, cachedMedia, resolver)
    expect(slideAudio).toEqual([
      { id: "1", title: "A", audioUrl: "/cache/a.mp3" },
      { id: "2", title: "B", audioUrl: "/media/b.mp3" },
      { id: "3", title: "", audioUrl: null },
    ])
  })
})
