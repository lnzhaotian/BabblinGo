import { config } from './config'

type PayloadListResponse<T> = {
  docs: T[]
}

type MaybeWithOrder = {
  order?: number | null
}

export type MediaDoc = {
  id: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
}

export type ModuleDoc = {
  id: string
  slug?: string
  title: string
  summary?: string | null
  order?: number | null
  lesson: string | LessonDoc
  image?: MediaDoc | string | null
  audio?: MediaDoc | string | null
  body?: unknown
}

type ModuleRelation = string | ModuleDoc | null

export type LevelDoc = {
  id: string
  slug: string
  title: string
  order?: number | null
}

export type LessonDoc = {
  id: string
  slug: string
  title: string
  summary?: string | null
  order?: number | null
  level: string | LevelDoc
  modules?: ModuleRelation[] | null
}

const buildUrl = (path: string): string => {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const base = config.apiUrl.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

const fetchPayload = async <T>(path: string, init?: RequestInit, locale?: string): Promise<T> => {
  const url = new URL(buildUrl(path))
  
  // Add locale query parameter if provided
  if (locale) {
    url.searchParams.set('locale', locale)
  }
  
  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

const sortByOrder = <T extends MaybeWithOrder>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })

export const resolveMediaUrl = (media: MediaDoc | string | null | undefined): string | null => {
  if (!media) {
    return null
  }

  if (typeof media === 'string') {
    return buildUrl(media)
  }

  if (media.url) {
    return buildUrl(media.url)
  }

  if (media.filename) {
    return buildUrl(`/media/${media.filename}`)
  }

  return null
}

export const extractModules = (lesson: LessonDoc): ModuleDoc[] => {
  if (!Array.isArray(lesson.modules)) {
    return []
  }

  const modules = lesson.modules.filter(
    (module): module is ModuleDoc => Boolean(module) && typeof module === 'object'
  )

  return sortByOrder(modules)
}

export const fetchLessonsByLevelSlug = async (levelSlug: string, locale?: string): Promise<LessonDoc[]> => {
  const encodedSlug = encodeURIComponent(levelSlug)
  const levelResponse = await fetchPayload<PayloadListResponse<LevelDoc>>(
    `/api/levels?where[slug][equals]=${encodedSlug}&depth=0&limit=1`,
    undefined,
    locale
  )

  const [level] = levelResponse.docs

  if (!level) {
    return []
  }

  const lessonsResponse = await fetchPayload<PayloadListResponse<LessonDoc>>(
    `/api/lessons?where[level][equals]=${level.id}&depth=1&limit=100&sort=order`,
    undefined,
    locale
  )

  return sortByOrder(lessonsResponse.docs)
}

export const fetchLessonById = async (lessonId: string, locale?: string): Promise<LessonDoc> =>
  fetchPayload<LessonDoc>(`/api/lessons/${lessonId}?depth=2`, undefined, locale)
