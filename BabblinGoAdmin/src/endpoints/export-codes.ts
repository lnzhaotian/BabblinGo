import { PayloadHandler } from 'payload'

export const exportActivationCodesHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check for manager role
  const user = req.user as unknown as { collection: string; role: string }
  if (user.collection !== 'users' || user.role !== 'manager') {
    return new Response('Forbidden', { status: 403 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const batchId = url.searchParams.get('batchId')
  const format = url.searchParams.get('format') || 'txt' // txt or csv

  if (!batchId) {
    return new Response('Missing batchId', { status: 400 })
  }

  try {
    // Fetch codes for the batch
    const result = await req.payload.find({
      collection: 'activation-codes',
      where: {
        batch: {
          equals: batchId,
        },
      },
      limit: 10000, // Adjust limit as needed
      pagination: false,
    })

    const codes = result.docs as unknown as Array<{ code: string; tokens: number; status: string; expiresAt?: string }>

    if (codes.length === 0) {
      return new Response('No codes found for this batch', { status: 404 })
    }

    let content = ''
    let contentType = 'text/plain'
    const filename = `batch-${batchId}.${format}`

    if (format === 'csv') {
      contentType = 'text/csv'
      content = 'Code,Tokens,Status,ExpiresAt\n'
      content += codes
        .map((doc) => `${doc.code},${doc.tokens},${doc.status},${doc.expiresAt || ''}`)
        .join('\n')
    } else {
      // TXT format: just the codes, one per line
      content = codes.map((doc) => doc.code).join('\n')
    }

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
