import { config } from './config'
// @ts-ignore
import EventSource from 'react-native-sse'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'
import { DeviceEventEmitter } from 'react-native'

export const EVENT_APP_OFFLINE_MODE = 'APP_OFFLINE_MODE'

type PayloadListResponse<T> = {
  docs: T[]
}

type MaybeWithOrder = {
  order?: number | null
}

export type LexicalRichText = {
  root: {
    type: string
    children: { type: any; version: number; [key: string]: unknown }[]
    direction: ('ltr' | 'rtl') | null
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | ''
    indent: number
    version: number
  }
  [key: string]: unknown
}

export type MediaDoc = {
  id: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
}

export type AudioSlideshowSlideDoc = {
  id?: string | null
  title?: string | null
  image?: MediaDoc | string | null
  audio?: MediaDoc | string | null
  body?: LexicalRichText | null
}

export type AudioSlideshowContent = {
  slides?: AudioSlideshowSlideDoc[] | null
  transcript?: LexicalRichText | null
}

export type VideoCaptionDoc = {
  label: string
  file: string | MediaDoc
  language?: string | null
  id?: string | null
}

export type VideoContent = {
  videoFile?: string | MediaDoc | null
  streamUrl?: string | null
  posterImage?: string | MediaDoc | null
  captions?: VideoCaptionDoc[] | null
  transcript?: LexicalRichText | null
}

export type RichPostContent = {
  body: LexicalRichText
  mediaGallery?: {
    media: string | MediaDoc
    caption?: string | null
    id?: string | null
  }[] | null
}

export type AudioTrackDoc = {
  title: string
  audio: string | MediaDoc
  image?: string | MediaDoc | null
  durationSeconds?: number | null
  transcript?: LexicalRichText | null
  id?: string | null
}

export type AudioContent = {
  tracks?: AudioTrackDoc[] | null
  introduction?: LexicalRichText | null
}

export type LessonModuleType = 'audioSlideshow' | 'video' | 'richPost' | 'audio'

export type ModuleDoc = {
  id: string
  slug?: string
  title: string
  summary?: string | null
  order?: number | null
  lesson: string | LessonDoc
  type?: LessonModuleType | null
  audioSlideshow?: AudioSlideshowContent | null
  video?: VideoContent | null
  richPost?: RichPostContent | null
  audio?: AudioContent | MediaDoc | string | null
  resources?: {
    label: string
    url: string
    id?: string | null
  }[] | null
  /** Legacy fields retained for backward compatibility */
  image?: MediaDoc | string | null
  body?: unknown
}

export type CourseLevel = {
  id: string
  key: string
  label?: string | Record<string, string | null> | null
  order?: number | null
}

export type ToolDoc = {
  id: string
  title: string | Record<string, string | null>
  description?: string | Record<string, string | null> | null
  url: string
  category?: string | null
  icon?: string | null
  order?: number | null
  status?: string | null
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
  defaultTrackingEnabled?: boolean | null
  updatedAt?: string
}

