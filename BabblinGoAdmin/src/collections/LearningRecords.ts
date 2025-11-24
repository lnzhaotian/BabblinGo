import { Buffer } from 'node:buffer'
import type { CollectionConfig, PayloadRequest } from 'payload'
import type { LearningRecord, User } from '../payload-types'

type JsonCapableRequest = PayloadRequest & {
  body?: unknown
  json?: () => Promise<unknown>
  bodyUsed?: boolean
}

type WebReadableStreamReader = {
  read: () => Promise<{ value?: Uint8Array; done: boolean }>
  releaseLock?: () => void
}

type WebReadableStreamLike = {
  getReader?: () => WebReadableStreamReader | undefined
}

type AsyncIterableStreamLike = {
  [Symbol.asyncIterator]?: () => AsyncIterator<unknown>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const safeJsonParse = (value: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(value)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

const readWebStream = async (stream: unknown): Promise<string> => {
  if (!stream || typeof stream !== 'object') return ''
  const streamLike = stream as WebReadableStreamLike
  const reader = streamLike.getReader?.()
  if (!reader || typeof reader.read !== 'function') return ''
  const decoder = new TextDecoder()
  let result = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value && value instanceof Uint8Array) {
        result += decoder.decode(value, { stream: true })
      }
    }
    result += decoder.decode()
  } finally {
    if (typeof reader.releaseLock === 'function') {
      reader.releaseLock()
    }
  }
  return result
}

const readNodeStream = async (stream: unknown): Promise<string> => {
  if (!stream || typeof stream !== 'object') {
    return ''
  }
  const streamLike = stream as AsyncIterableStreamLike
  if (typeof streamLike[Symbol.asyncIterator] !== 'function') {
    return ''
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of streamLike as AsyncIterable<unknown>) {
    if (chunk == null) continue
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk))
    } else if (chunk instanceof Uint8Array) {
      chunks.push(chunk)
    } else if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk)
    } else {
      const text = String(chunk)
      if (text) {
        chunks.push(Buffer.from(text))
      }
    }
  }
  return Buffer.concat(chunks).toString('utf-8')
}

const resolveRequestBody = async (
  req: PayloadRequest
): Promise<{
  rawBody: unknown
  parsedBody: Record<string, unknown>
  rawText?: string
  via: string
}> => {
  const jsonReq = req as JsonCapableRequest
  const rawBody = jsonReq.body ?? null

  if (typeof jsonReq.json === 'function' && !jsonReq.bodyUsed) {
    try {
      const data = await jsonReq.json()
      if (isRecord(data)) {
        return {
          rawBody,
          parsedBody: data,
          rawText: JSON.stringify(data),
          via: 'req.json()',
        }
      }
      if (typeof data === 'string') {
        return {
          rawBody,
          parsedBody: safeJsonParse(data),
          rawText: data,
          via: 'req.json-string',
        }
      }
    } catch (error) {
      console.warn('[manual-endpoint] req.json() failed', error)
    }
  }

  if (typeof rawBody === 'string') {
    return {
      rawBody,
      parsedBody: safeJsonParse(rawBody),
      rawText: rawBody,
      via: 'string-body',
    }
  }

  if (rawBody && typeof rawBody === 'object') {
    const webStream = rawBody as WebReadableStreamLike
    if (typeof webStream.getReader === 'function') {
      const rawText = await readWebStream(webStream)
      return {
        rawBody,
        parsedBody: rawText ? safeJsonParse(rawText) : {},
        rawText,
        via: 'web-stream',
      }
    }

    const asyncStream = rawBody as AsyncIterableStreamLike
    if (typeof asyncStream[Symbol.asyncIterator] === 'function') {
      const rawText = await readNodeStream(asyncStream)
      return {
        rawBody,
        parsedBody: rawText ? safeJsonParse(rawText) : {},
        rawText,
        via: 'node-stream',
      }
    }

    if (isRecord(rawBody)) {
      return {
        rawBody,
        parsedBody: rawBody,
        via: 'object-body',
      }
    }
  }

  return {
    rawBody,
    parsedBody: {},
    via: 'unhandled',
  }
}

