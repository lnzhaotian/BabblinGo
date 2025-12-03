import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { fetchTestSession } from '@/lib/testing-api'
import { ThemedHeader } from '@/components/ThemedHeader'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TestResultView } from '@/components/testing/TestResultView'

export default function TestSessionDetailScreen() {
  const { t } = useTranslation()
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true)
        const data = await fetchTestSession(sessionId!)
        setSession(data)
      } catch (error) {
        console.error('Failed to load test session:', error)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      loadSession()
    }
  }, [sessionId])

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]}>
        <ThemedHeader overrideTitle='' />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (!session || !session.finalResult) {
    return (
      <SafeAreaView style={[styles.container, styles.center, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]} edges={['left', 'right', 'bottom']}>
        <ThemedHeader overrideTitle='' />
        <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{t('tests.error.generic')}</Text>
      </SafeAreaView>
    )
  }

  const blueprintTitle = session?.blueprint && typeof session.blueprint === 'object' 
    ? session.blueprint.title 
    : ''

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]} edges={['left', 'right', 'bottom']}>
      <ThemedHeader overrideTitle={blueprintTitle} />
      <TestResultView result={session.finalResult} showTitle={false} />
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
})
