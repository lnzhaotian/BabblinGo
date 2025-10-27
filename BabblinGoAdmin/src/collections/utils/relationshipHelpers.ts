import type { CollectionSlug, PayloadRequest } from 'payload'

export type RelationshipValue = string | number | { id?: string | number } | null | undefined

type ContextMap = Record<string, unknown> | undefined

export const extractRelationshipId = (value: RelationshipValue): string | null => {
  if (value === null || typeof value === 'undefined') {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number') {
    return String(value)
  }

  if (typeof value === 'object') {
    const candidate = (value as { id?: string | number }).id

    if (typeof candidate === 'string') {
      return candidate
    }

    if (typeof candidate === 'number') {
      return String(candidate)
    }
  }

  return null
}

export const uniqueRelationshipIds = (values: RelationshipValue[] | null | undefined): string[] => {
  if (!Array.isArray(values)) {
    return []
  }

  const seen = new Set<string>()

  values.forEach((value) => {
    const id = extractRelationshipId(value)
    if (id) {
      seen.add(id)
    }
  })

  return Array.from(seen)
}

export const mergeContext = (
  existing: ContextMap,
  additions: Record<string, unknown>
): Record<string, unknown> => ({ ...(existing ?? {}), ...additions })

export const updateRelationshipField = async (
  req: PayloadRequest,
  collection: CollectionSlug,
  id: string,
  field: string,
  values: string[],
  contextKey: string
) => {
  await req.payload.update({
    collection,
    id,
    data: { [field]: values },
    depth: 0,
    context: mergeContext(req.context, { [contextKey]: true }),
  })
}
