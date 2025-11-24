import type { CollectionConfig, PayloadRequest } from 'payload'
import type { LearningRecord, User } from '../payload-types'

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
      // POST /api/learning-records/manual
      path: '/manual',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const user = req?.user as User | undefined
          if (!user) {
            return Response.json({ errors: [{ message: 'Unauthorized' }] }, { status: 401 })
          }

          const rawBody: unknown = (req as PayloadRequest).body as unknown
          const body = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {}

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

          const created = (await req.payload.create({
            collection: 'learning-records',
            data: payloadData,
            draft: false,
          })) as unknown as LearningRecord

          return Response.json({ ok: true, record: created }, { status: 201 })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          return Response.json({ errors: [{ message }] }, { status: 500 })
        }
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