// Access helpers: allow managers/editors full access; otherwise constrain by ownership via where clause
const canManageWhere = ({ req }: { req: PayloadRequest }) => {
  const user = req?.user as User | undefined
  if (!user) return false
  if (user.role === 'manager' || user.role === 'editor') return true
  return {
    user: {
      equals: user.id,
    },
  } as const
}

export const LearningRecords: CollectionConfig = {
  slug: 'learning-records',
  admin: {
    useAsTitle: 'lessonTitle',
    group: 'Learning',
    defaultColumns: ['user', 'lessonTitle', 'source', 'finished', 'updatedAt'],
  },
  timestamps: true,
  endpoints: [
    {
      // HEAD /api/learning-records (lightweight auth check for sync health probes)
      path: '/',
      method: 'head',
      handler: async (req: PayloadRequest) => {
        console.log('[learning-records] head probe', {
          userId: (req?.user as User | undefined)?.id,
          url: req?.url,
        })
        const user = req?.user as User | undefined
        if (!user) {
          return new Response(null, { status: 401 })
        }
        return new Response(null, { status: 204 })
      },
    },
    {
      // OPTIONS /api/learning-records (CORS/preflight support)
      path: '/',
      method: 'options',
      handler: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        })
      },
    },
    {
      // POST /api/learning-records/manual
      path: '/manual',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const user = req?.user as User | undefined
          if (!user) {
            return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
          }

          const { rawBody, parsedBody, rawText, via } = await resolveRequestBody(req)
          const body = parsedBody

          const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
          const parseDate = (value: unknown): Date | null => {
            if (value instanceof Date && !Number.isNaN(value.getTime())) return value
            if (typeof value === 'number') {
              const date = new Date(value)
              return Number.isNaN(date.getTime()) ? null : date
            }
            if (typeof value === 'string') {
              const trimmed = value.trim()
              if (!trimmed) return null
              const date = new Date(trimmed)
              return Number.isNaN(date.getTime()) ? null : date
            }
            return null
          }
          const parseNumber = (value: unknown): number | undefined => {
            if (typeof value === 'number' && Number.isFinite(value)) return value
            if (typeof value === 'string') {
              const parsed = Number(value.trim())
              if (Number.isFinite(parsed)) return parsed
            }
            return undefined
          }
          const parseBoolean = (value: unknown): boolean | undefined => {
            if (typeof value === 'boolean') return value
            if (typeof value === 'string') {
              const normalized = value.trim().toLowerCase()
              if (normalized === 'true') return true
              if (normalized === 'false') return false
            }
            return undefined
          }
          const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
          const slugify = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

          const rawLessonId = trimString(body.lessonId)
          const rawLessonTitle = trimString(body.lessonTitle)
          const lessonIdFromTitle = () => {
            const base = slugify(rawLessonTitle || 'session')
            const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
            return `manual-${base || 'session'}-${suffix}`
          }
          const lessonId = rawLessonId || lessonIdFromTitle()
          const lessonTitle = rawLessonTitle || lessonId
          const normalizedLessonId = lessonId.length > 120 ? lessonId.slice(0, 120) : lessonId
          const normalizedLessonTitle = lessonTitle.length > 200 ? lessonTitle.slice(0, 200) : lessonTitle

          const startedAtDate = parseDate(body.startedAt ?? body.start)
          const endedAtDate = parseDate(body.endedAt ?? body.end)
          console.log('[manual-endpoint] incoming payload', {
            rawBodyType: rawBody ? typeof rawBody : typeof rawBody,
            rawBodyConstructor:
              rawBody && typeof rawBody === 'object' ? (rawBody as { constructor?: { name?: string } })?.constructor?.name : undefined,
            rawText,
            via,
            parsedBody: body,
            startedAt: body.startedAt ?? body.start,
            endedAt: body.endedAt ?? body.end,
            startedAtDate: startedAtDate?.toISOString?.() ?? null,
            endedAtDate: endedAtDate?.toISOString?.() ?? null,
            nowIso: new Date().toISOString(),
            userId: user?.id,
          })
          if (!startedAtDate || !endedAtDate) {
            return Response.json({ errors: [{ message: 'Invalid startedAt or endedAt' }] }, { status: 400 })
          }
          if (endedAtDate.getTime() <= startedAtDate.getTime()) {
            return Response.json({ errors: [{ message: 'endedAt must be after startedAt' }] }, { status: 400 })
          }

          const now = Date.now()
          const futureAllowanceMs = 5 * 60 * 1000
          if (startedAtDate.getTime() > now + futureAllowanceMs || endedAtDate.getTime() > now + futureAllowanceMs) {
            return Response.json({ errors: [{ message: 'Timestamps cannot be in the future' }] }, { status: 400 })
          }

          const MIN_DURATION_SECONDS = 60
          const MAX_DURATION_SECONDS = 8 * 60 * 60
          const providedDuration = parseNumber(body.durationSeconds)
          let durationSeconds = typeof providedDuration === 'number'
            ? Math.round(providedDuration)
            : Math.round((endedAtDate.getTime() - startedAtDate.getTime()) / 1000)
          if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            return Response.json({ errors: [{ message: 'Unable to resolve a valid duration' }] }, { status: 400 })
          }
          durationSeconds = clamp(durationSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS)

          const providedPlanned = parseNumber(body.plannedSeconds)
          let plannedSeconds = typeof providedPlanned === 'number' ? Math.round(providedPlanned) : durationSeconds
          if (!Number.isFinite(plannedSeconds) || plannedSeconds < 0) {
            plannedSeconds = durationSeconds
          }
          plannedSeconds = clamp(plannedSeconds, 0, MAX_DURATION_SECONDS)

          const providedSegments = parseNumber(body.segments)
          const segments = Math.round(clamp(typeof providedSegments === 'number' && providedSegments > 0 ? providedSegments : 1, 1, 24))

          const providedSpeed = parseNumber(body.speed)
          const speed = Number.isFinite(providedSpeed ?? NaN) ? clamp((providedSpeed as number), 0.5, 3) : 1

          const finished = parseBoolean(body.finished)
          const rawNotes = trimString(body.notes)
          const notes = rawNotes.length > 0 ? rawNotes.slice(0, 1000) : undefined
          const runId = trimString(body.runId)
          const clientId = trimString(body.clientId)
          const normalizedSpeed = Math.round(speed * 100) / 100
          const resolvedClientId = clientId || `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

          const payloadData: Omit<LearningRecord, 'id' | 'createdAt' | 'updatedAt'> = {
            user: user.id,
            clientId: resolvedClientId,
            lessonId: normalizedLessonId,
            lessonTitle: normalizedLessonTitle,
            startedAt: startedAtDate.toISOString(),
            endedAt: endedAtDate.toISOString(),
            plannedSeconds,
            durationSeconds,
            speed: normalizedSpeed,
            finished: finished ?? true,
            segments,
            source: 'manual',
            notes: notes ?? null,
            runId: runId || null,
          }

          console.log('[manual-endpoint] creating record', {
            userId: payloadData.user,
            lessonId: payloadData.lessonId,
            startedAt: payloadData.startedAt,
            endedAt: payloadData.endedAt,
          })

          let created: LearningRecord
          try {
            created = (await req.payload.create({
              collection: 'learning-records',
              data: payloadData,
              draft: false,
            })) as unknown as LearningRecord
          } catch (createError) {
            console.error('[manual-endpoint] create failed', createError)
            throw createError
          }

          console.log('[manual-endpoint] create succeeded', {
            recordId: created.id,
            startedAt: created.startedAt,
            endedAt: created.endedAt,
          })

          return Response.json({ ok: true, record: created }, { status: 201 })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          console.error('[manual-endpoint] handler failed', { message, error: e })
          return Response.json({ errors: [{ message }] }, { status: 500 })
        }
      },
    },
    {
      // HEAD /api/learning-records/manual (preflight/health)
      path: '/manual',
      method: 'head',
      handler: async (req: PayloadRequest) => {
        const user = req?.user as User | undefined
        if (!user) {
          return new Response(null, { status: 401 })
        }
        return new Response(null, { status: 204 })
      },
    },
    {
      // OPTIONS /api/learning-records/manual (CORS/preflight support)
      path: '/manual',
      method: 'options',
      handler: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400',
          },
        })
      },
    },
    {
      // DELETE /api/learning-records
      path: '/',
      method: 'delete',
      handler: async (req: PayloadRequest) => {
        try {
          const user = req?.user as User | undefined
          if (!user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })

          const isManager = user.role === 'manager' || user.role === 'editor'
          const where = isManager
            ? undefined
            : {
                user: {
                  equals: user.id,
                },
              } as const

          let deleted = 0
          // Iterate through pages to delete all matching docs
          // Use a reasonable page size to avoid long transactions
          const pageSize = 100
          while (true) {
            const batch = await req.payload.find({
              collection: 'learning-records',
              where,
              limit: pageSize,
              page: 1,
              depth: 0,
            })
            const docsContainer = batch as unknown as { docs?: LearningRecord[] }
            const docs = Array.isArray(docsContainer.docs) ? docsContainer.docs : []
            if (docs.length === 0) break

            for (const doc of docs) {
              try {
                // For safety, re-check ownership for non-managers
                if (!isManager) {
                  const ownerId = typeof doc.user === 'string' ? doc.user : (doc.user as User)?.id
                  if (ownerId !== user.id) continue
                }
                await req.payload.delete({ collection: 'learning-records', id: doc.id })
                deleted += 1
              } catch (_) {
                // continue deleting others on failure
              }
            }

            // If fewer than page size, we're done
            if (docs.length < pageSize) break
          }

          return Response.json({ ok: true, deleted })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          return Response.json({ errors: [{ message }] }, { status: 500 })
        }
      },
    },
    {
      // POST /api/learning-records/bulk-delete  { ids?: string[] }
      path: '/bulk-delete',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const user = req?.user as User | undefined
          if (!user) return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
          const isManager = user.role === 'manager' || user.role === 'editor'
          let ids: string[] = []
          const incoming: unknown = (req as PayloadRequest).body as unknown
          if (
            incoming &&
            typeof incoming === 'object' &&
            'ids' in (incoming as Record<string, unknown>) &&
            Array.isArray((incoming as { ids?: unknown }).ids)
          ) {
            ids = ((incoming as { ids?: unknown }).ids as unknown[]).filter((v): v is string => typeof v === 'string')
          }
          let deleted = 0

          if (ids.length > 0) {
            // Targeted deletion
            for (const id of ids) {
              try {
                const doc = (await req.payload.findByID({ collection: 'learning-records', id, depth: 0 })) as unknown as LearningRecord
                if (!doc) continue
                if (!isManager) {
                  const ownerId = typeof doc.user === 'string' ? doc.user : (doc.user as User)?.id
                  if (ownerId !== user.id) continue
                }
                await req.payload.delete({ collection: 'learning-records', id })
                deleted += 1
              } catch (_) {
                // ignore and continue
              }
            }
          } else {
            // Delete all for current user (or all if manager)
            const where = isManager
              ? undefined
              : {
                  user: {
                    equals: user.id,
                  },
                } as const
            const pageSize = 100
            while (true) {
              const batch = await req.payload.find({
                collection: 'learning-records',
                where,
                limit: pageSize,
                page: 1,
                depth: 0,
              })
              const docsContainer = batch as unknown as { docs?: LearningRecord[] }
              const docs = Array.isArray(docsContainer.docs) ? docsContainer.docs : []
              if (docs.length === 0) break
              for (const doc of docs) {
                try {
                  if (!isManager) {
                    const ownerId = typeof doc.user === 'string' ? doc.user : (doc.user as User)?.id
                    if (ownerId !== user.id) continue
                  }
                  await req.payload.delete({ collection: 'learning-records', id: doc.id })
                  deleted += 1
                } catch (_) {
                  // ignore and continue
                }
              }
              if (docs.length < pageSize) break
            }
          }

          return Response.json({ ok: true, deleted })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          return Response.json({ errors: [{ message }] }, { status: 500 })
        }
      },
    },
  ],
  access: {
    read: ({ req }) => {
      const user = req?.user as User | undefined
      if (!user) return false
      if (user.role === 'manager' || user.role === 'editor') {
        return true
      }
      return {
        user: {
          equals: user.id,
        },
      } as const
    },
    create: ({ req }) => !!req?.user,
    update: canManageWhere,
    delete: canManageWhere,
  },
  hooks: {
    beforeOperation: [
      (hookArgs) => {
        try {
          const { args, req } = hookArgs
          const operation = (hookArgs as { operation?: string }).operation
          const url = req?.url
          const method = req?.method
          const id = typeof args === 'object' && args && 'id' in args ? (args as { id?: unknown }).id : undefined
          console.log('[learning-records] beforeOperation', {
            operation,
            method,
            url,
            id,
          })
        } catch (error) {
          console.warn('[learning-records] beforeOperation log failed', error)
        }
      },
    ],
    afterError: [
      (hookArgs) => {
        try {
          const { error, req } = hookArgs
          const operation = (hookArgs as { operation?: string }).operation
          const status = (error as { status?: number })?.status
          console.error('[learning-records] afterError', {
            operation,
            method: req?.method,
            url: req?.url,
            status,
            message: error instanceof Error ? error.message : String(error),
          })
        } catch (logError) {
          console.warn('[learning-records] afterError log failed', logError)
        }
      },
    ],
    beforeValidate: [
      ({ data, req }) => {
        const next = data || {}
        if (req?.user && (!next.user || req.user.collection === 'users')) {
          next.user = req.user.id
        }
        if (typeof next.clientId === 'string') {
          next.clientId = next.clientId.trim()
          if (next.clientId.length > 160) {
            next.clientId = next.clientId.slice(0, 160)
          }
        }
        if (!next.clientId) {
          next.clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        }
        if (typeof next.lessonTitle === 'string') {
          next.lessonTitle = next.lessonTitle.trim()
          if (next.lessonTitle.length > 200) {
            next.lessonTitle = next.lessonTitle.slice(0, 200)
          }
        }
        if (typeof next.lessonId === 'string') {
          next.lessonId = next.lessonId.trim()
          if (next.lessonId.length > 128) {
            next.lessonId = next.lessonId.slice(0, 128)
          }
        }
        if (typeof next.segments !== 'number' || next.segments < 1) {
          next.segments = 1
        }
        if (typeof next.segments === 'number' && next.segments > 24) {
          next.segments = 24
        }
        if (typeof next.plannedSeconds === 'number' && next.plannedSeconds < 0) {
          next.plannedSeconds = 0
        }
        if (typeof next.notes === 'string') {
          next.notes = next.notes.trim()
          if (next.notes.length === 0) {
            delete next.notes
          } else if (next.notes.length > 1000) {
            next.notes = next.notes.slice(0, 1000)
          }
        }
        if (typeof next.source !== 'string' || (next.source !== 'auto' && next.source !== 'manual')) {
          next.source = 'auto'
        }
        return next
      },
    ],
    afterRead: [
      ({ doc }) => {
        const record = doc as LearningRecord
        if (record && typeof record.source !== 'string') {
          record.source = 'auto'
        }
        if (record && typeof record.notes === 'string') {
          const trimmed = record.notes.trim()
          record.notes = trimmed.length > 0 ? trimmed : null
        }
        return record
      },
    ],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'auto',
      options: [
        { label: 'Automatic', value: 'auto' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'clientId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'lessonId',
      type: 'text',
      required: true,
    },
    {
      name: 'lessonTitle',
      type: 'text',
    },
    {
      name: 'runId',
      type: 'text',
    },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'endedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'plannedSeconds',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'durationSeconds',
      type: 'number',
      min: 0,
    },
    {
      name: 'speed',
      type: 'number',
      defaultValue: 1,
    },
    {
      name: 'finished',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'segments',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 24,
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Optional learner-supplied context for manual entries.',
      },
    },
  ],
}

export default LearningRecords
