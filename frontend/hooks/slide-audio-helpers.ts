export type SlideAudioItem = {
  id: string
  title: string
  audioUrl: string | null
}

export function computeHasAudio(
  modules: { id: string; title?: string; audio?: unknown }[],
  resolver: (media: any) => string | null
) {
  return modules.map((m) => Boolean(resolver((m as any).audio)))
}

export function computeSlideAudio(
  modules: { id: string; title?: string; audio?: unknown }[],
  cachedMedia: Record<string, string>,
  resolver: (media: any) => string | null
): SlideAudioItem[] {
  return modules.map((m) => {
    const audioUrl = resolver((m as any).audio)
    const displayAudioUrl = audioUrl && cachedMedia[audioUrl] ? cachedMedia[audioUrl] : audioUrl
    return {
      id: m.id,
      title: (m.title ?? "") as string,
      audioUrl: displayAudioUrl,
    }
  })
}
