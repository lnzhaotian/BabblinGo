import { PayloadHandler } from 'payload'

export const redeemActivationCodeHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { code } = body

  if (!code || typeof code !== 'string') {
    return Response.json({ message: 'Invalid code' }, { status: 400 })
  }

  try {
    // 1. Find the code
    const codes = await req.payload.find({
      collection: 'activation-codes',
      where: {
        code: {
          equals: code,
        },
      },
    })

    if (codes.totalDocs === 0) {
      return Response.json({ message: 'Invalid activation code' }, { status: 404 })
    }

    const activationCode = codes.docs[0] as unknown as { id: string; status: string; tokens: number; expiresAt?: string }

    // 2. Validate status
    if (activationCode.status !== 'active') {
      return Response.json({ message: 'This code has already been used or expired' }, { status: 400 })
    }

    // 2.1 Validate expiration
    if (activationCode.expiresAt) {
      const now = new Date()
      const expiresAt = new Date(activationCode.expiresAt)
      if (now > expiresAt) {
        // Auto-expire the code
        await req.payload.update({
          collection: 'activation-codes',
          id: activationCode.id,
          data: {
            status: 'expired',
          },
        })
        return Response.json({ message: 'This code has already been used or expired' }, { status: 400 })
      }
    }

    // 3. Mark as used
    await req.payload.update({
      collection: 'activation-codes',
      id: activationCode.id,
      data: {
        status: 'used',
        usedBy: req.user.id,
        usedAt: new Date().toISOString(),
      },
    })

    // 4. Add tokens to user
    const user = await req.payload.findByID({
      collection: 'users',
      id: req.user.id,
    }) as unknown as { tokenBalance?: number }

    const currentBalance = user.tokenBalance || 0
    const newBalance = currentBalance + activationCode.tokens

    await req.payload.update({
      collection: 'users',
      id: req.user.id,
      data: {
        tokenBalance: newBalance,
      },
    })

    return Response.json({ 
      message: 'Success', 
      addedTokens: activationCode.tokens,
      newBalance: newBalance 
    })

  } catch (error) {
    console.error('Redemption error:', error)
    return Response.json({ message: 'Internal server error' }, { status: 500 })
  }
}
