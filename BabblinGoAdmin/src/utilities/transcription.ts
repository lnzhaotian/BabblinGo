import OpenAI from 'openai'
import Core from '@alicloud/pop-core'

export type TranscriptSegment = {
  start: number
  end: number
  text: string
}

type TranscriptionService = 'openai' | 'aliyun'

const getService = (): TranscriptionService => {
  const service = process.env.TRANSCRIPTION_SERVICE as TranscriptionService
  if (!service) {
    console.warn('TRANSCRIPTION_SERVICE is not set in environment variables. Defaulting to "openai".')
    return 'openai'
  }
  return service
}

// OpenAI Implementation
const transcribeWithOpenAI = async (fileUrl: string): Promise<TranscriptSegment[]> => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

  const openai = new OpenAI({ apiKey })

  // OpenAI requires a file object or a fetchable stream.
  // Since we have a URL, we fetch it and pass the response body.
  const fileResponse = await fetch(fileUrl)
  if (!fileResponse.ok) throw new Error(`Failed to fetch audio file: ${fileResponse.statusText}`)
  
  const blob = await fileResponse.blob()
  const file = new File([blob], 'audio.mp3', { type: blob.type })

  const response = await openai.audio.transcriptions.create({
    file: file,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  })

  if (!response.segments) return []

  return response.segments.map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }))
}

interface AliyunSubmitResponse {
  TaskId: string
  RequestId: string
  StatusText: string
  StatusCode: number
}

interface AliyunQueryResponse {
  TaskId: string
  StatusText: string
  StatusCode: number
  Result?: {
    Sentences: Array<{
      BeginTime: number
      EndTime: number
      Text: string
    }>
  }
}

// Aliyun Implementation
const transcribeWithAliyun = async (fileUrl: string): Promise<TranscriptSegment[]> => {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET
  const appKey = process.env.ALIYUN_APP_KEY
  
  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new Error('Aliyun credentials (ACCESS_KEY_ID, ACCESS_KEY_SECRET, APP_KEY) are missing')
  }

  const client = new Core({
    accessKeyId,
    accessKeySecret,
    endpoint: 'https://filetrans.cn-shanghai.aliyuncs.com',
    apiVersion: '2018-08-17',
  })

  // 1. Submit Task
  const taskParams = {
    appkey: appKey,
    file_link: fileUrl,
    version: '4.0',
    enable_words: false,
    enable_sample_rate_adaptive: true,
  }

  const submitResponse = (await client.request('SubmitTask', {
    Task: JSON.stringify(taskParams),
  }, { method: 'POST', timeout: 30000 })) as unknown as AliyunSubmitResponse

  const taskId = submitResponse.TaskId
  if (!taskId) throw new Error('Failed to submit Aliyun transcription task')

  // 2. Poll for Results
  let statusText = 'QUEUEING'
  let result: AliyunQueryResponse['Result'] | null = null
  const maxRetries = 60 // 60 * 2s = 2 minutes timeout (adjust as needed)
  let retries = 0

  while ((statusText === 'QUEUEING' || statusText === 'RUNNING') && retries < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, 2000)) // Wait 2s
    
    const queryResponse = (await client.request('GetTaskResult', {
      TaskId: taskId,
    }, { method: 'GET', timeout: 30000 })) as unknown as AliyunQueryResponse

    statusText = queryResponse.StatusText
    if (statusText === 'SUCCESS') {
      result = queryResponse.Result || null
      break
    }
    retries++
  }

  if (statusText !== 'SUCCESS' || !result) {
    throw new Error(`Aliyun transcription failed or timed out. Status: ${statusText}`)
  }

  // 3. Parse Results
  // Aliyun returns times in milliseconds
  const segments: TranscriptSegment[] = (result.Sentences || []).map((sent) => ({
    start: sent.BeginTime / 1000,
    end: sent.EndTime / 1000,
    text: sent.Text,
  }))

  return segments
}

export const generateTranscript = async (fileUrl: string): Promise<TranscriptSegment[]> => {
  const service = getService()
  console.log(`Starting transcription using service: ${service} for file: ${fileUrl}`)

  try {
    if (service === 'aliyun') {
      return await transcribeWithAliyun(fileUrl)
    } else {
      return await transcribeWithOpenAI(fileUrl)
    }
  } catch (error) {
    console.error('Transcription error:', error)
    throw error
  }
}
