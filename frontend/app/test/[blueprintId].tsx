import React, { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { startTest, submitAnswer, fetchLevelDescriptions } from '@/lib/testing-api'
import { getAuthToken } from '@/lib/auth-session'
import { QuestionDoc, TestSessionDoc, QuestionnaireDoc } from '@/lib/testing-types'
import { QuestionRenderer } from '@/components/testing/QuestionRenderer'
import { QuestionnaireRenderer } from '@/components/testing/QuestionnaireRenderer'
import { TestResultView } from '@/components/testing/TestResultView'
import { ThemedHeader } from '@/components/ThemedHeader'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function TestRunnerScreen() {
  const { t } = useTranslation()
  const { blueprintId } = useLocalSearchParams<{ blueprintId: string }>()
  const router = useRouter()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [question, setQuestion] = useState<QuestionDoc | null>(null)
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireDoc | null>(null)
  const [result, setResult] = useState<TestSessionDoc['finalResult'] | null>(null)
  
  // Answer state
  const [currentAnswer, setCurrentAnswer] = useState<any>(null)
  const startTimeRef = useRef<number>(Date.now())

  const initTest = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()
      if (!token) {
        // Should be handled by previous screen, but just in case
        router.replace('/auth/login')
        return
      }

      const data = await startTest(blueprintId!)
      setSessionId(data.sessionId)
      
      if (data.type === 'questionnaire') {
        setQuestionnaire(data.data as QuestionnaireDoc)
        setQuestion(null)
      } else {
        setQuestion(data.data as QuestionDoc)
        setQuestionnaire(null)
      }
      
      startTimeRef.current = Date.now()
    } catch (error) {
      console.error('Failed to start test:', error)
      Alert.alert(t('tests.error.generic'), t('tests.error.start'), [
        { text: t('tests.result.back'), onPress: () => router.back() }
      ])
    } finally {
      setLoading(false)
    }
  }, [blueprintId, router])

  useEffect(() => {
    if (blueprintId) {
      initTest()
    }
  }, [blueprintId, initTest])

  const handleQuestionSubmit = async () => {
    if (!sessionId || !question || currentAnswer === null) return

    try {
      setSubmitting(true)
      const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
      
      const response = await submitAnswer(sessionId, question.id, currentAnswer, timeTaken)
      
      handleResponse(response)
    } catch (error) {
      console.error('Failed to submit answer:', error)
      Alert.alert(t('tests.error.generic'), t('tests.error.submit'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuestionnaireSubmit = async (answers: Record<string, any>) => {
    if (!sessionId || !questionnaire) return

    try {
      setSubmitting(true)
      const response = await submitAnswer(sessionId, undefined, undefined, undefined, questionnaire.id, answers)
      handleResponse(response)
    } catch (error) {
      console.error('Failed to submit questionnaire:', error)
      Alert.alert(t('tests.error.generic'), t('tests.error.submit'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResponse = (response: any) => {
    if (response.status === 'completed') {
      setResult(response.result)
      setQuestion(null)
      setQuestionnaire(null)
    } else if (response.data) {
      if (response.type === 'questionnaire') {
        setQuestionnaire(response.data as QuestionnaireDoc)
        setQuestion(null)
      } else {
        setQuestion(response.data as QuestionDoc)
        setQuestionnaire(null)
      }
      setCurrentAnswer(null)
      startTimeRef.current = Date.now()
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]}>
        <ThemedHeader overrideTitle={t('tests.title')} />
        <ActivityIndicator size="large" />
        <Text style={[styles.loadingText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {t('tests.loading')}
        </Text>
      </View>
    )
  }

  if (result) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]} edges={['left', 'right', 'bottom']}>
        <ThemedHeader overrideTitle={t('tests.result.title')} />
        <TestResultView result={result} />
        <View style={{ padding: 20 }}>
            <TouchableOpacity 
            style={[styles.button, { backgroundColor: isDark ? '#3b82f6' : '#2563eb' }]}
            onPress={() => router.back()}
            >
            <Text style={styles.buttonText}>{t('tests.result.back')}</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]} edges={['left', 'right', 'bottom']}>
      <ThemedHeader overrideTitle={questionnaire ? t('tests.questionnaire.title') : t('tests.title')} />
      
      {questionnaire ? (
        <QuestionnaireRenderer 
          questionnaire={questionnaire}
          onSubmit={handleQuestionnaireSubmit}
          submitting={submitting}
        />
      ) : question ? (
        <>
          <View style={styles.content}>
            <QuestionRenderer 
              question={question} 
              onAnswerChange={setCurrentAnswer}
              submitted={submitting}
            />
          </View>
          
          <View style={[styles.footer, { backgroundColor: isDark ? '#18181b' : '#fff', borderTopColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: isDark ? '#3b82f6' : '#2563eb' },
                (submitting || currentAnswer === null) && styles.buttonDisabled
              ]}
              onPress={handleQuestionSubmit}
              disabled={submitting || currentAnswer === null}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {t('tests.next')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.center}>
           <Text style={{ color: isDark ? '#f1f5f9' : '#18181b' }}>{t('tests.error.generic')}</Text>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    paddingBottom: 16,
  },
  button: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    minWidth: 200,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 32,
  },
  scoreCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  scoreLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
  },
  passStatus: {
    fontSize: 18,
    fontWeight: '600',
  },
})
