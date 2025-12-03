import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { fetchTestSessions } from '@/lib/testing-api'
import { ThemedHeader } from '@/components/ThemedHeader'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'

export default function TestHistoryScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await fetchTestSessions()
      setSessions(data.filter((s: any) => s.status === 'completed'))
    } catch (error) {
      console.error('Failed to load test sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderItem = ({ item }: { item: any }) => {
    const date = new Date(item.startTime).toLocaleDateString()
    const score = item.finalResult?.score
    const maxScore = item.finalResult?.maxScore
    const passed = item.finalResult?.passed
    const blueprintTitle = typeof item.blueprint === 'object' ? item.blueprint.title : 'Test'
    const isAdaptive = typeof item.blueprint === 'object' && item.blueprint.strategy === 'adaptive_rule_based'

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: isDark ? '#18181b' : '#fff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}
        onPress={() => router.push(`/(stack)/test-history/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: isDark ? '#f1f5f9' : '#18181b' }]}>
            {blueprintTitle}
          </Text>
          <Text style={[styles.date, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {date}
          </Text>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.statusContainer}>
             {item.status === 'completed' ? (
                 isAdaptive ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="school" size={20} color={isDark ? '#60a5fa' : '#3b82f6'} />
                        <Text style={[styles.statusText, { color: isDark ? '#60a5fa' : '#3b82f6' }]}>
                            {item.finalResult?.levelTitle || item.finalResult?.level}
                        </Text>
                    </View>
                 ) : (
                    <>
                        <Ionicons 
                            name={passed ? "checkmark-circle" : "close-circle"} 
                            size={20} 
                            color={passed ? "#22c55e" : "#ef4444"} 
                        />
                        <Text style={[styles.statusText, { color: passed ? '#22c55e' : '#ef4444' }]}>
                            {passed ? t('tests.result.passed') : t('tests.result.failed')}
                        </Text>
                    </>
                 )
             ) : (
                 <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{item.status}</Text>
             )}
          </View>
          
          {item.finalResult && !isAdaptive && (
              <Text style={[styles.score, { color: isDark ? '#f1f5f9' : '#18181b' }]}>
                {score} / {maxScore}
              </Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#fff' }]} edges={['left', 'right', 'bottom']}>
      <ThemedHeader overrideTitle={t('tests.history.title')} />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: isDark ? '#94a3b8' : '#64748b' }}>{t('tests.history.empty')}</Text>
            </View>
          }
        />
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
    padding: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  date: {
    fontSize: 14,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontWeight: '600',
  },
  score: {
    fontSize: 18,
    fontWeight: '700',
  },
})