export type UserPreferencesDoc = {
  id: string
  user: string | { id: string }
  global?: {
    trackingEnabled?: boolean
    playbackSpeed?: number
    sessionDuration?: number
  }
  courseOverrides?: {
    course: string | { id: string }
    trackingEnabled: boolean
    id?: string
  }[]
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

export type LessonModuleSlide = {
  id: string
  moduleId: string
  slideId: string
  type: LessonModuleType
  order?: number | null
  slideOrder: number
  title: string
  summary?: string | null
  body?: LexicalRichText | null
  image?: MediaDoc | string | null
  audio?: MediaDoc | string | null
  transcript?: LexicalRichText | null
  video?: VideoContent | null
  richPost?: RichPostContent | null
  audioPlaylist?: AudioContent | null
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
  
  const fullUrl = url.toString()
  const cacheKey = `api_cache:${fullUrl}`
  const isGetRequest = !init?.method || init.method.toUpperCase() === 'GET'

  // Helper to get from cache
  const getFromCache = async (): Promise<T | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey)
      if (cachedData) {
        console.log('Serving cached response for:', fullUrl)
        return JSON.parse(cachedData) as T
      }
    } catch (cacheError) {
      console.warn('Failed to retrieve cached API response:', cacheError)
    }
    return null
  }

  // 1. Check network status first
  const netState = await NetInfo.fetch()
  if (!netState.isConnected && isGetRequest) {
    const cached = await getFromCache()
    if (cached) return cached
    // If no cache and no internet, we have to throw
    throw new Error('No internet connection and no cached data available')
  }

  try {
    // 2. Setup timeout for the fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    const response = await fetch(fullUrl, {
      headers: {
        Accept: 'application/json',
      },
      ...init,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    const data = await response.json()

    // Cache successful GET requests
    if (isGetRequest) {
      AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(err => 
        console.warn('Failed to cache API response:', err)
      )
    }

    // We successfully got data from network, so we are effectively online
    DeviceEventEmitter.emit(EVENT_APP_OFFLINE_MODE, false)

    return data as T
  } catch (error: any) {
    // 3. If network request fails or times out, try to retrieve from cache
    if (isGetRequest) {
      const cached = await getFromCache()
      if (cached) {
        // We are serving from cache due to network failure/timeout
        DeviceEventEmitter.emit(EVENT_APP_OFFLINE_MODE, true)
        return cached
      }
    }
    
    // If it was a timeout, make the error message clearer
    if (error.name === 'AbortError') {
      throw new Error('Network request timed out')
    }
    
    throw error
  }
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

const defaultSlideId = (moduleId: string, index: number): string => `${moduleId}-slide-${index}`

