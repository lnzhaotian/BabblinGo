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

export type CourseLevel = {
  id: string
  key: string
  label?: string | Record<string, string | null> | null
  order?: number | null
}

export type CourseDoc = {
  id: string
  slug: string
  title: string | Record<string, string | null>
  description?: string | Record<string, string | null> | null
  coverImage?: MediaDoc | string | null
  order?: number | null
  status?: string | null
  levels?: CourseLevel[] | null
}

type ModuleRelation = string | ModuleDoc | null

export type LessonDoc = {
  id: string
  slug: string
  title: string
  summary?: string | null
  order?: number | null
  level?: string | null
  course: string | CourseDoc
  modules?: ModuleRelation[] | null
  updatedAt?: string // Payload timestamp for version tracking
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

export const resolveLocalizedField = (
  value: string | Record<string, string | null> | null | undefined,
  locale: string
): string | undefined => {
  if (!value) {
    return undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  const direct = value[locale]
  if (typeof direct === 'string') {
    const trimmed = direct.trim()
    if (trimmed.length > 0) {
      return trimmed
    }
  }

  const fallback = Object.values(value).find(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
  )

  return fallback
}

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

export const fetchCourses = async (locale?: string): Promise<CourseDoc[]> => {
  const params = new URLSearchParams({
    'where[status][equals]': 'published',
    depth: '1',
    limit: '100',
    sort: 'order',
  })

  const response = await fetchPayload<PayloadListResponse<CourseDoc>>(
    `/api/courses?${params.toString()}`,
    undefined,
    locale
  )

  return sortByOrder(response.docs)
}

export const fetchCourseById = async (courseId: string, locale?: string): Promise<CourseDoc> =>
  fetchPayload<CourseDoc>(`/api/courses/${courseId}?depth=1`, undefined, locale)

export const fetchLessonsByCourse = async (
  courseId: string,
  options?: { levelKey?: string; locale?: string }
): Promise<LessonDoc[]> => {
  const params = new URLSearchParams({
    'where[course][equals]': courseId,
    depth: '2',
    limit: '100',
    sort: 'order',
  })

  if (options?.levelKey) {
    params.set('where[level][equals]', options.levelKey)
  }

  const response = await fetchPayload<PayloadListResponse<LessonDoc>>(
    `/api/lessons?${params.toString()}`,
    undefined,
    options?.locale
  )

  return sortByOrder(response.docs)
}

export const fetchLessonById = async (lessonId: string, locale?: string): Promise<LessonDoc> =>
  fetchPayload<LessonDoc>(`/api/lessons/${lessonId}?depth=2`, undefined, locale)
