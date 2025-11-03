export type SlideAudioItem = {
  id: string
  title: string
  audioUrl: string | null
}

type AudioLikeModule = {
  id: string
  title?: string
  audio?: unknown
  type?: string
  audioPlaylist?: {
    tracks?: { audio?: unknown; title?: string }[] | null
  } | null
}

export function computeHasAudio(
  modules: AudioLikeModule[],
  resolver: (media: any) => string | null
) {
  return modules.map((m) => {
    if (m.type && m.type !== "audioSlideshow") {
      return true
    }

    if (resolver((m as any).audio)) {
      return true
    }

    const tracks = m.audioPlaylist?.tracks ?? []
    return tracks.some((track) => Boolean(resolver(track?.audio)))
  })
}

export function computeSlideAudio(
  modules: AudioLikeModule[],
  cachedMedia: Record<string, string>,
  resolver: (media: any) => string | null
): SlideAudioItem[] {
  return modules.map((m) => {
    let audioUrl = resolver((m as any).audio)
    let title = (m.title ?? "") as string

    if (!audioUrl && m.audioPlaylist?.tracks) {
      const track = m.audioPlaylist.tracks.find((candidate) => resolver(candidate?.audio))
      if (track) {
        const trackUrl = resolver(track.audio)
        if (trackUrl) {
          audioUrl = trackUrl
          if (typeof track.title === 'string' && track.title.trim().length > 0) {
            title = track.title
          }
        }
      }
    }

    const displayAudioUrl = audioUrl && cachedMedia[audioUrl] ? cachedMedia[audioUrl] : audioUrl
    return {
      id: m.id,
      title,
      audioUrl: displayAudioUrl,
    }
  })
}