const normalizeSlideTitle = (slide: AudioSlideshowSlideDoc | undefined, fallback: string): string => {
  if (!slide?.title) {
    return fallback
  }

  const trimmed = slide.title.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

const isAudioContent = (value: ModuleDoc['audio']): value is AudioContent =>
  Boolean(value && typeof value === 'object' && 'tracks' in value)

const normalizeModuleSlides = (module: ModuleDoc): LessonModuleSlide[] => {
  const moduleType: LessonModuleType = module.type ?? 'audioSlideshow'

  if (moduleType === 'audioSlideshow') {
    const slideshowSlides = module.audioSlideshow?.slides ?? []

    if (slideshowSlides.length === 0) {
      // Fallback to legacy structure where media lived directly on the module
      const legacyAudio = isAudioContent(module.audio) ? null : module.audio ?? null

      return [
        {
          id: module.id,
          moduleId: module.id,
          slideId: module.id,
          type: 'audioSlideshow',
          order: module.order,
          slideOrder: 0,
          title: module.title,
          summary: module.summary ?? null,
          body: (module.body ?? null) as LexicalRichText | null,
          image: module.image ?? null,
          audio: legacyAudio,
          transcript: module.audioSlideshow?.transcript ?? null,
        },
      ]
    }

    return slideshowSlides.map((slide, index) => {
      const slideId = (typeof slide?.id === 'string' && slide.id) ? slide.id : defaultSlideId(module.id, index)

      return {
        id: `${module.id}__${slideId}`,
        moduleId: module.id,
        slideId,
        type: 'audioSlideshow',
        order: module.order,
        slideOrder: index,
        title: normalizeSlideTitle(slide, module.title),
        summary: module.summary ?? null,
        body: slide?.body ?? null,
        image: slide?.image ?? null,
        audio: slide?.audio ?? null,
        transcript: module.audioSlideshow?.transcript ?? null,
      }
    })
  }

  if (moduleType === 'video') {
    const videoContent = module.video ?? null
    const poster = videoContent?.posterImage ?? null

    return [
      {
        id: module.id,
        moduleId: module.id,
        slideId: module.id,
        type: 'video',
        order: module.order,
        slideOrder: 0,
        title: module.title,
        summary: module.summary ?? null,
        body: videoContent?.transcript ?? null,
        image: poster,
        audio: null,
        transcript: videoContent?.transcript ?? null,
        video: videoContent,
        richPost: null,
        audioPlaylist: null,
      },
    ]
  }

  if (moduleType === 'richPost') {
    const content = module.richPost ?? null
    const firstMedia = content?.mediaGallery?.[0]?.media ?? null

    return [
      {
        id: module.id,
        moduleId: module.id,
        slideId: module.id,
        type: 'richPost',
        order: module.order,
        slideOrder: 0,
        title: module.title,
        summary: module.summary ?? null,
        body: content?.body ?? null,
        image: firstMedia,
        audio: null,
        transcript: null,
        video: null,
        richPost: content,
        audioPlaylist: null,
      },
    ]
  }

  if (moduleType === 'audio' && isAudioContent(module.audio)) {
    const playlist = module.audio ?? null
    const playableTrack = playlist?.tracks?.find((track) => Boolean(track?.audio)) ?? null
    const intro = playlist?.introduction ?? null

    return [
      {
        id: module.id,
        moduleId: module.id,
        slideId: module.id,
        type: 'audio',
        order: module.order,
        slideOrder: 0,
        title: module.title,
        summary: module.summary ?? null,
        body: intro ?? null,
        image: playableTrack?.image ?? null,
        audio: playableTrack?.audio ?? null,
        transcript: intro,
        video: null,
        richPost: null,
        audioPlaylist: playlist,
      },
    ]
  }

  // Other module types are not yet supported in the lesson player;
  // keep a placeholder entry so the lesson still registers content.
  return [
    {
      id: module.id,
      moduleId: module.id,
      slideId: module.id,
      type: moduleType,
      order: module.order,
      slideOrder: 0,
      title: module.title,
      summary: module.summary ?? null,
      body: null,
      image: null,
      audio: null,
      transcript: null,
      video: null,
      richPost: null,
      audioPlaylist: null,
    },
  ]
}

const normalizeLessonModules = (lesson: LessonDoc): ModuleDoc[] => {
  if (!Array.isArray(lesson.modules)) {
    return []
  }

  const modules = lesson.modules.filter(
    (module): module is ModuleDoc => Boolean(module) && typeof module === 'object'
  )

  return sortByOrder(modules)
}

type SlideWithSortMeta = LessonModuleSlide & {
  __moduleOrderKey: number
  __moduleIndex: number
}

export const extractModuleSlides = (module: ModuleDoc): LessonModuleSlide[] => normalizeModuleSlides(module)

export const getLessonModules = (lesson: LessonDoc): ModuleDoc[] => normalizeLessonModules(lesson)

export const extractModules = (lesson: LessonDoc): LessonModuleSlide[] => {
  const sortedModules = normalizeLessonModules(lesson)

  const slides: SlideWithSortMeta[] = []

  sortedModules.forEach((module, moduleIndex) => {
    const moduleOrderKey = module.order ?? Number.MAX_SAFE_INTEGER
    const moduleSlides = normalizeModuleSlides(module)

    moduleSlides.forEach((slide) => {
      slides.push({
        ...slide,
        __moduleOrderKey: moduleOrderKey,
        __moduleIndex: moduleIndex,
      })
    })
  })

  const sortedSlides = slides.sort((a, b) => {
    const orderCompare = a.__moduleOrderKey - b.__moduleOrderKey
    if (orderCompare !== 0) {
      return orderCompare
    }
    const moduleIndexCompare = a.__moduleIndex - b.__moduleIndex
    if (moduleIndexCompare !== 0) {
      return moduleIndexCompare
    }
    return a.slideOrder - b.slideOrder
  })

  return sortedSlides.map((slide) => {
    const { __moduleOrderKey, __moduleIndex, ...rest } = slide
    return rest
  })
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

export const fetchTools = async (locale?: string): Promise<ToolDoc[]> => {
  const params = new URLSearchParams({
    'where[status][equals]': 'published',
    limit: '100',
    sort: 'order',
  })

  const response = await fetchPayload<PayloadListResponse<ToolDoc>>(
    `/api/tools?${params.toString()}`,
    undefined,
    locale
  )

  return sortByOrder(response.docs)
}

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

export type AgentDoc = {
  id: string
  title: string
  description?: string
  iconType?: 'material' | 'image'
  icon?: string
  iconImage?: MediaDoc | string | null
  welcomeMessage?: string
  order?: number
  status: 'draft' | 'published'
}

export const fetchAgents = async (locale?: string): Promise<AgentDoc[]> => {
  const params = new URLSearchParams({
    'where[status][equals]': 'published',
    limit: '100',
    sort: 'order',
  })

  const response = await fetchPayload<PayloadListResponse<AgentDoc>>(
    `/api/agents?${params.toString()}`,
    undefined,
    locale
  )

  return sortByOrder(response.docs)
}


export const streamDifyMessage = async (
  agentId: string,
  query: string,
  conversationId: string | undefined,
  onMessage: (answer: string, conversationId: string) => void,
  onCompleted: () => void,
  onError: (error: any) => void
): Promise<EventSource> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const es = new EventSource(`${config.apiUrl}/api/dify/chat-messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agentId,
      query,
      conversationId,
      response_mode: 'streaming',
      inputs: {},
    }),
  })

  es.addEventListener('message', (event: any) => {
    if (!event.data) return
    
    try {
      const data = JSON.parse(event.data)
      
      if (data.event === 'message' || data.event === 'agent_message') {
        onMessage(data.answer, data.conversation_id)
      } else if (data.event === 'message_end') {
        onCompleted()
        es.close()
      } else if (data.event === 'error') {
        onError(new Error(data.message || 'Unknown error'))
        es.close()
      }
    } catch (e) {
      console.error('Failed to parse SSE data', e)
    }
  })

  es.addEventListener('error', (event: any) => {
    if (event.type === 'error') {
       const error = event.message || 'Connection error'
       onError(new Error(error))
    }
    es.close()
  })
  
  return es
}

export const sendDifyMessage = async (
  agentId: string,
  query: string,
  conversationId?: string,
  inputs?: Record<string, any>
): Promise<Response> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(`${config.apiUrl}/api/dify/chat-messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agentId,
      query,
      conversationId,
      inputs,
    }),
  })
}

