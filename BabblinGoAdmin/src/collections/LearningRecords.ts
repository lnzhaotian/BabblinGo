import type { CollectionConfig, PayloadRequest } from 'payload'

type ManageArgs = {
  req: PayloadRequest
  doc?: {
    user?: string | { id?: string | null } | null
  } | null
}

const canManage = ({ req, doc }: ManageArgs) => {
  const user = req?.user
  if (!user) return false
  if (user.role === 'manager' || user.role === 'editor') return true
  const ownerId = typeof doc?.user === 'string' ? doc.user : doc?.user?.id
  return ownerId === user.id
}

export const LearningRecords: CollectionConfig = {
  slug: 'learning-records',
  admin: {
    useAsTitle: 'lessonTitle',
    group: 'Learning',
    defaultColumns: ['user', 'lessonTitle', 'finished', 'updatedAt'],
  },
  timestamps: true,
  access: {
    read: ({ req }) => {
      const user = req?.user
      if (!user) return false
      if (user.role === 'manager' || user.role === 'editor') {
        return true
      }
      return {
        user: {
          equals: user.id,
        },
      }
    },
    create: ({ req }) => !!req?.user,
    update: (args) => canManage(args),
    delete: (args) => canManage(args),
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
