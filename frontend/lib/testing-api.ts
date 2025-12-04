import { config } from './config'
import { StartTestResponse, SubmitAnswerResponse } from './testing-types'

const getAuthToken = async () => {
  const { getAuthToken } = await import('./auth-session')
  return getAuthToken()
}

const fetchWithAuth = async (path: string, options: RequestInit = {}) => {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `JWT ${token}`
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()
    // If 400 and "No questions found", it might be a configuration issue or end of test
    // But for now, we just throw to let the UI handle it
    throw new Error(`API Error: ${response.status} ${errorText}`)
  }

  return response.json()
}

export const fetchTestBlueprints = async (): Promise<any[]> => {
  const response = await fetchWithAuth('/api/test-blueprints?limit=100')
  return response.docs
}

export const startTest = async (blueprintId: string): Promise<StartTestResponse> => {
  return fetchWithAuth('/api/tests/start', {
    method: 'POST',
    body: JSON.stringify({ blueprintId }),
  })
}

export const submitAnswer = async (
  sessionId: string,
  questionId?: string,
  answer?: any,
  timeTaken?: number,
  questionnaireId?: string,
  answers?: Record<string, any>
): Promise<SubmitAnswerResponse> => {
  return fetchWithAuth('/api/tests/submit', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      questionId,
      answer,
      timeTaken,
      questionnaireId,
      answers
    }),
  })
}

export const fetchTestSessions = async (): Promise<any[]> => {
  const response = await fetchWithAuth('/api/test-sessions?sort=-createdAt&limit=50')
  return response.docs
}

export const fetchTestSession = async (sessionId: string): Promise<any> => {
  return fetchWithAuth(`/api/test-sessions/${sessionId}`)
}

export const fetchLevelDescriptions = async (): Promise<any[]> => {
  const response = await fetchWithAuth('/api/level-descriptions?limit=100')
  return response.docs
}

export const uploadMedia = async (uri: string): Promise<any> => {
  const token = await getAuthToken()
  
  const finalUri = uri.startsWith('file://') ? uri : `file://${uri}`

  const formData = new FormData()
  
  // Payload CMS expects additional data in a '_payload' JSON string field
  formData.append('_payload', JSON.stringify({
    alt: 'Speaking Test Recording'
  }))
  
  formData.append('file', {
    uri: finalUri,
    name: 'recording.m4a',
    type: 'audio/m4a'
  } as any)

  const response = await fetch(`${config.apiUrl}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `JWT ${token}`,
      'Accept': 'application/json',
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Upload Error: ${response.status} ${errorText}`)
  }

  return response.json()
}
