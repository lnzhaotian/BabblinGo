import type { PayloadHandler, Payload } from 'payload'

const getAgentConfig = async (payload: Payload, agentId: string) => {
  const agent = await payload.findByID({
    collection: 'agents',
    id: agentId,
  })

  if (!agent || !agent.difyApiKey) {
    throw new Error('Agent not found or missing API key')
  }

  const baseUrl = (agent.difyApiUrl || 'https://ai.babblinguide.cn/v1').replace(/\/$/, '')
  return { apiKey: agent.difyApiKey, baseUrl }
}

// Helper to update balance
const deductTokens = async (payload: Payload, userId: string, tokens: number) => {
  try {
    const user = await payload.findByID({ collection: 'users', id: userId })
    if (!user) return
    const currentBalance = (user.tokenBalance as number) || 0
    const newBalance = Math.max(0, currentBalance - tokens)
    
    await payload.update({
      collection: 'users',
      id: userId,
      data: { tokenBalance: newBalance }
    })
    console.log(`Deducted ${tokens} tokens from user ${userId}. New balance: ${newBalance}`)
  } catch (_e) {
    console.error('Failed to deduct tokens', _e)
  }
}

export const difyChatHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check token balance
  const user = req.user as unknown as { id: string; tokenBalance?: number }
  if ((user.tokenBalance ?? 0) <= 0) {
      return new Response(JSON.stringify({ 
          code: 'insufficient_quota', 
          message: 'Insufficient tokens. Please recharge.' 
      }), { 
          status: 402,
          headers: { 'Content-Type': 'application/json' }
      })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { agentId, query, conversationId, inputs } = body

  if (!agentId || !query) {
    return new Response('Missing agentId or query', { status: 400 })
  }

  try {
    const { apiKey, baseUrl } = await getAgentConfig(req.payload, agentId)
    const responseMode = body.response_mode || 'blocking'

    const response = await fetch(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: inputs || {},
        query,
        response_mode: responseMode,
        conversation_id: conversationId,
        user: req.user.id,
        files: [],
      }),
    })

    if (!response.ok) {
        // Forward error
        return new Response(response.body, {
            status: response.status,
            headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' }
        })
    }

    if (responseMode === 'streaming') {
        const reader = response.body?.getReader()
        if (!reader) return new Response('No response body', { status: 500 })

        const stream = new ReadableStream({
            async start(controller) {
                const decoder = new TextDecoder()
                let buffer = ''
                
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        
                        const chunk = decoder.decode(value, { stream: true })
                        buffer += chunk
                        
                        // Process lines
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || '' // Keep incomplete line
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const jsonStr = line.slice(6)
                                    const data = JSON.parse(jsonStr)
                                    if (data.event === 'message_end' && data.metadata?.usage?.total_tokens) {
                                        const tokens = data.metadata.usage.total_tokens
                                        // Deduct tokens asynchronously
                                        deductTokens(req.payload, user.id, tokens)
                                    }
                                } catch (_e) {
                                    // Ignore parse errors for intermediate chunks
                                }
                            }
                        }
                        
                        controller.enqueue(value)
                    }
                } catch (e) {
                    controller.error(e)
                } finally {
                    controller.close()
                }
            }
        })
        
        return new Response(stream, {
            status: response.status,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
            },
        })
    } else {
        // Blocking
        const data = await response.json()
        if (data.metadata?.usage?.total_tokens) {
             await deductTokens(req.payload, user.id, data.metadata.usage.total_tokens)
        }
        return Response.json(data)
    }

  } catch (error) {
    console.error('Dify API Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const getConversationsHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    console.log('getConversationsHandler: Unauthorized (no user)')
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const agentId = url.searchParams.get('agentId')
  const lastId = url.searchParams.get('last_id')
  const limit = url.searchParams.get('limit') || '20'

  if (!agentId) {
    console.log('getConversationsHandler: Missing agentId')
    return new Response('Missing agentId', { status: 400 })
  }

  try {
    const { apiKey, baseUrl } = await getAgentConfig(req.payload, agentId)

    let targetUserId = req.user.id
    const requestedUserId = url.searchParams.get('userId')
    
    if (requestedUserId && requestedUserId !== req.user.id) {
        // Role check
        const user = req.user as unknown as { role: string }
        if (user.role === 'manager') {
            targetUserId = requestedUserId
        } else {
            return new Response('Forbidden: Only managers can view other users history', { status: 403 })
        }
    }

    const params = new URLSearchParams({
      user: targetUserId,
      limit,
    })
    if (lastId) params.append('last_id', lastId)

    const difyUrl = `${baseUrl}/conversations?${params.toString()}`
    console.log(`Fetching conversations from: ${difyUrl}`)

    const response = await fetch(difyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Dify API Error (getConversations): ${response.status} ${errorText}`)
      return new Response(`Dify API Error: ${errorText}`, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Dify API Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const getMessagesHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    console.log('getMessagesHandler: Unauthorized')
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const agentId = url.searchParams.get('agentId')
  const conversationId = url.searchParams.get('conversationId')
  const firstId = url.searchParams.get('first_id')
  const limit = url.searchParams.get('limit') || '20'

  if (!agentId || !conversationId) {
    console.log('getMessagesHandler: Missing agentId or conversationId')
    return new Response('Missing agentId or conversationId', { status: 400 })
  }

  try {
    const { apiKey, baseUrl } = await getAgentConfig(req.payload, agentId)

    let targetUserId = req.user.id
    const requestedUserId = url.searchParams.get('userId')
    
    if (requestedUserId && requestedUserId !== req.user.id) {
        if ((req.user as unknown as { role: string }).role === 'manager') {
            targetUserId = requestedUserId
        } else {
            return new Response('Forbidden: Only managers can view other users history', { status: 403 })
        }
    }

    const params = new URLSearchParams({
      user: targetUserId,
      conversation_id: conversationId,
      limit,
    })
    if (firstId) params.append('first_id', firstId)

    const difyUrl = `${baseUrl}/messages?${params.toString()}`
    console.log(`Fetching messages from: ${difyUrl}`)

    const response = await fetch(difyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Dify API Error (getMessages): ${response.status} ${errorText}`)
      return new Response(`Dify API Error: ${errorText}`, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Dify API Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const renameConversationHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { agentId, conversationId, name, userId } = body

  if (!agentId || !conversationId) {
    return new Response('Missing agentId or conversationId', { status: 400 })
  }

  try {
    const { apiKey, baseUrl } = await getAgentConfig(req.payload, agentId)

    let targetUserId = req.user.id
    if (userId && userId !== req.user.id) {
        if ((req.user as unknown as { role: string }).role === 'manager') {
            targetUserId = userId
        } else {
            return new Response('Forbidden: Only managers can manage other users history', { status: 403 })
        }
    }

    const response = await fetch(`${baseUrl}/conversations/${conversationId}/name`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        user: targetUserId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Dify API Error (renameConversation): ${response.status} ${errorText}`)
      return new Response(`Dify API Error: ${errorText}`, { status: response.status })
    }

    const data = await response.json()
    return Response.json(data)
  } catch (error) {
    console.error('Dify API Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const deleteConversationHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    console.log('deleteConversationHandler: Unauthorized')
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { agentId, conversationId, userId } = body

  if (!agentId || !conversationId) {
    console.log('deleteConversationHandler: Missing agentId or conversationId')
    return new Response('Missing agentId or conversationId', { status: 400 })
  }

  try {
    const { apiKey, baseUrl } = await getAgentConfig(req.payload, agentId)

    let targetUserId = req.user.id
    if (userId && userId !== req.user.id) {
        if ((req.user as unknown as { role: string }).role === 'manager') {
            targetUserId = userId
        } else {
            return new Response('Forbidden: Only managers can manage other users history', { status: 403 })
        }
    }

    const difyUrl = `${baseUrl}/conversations/${conversationId}`
    console.log(`Deleting conversation at: ${difyUrl}`)

    const response = await fetch(difyUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: targetUserId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Dify API Error (deleteConversation): ${response.status} ${errorText}`)
      return new Response(`Dify API Error: ${errorText}`, { status: response.status })
    }

    const text = await response.text()
    try {
      const data = text ? JSON.parse(text) : { success: true }
      return Response.json(data)
    } catch (_e) {
      // If it's not JSON but status is ok, assume success
      return Response.json({ success: true })
    }
  } catch (error) {
    console.error('Dify API Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export const generateTitleHandler: PayloadHandler = async (req): Promise<Response> => {
  if (!req.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    // @ts-expect-error - req.json() exists in standard Request
    body = await req.json()
  } catch (_e) {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { agentId, conversationId, userId } = body

  if (!agentId || !conversationId) {
    return new Response('Missing agentId or conversationId', { status: 400 })
  }

  try {
    const { apiKey: agentApiKey, baseUrl: agentBaseUrl } = await getAgentConfig(req.payload, agentId)

    let targetUserId = req.user.id
    if (userId && userId !== req.user.id) {
        if ((req.user as unknown as { role: string }).role === 'manager') {
            targetUserId = userId
        } else {
            return new Response('Forbidden: Only managers can manage other users history', { status: 403 })
        }
    }

    // Get System Settings for Summarizer Agent
    const systemSettings = (await req.payload.findGlobal({
        slug: 'system-settings',
    })) as unknown as { summarizerAgentApiKey?: string; summarizerAgentApiUrl?: string }
    
    const summarizerApiKey = systemSettings.summarizerAgentApiKey
    const summarizerBaseUrl = (systemSettings.summarizerAgentApiUrl || 'https://ai.babblinguide.cn/v1').replace(/\/$/, '')

    if (!summarizerApiKey) {
        console.warn('Summarizer Agent API Key not configured in System Settings. Falling back to Agent config.')
    }

    const summaryApiKey = summarizerApiKey || agentApiKey
    const summaryBaseUrl = summarizerApiKey ? summarizerBaseUrl : agentBaseUrl

    // 1. Fetch messages to summarize (from original agent)
    const msgsParams = new URLSearchParams({
      user: targetUserId,
      conversation_id: conversationId,
      limit: '5',
    })
    
    const msgsResponse = await fetch(`${agentBaseUrl}/messages?${msgsParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${agentApiKey}` }
    })
    
    if (!msgsResponse.ok) throw new Error('Failed to fetch messages for summary')
    const msgsData = await msgsResponse.json()
    // Dify returns newest first, so reverse to get chronological order
    const messages = (msgsData.data || []).reverse()
    
    const transcript = messages.map((m: { query: string; answer: string }) => `User: ${m.query}\nAI: ${m.answer}`).join('\n\n')

    // Use a system user ID for the summary generation to avoid polluting the user's history
    const summaryUser = `system_${targetUserId}`

    // Helper to perform the summary request
    const performSummaryRequest = async (apiKey: string, baseUrl: string) => {
        return fetch(`${baseUrl}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: {},
                query: `Generate a very short title (3-5 words) for this conversation. Do not use quotes. Output only the title.\n\n${transcript}`,
                response_mode: 'blocking',
                user: summaryUser,
            }),
        })
    }

    // Helper for Workflow Request
    const performWorkflowRequest = async (apiKey: string, baseUrl: string) => {
         return fetch(`${baseUrl}/workflows/run`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: {
                    // We pass the full prompt as 'query' variable. 
                    // User must define 'query' as input in their workflow.
                    query: `Generate a very short title (3-5 words) for this conversation. Do not use quotes. Output only the title.\n\n${transcript}`
                },
                response_mode: 'blocking',
                user: summaryUser,
            }),
        })
    }

    // 2. Ask AI to generate title
    let activeSummaryApiKey = summaryApiKey
    let activeSummaryBaseUrl = summaryBaseUrl
    
    let summaryResponse = await performSummaryRequest(activeSummaryApiKey, activeSummaryBaseUrl)
    let summaryData: { answer?: string; conversation_id?: string } | null = null

    // Check for specific error: not_chat_app. If we are using a dedicated summarizer key, try workflow or fallback.
    if (!summaryResponse.ok && summaryResponse.status === 400 && summarizerApiKey) {
        const errorClone = summaryResponse.clone()
        try {
            const errorJson = await errorClone.json()
            if (errorJson.code === 'not_chat_app') {
                console.log('Summarizer Agent is not a Chat App. Attempting Workflow API...')
                
                // Try Workflow API
                const workflowResponse = await performWorkflowRequest(activeSummaryApiKey, activeSummaryBaseUrl)
                
                if (workflowResponse.ok) {
                    const workflowData = await workflowResponse.json()
                    // Extract answer from workflow outputs
                    // We look for 'title', 'output', 'text', 'answer', or just take the first value
                    const outputs = workflowData.data?.outputs || {}
                    const outputKeys = Object.keys(outputs)
                    let answer = ''
                    if (outputs.title) answer = outputs.title
                    else if (outputs.output) answer = outputs.output
                    else if (outputs.text) answer = outputs.text
                    else if (outputs.answer) answer = outputs.answer
                    else if (outputKeys.length > 0) answer = outputs[outputKeys[0]]
                    
                    if (answer) {
                        // Mock a summaryData structure to reuse existing parsing logic
                        summaryData = { answer }
                        // We don't need to delete temp conversation for workflows usually, but let's keep it clean
                        // Workflows don't create "conversations" in the same way, so conversation_id might be null or different
                        // But we set summaryResponse to ok to bypass the error check below
                        summaryResponse = { ok: true, status: 200, json: async () => summaryData } as unknown as Response
                    } else {
                         console.warn('Workflow executed but no suitable output found.')
                         // Fallback to original agent
                         activeSummaryApiKey = agentApiKey
                         activeSummaryBaseUrl = agentBaseUrl
                         summaryResponse = await performSummaryRequest(activeSummaryApiKey, activeSummaryBaseUrl)
                    }
                } else {
                    console.warn('Workflow API failed. Falling back to original agent.')
                    activeSummaryApiKey = agentApiKey
                    activeSummaryBaseUrl = agentBaseUrl
                    summaryResponse = await performSummaryRequest(activeSummaryApiKey, activeSummaryBaseUrl)
                }
            }
        } catch (_e) {
            // Ignore JSON parse error, will be handled by the main error check
        }
    }

    if (!summaryResponse.ok) {
        const errorText = await summaryResponse.text()
        console.error(`Failed to generate summary: ${summaryResponse.status} ${errorText}`)
        throw new Error('Failed to generate summary')
    }
    
    if (!summaryData) {
        summaryData = await summaryResponse.json()
    }
    
    let rawAnswer = summaryData?.answer || ''
    // Remove <think> blocks (including multiline)
    rawAnswer = rawAnswer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    
    let newTitle = rawAnswer.replace(/^["']|["']$/g, '')
    
    // Sanitize title
    if (!newTitle) newTitle = 'New Chat'
    if (newTitle.length > 50) newTitle = newTitle.substring(0, 50)
    
    console.log(`Generated title: "${newTitle}" for conversation: ${conversationId}`)

    const tempConversationId = summaryData?.conversation_id
    console.log(`Temp conversation ID to delete: ${tempConversationId}`)

    // 3. Rename the original conversation (using Original Agent)
    const renameResponse = await fetch(`${agentBaseUrl}/conversations/${conversationId}/name`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agentApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newTitle,
        user: targetUserId,
      }),
    })
    
    if (!renameResponse.ok) {
        const errorText = await renameResponse.text()
        console.error(`Failed to rename conversation: ${renameResponse.status} ${errorText}`)
        // We continue to delete the temp conversation even if rename fails
    }

    // 4. Clean up temp conversation (using the agent that created it)
    if (tempConversationId) {
        try {
            // Add a small delay to ensure Dify has processed the conversation creation
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            const deleteResponse = await fetch(`${activeSummaryBaseUrl}/conversations/${tempConversationId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${activeSummaryApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user: summaryUser })
            })
            
            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text()
                console.error(`Failed to delete temp conversation: ${deleteResponse.status} ${errorText}`)
            } else {
                console.log(`Successfully deleted temp conversation: ${tempConversationId}`)
            }
        } catch (delError) {
            console.error('Error deleting temp conversation:', delError)
        }
    }

    if (!renameResponse.ok) {
        throw new Error('Failed to rename conversation')
    }

    return Response.json({ name: newTitle })

  } catch (error) {
    console.error('Generate Title Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
