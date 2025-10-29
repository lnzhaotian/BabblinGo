import { useMemo } from "react"
import { resolveMediaUrl } from "@/lib/payload"
import { computeHasAudio as _computeHasAudio, computeSlideAudio as _computeSlideAudio } from "@/hooks/slide-audio-helpers"

export type SlideAudioItem = {
  id: string
  title: string
  audioUrl: string | null
}

export { _computeHasAudio as computeHasAudio, _computeSlideAudio as computeSlideAudio }

export function useSlideAudio(
  modules: { id: string; title?: string; audio?: unknown }[],
  cachedMedia: Record<string, string>
) {
  const hasAudio = useMemo(() => _computeHasAudio(modules, resolveMediaUrl), [modules])
  const slideAudio = useMemo(
    () => _computeSlideAudio(modules, cachedMedia, resolveMediaUrl),
    [modules, cachedMedia]
  )
  return { hasAudio, slideAudio }
}