export const fetchConversations = async (agentId: string, lastId?: string): Promise<any> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const params = new URLSearchParams({ agentId })
  if (lastId) params.append('last_id', lastId)

  const response = await fetch(`${config.apiUrl}/api/dify/conversations?${params.toString()}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch conversations: ${response.status} ${errorText}`)
  }

  return response.json()
}

export const fetchMessages = async (agentId: string, conversationId: string, firstId?: string): Promise<any> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const params = new URLSearchParams({ agentId, conversationId })
  if (firstId) params.append('first_id', firstId)

  const response = await fetch(`${config.apiUrl}/api/dify/messages?${params.toString()}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch messages: ${response.status} ${errorText}`)
  }

  return response.json()
}

export const deleteConversation = async (agentId: string, conversationId: string): Promise<void> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${config.apiUrl}/api/dify/conversations/delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agentId, conversationId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to delete conversation: ${response.status} ${errorText}`)
  }
}

export const generateConversationTitle = async (agentId: string, conversationId: string): Promise<{ name: string }> => {
  const { getAuthToken } = await import('./auth-session')
  const token = await getAuthToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${config.apiUrl}/api/dify/conversations/generate-title`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ agentId, conversationId }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to generate conversation title: ${response.status} ${errorText}`)
  }

  return response.json()
}
