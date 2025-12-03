import { MediaDoc, LexicalRichText } from './payload'

export type QuestionType = 
  | 'multiple_choice' 
  | 'fill_blank' 
  | 'matching' 
  | 'listening_comprehension' 
  | 'reading_comprehension' 
  | 'speaking'

export type QuestionOption = {
  text: string
  isCorrect?: boolean // Usually hidden from client, but might be present in some contexts
  id?: string
}

export type MatchingItemType = 'text' | 'image'

export type MatchingPair = {
  leftType: MatchingItemType
  leftText?: string
  leftImage?: MediaDoc | string | null
  rightType: MatchingItemType
  rightText?: string
  rightImage?: MediaDoc | string | null
}

export type BlankAnswer = {
  acceptedAnswers: string
}

export type QuestionDoc = {
  id: string
  type: QuestionType
  difficulty_cefr?: string
  difficulty_actfl?: string
  stem: LexicalRichText
  media?: MediaDoc | string | null
  
  // Dynamic fields
  options?: QuestionOption[]
  matchingPairs?: MatchingPair[]
  blanks?: BlankAnswer[]
  speakingReference?: string
}

export type QuestionnaireQuestion = {
  id: string
  prompt: string
  type: 'text' | 'choice' | 'multiple_choice' | 'scale'
  options?: { label: string; value: string; id?: string }[]
}

export type QuestionnaireDoc = {
  id: string
  title: string
  description?: string
  questions: QuestionnaireQuestion[]
}

export type TestSessionDoc = {
  id: string
  status: 'started' | 'completed' | 'abandoned'
  startTime: string
  endTime?: string
  finalResult?: {
    score: number
    maxScore: number
    passed: boolean
    level?: string
    levelTitle?: string
    levelDescription?: any // RichText
    feedback?: string
    skillBreakdown?: Record<string, { correct: number; total: number }>
  }
}

export type StartTestResponse = {
  sessionId: string
  type: 'question' | 'questionnaire'
  data: QuestionDoc | QuestionnaireDoc
}

export type SubmitAnswerResponse = {
  status: 'continue' | 'completed'
  type?: 'question' | 'questionnaire'
  data?: QuestionDoc | QuestionnaireDoc
  result?: TestSessionDoc['finalResult']
}
