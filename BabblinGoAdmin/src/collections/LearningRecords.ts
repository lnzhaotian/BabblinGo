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
    defaultColumns: ['user', 'lessonTitle', 'finished', 'updatedAt'],
  },
  timestamps: true,
  endpoints: [
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
        }
        if (!next.clientId) {
          next.clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        }
        if (typeof next.lessonTitle === 'string') {
          next.lessonTitle = next.lessonTitle.trim()
        }
        if (typeof next.segments !== 'number' || next.segments < 1) {
          next.segments = 1
        }
        return next
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
    },
  ],
}

export default LearningRecords
