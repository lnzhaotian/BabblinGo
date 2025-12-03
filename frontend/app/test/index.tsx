import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, Href } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useThemeMode } from '@/app/theme-context'
import { fetchTestBlueprints } from '@/lib/testing-api'
import { getAuthToken } from '@/lib/auth-session'
import { Ionicons } from '@expo/vector-icons'
import { ThemedHeader } from '@/components/ThemedHeader'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function TestListScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === 'dark'
  const [blueprints, setBlueprints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlueprints()
  }, [])

  const loadBlueprints = async () => {
    try {
      const data = await fetchTestBlueprints()
      setBlueprints(data)
    } catch (error) {
      console.error('Failed to load blueprints:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTestPress = async (blueprintId: string) => {
    const token = await getAuthToken()
    if (!token) {
      router.push('/auth/login')
      return
    }
    router.push(`/test/${blueprintId}` as Href)
  }

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
          shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          borderWidth: colorScheme === 'dark' ? 1 : 0,
          borderColor: colorScheme === 'dark' ? '#2f2f36' : 'transparent',
        }
      ]}
      onPress={() => handleTestPress(item.id)}
    >
      <View style={styles.cardContent}>
        <Text style={[styles.title, { color: isDark ? '#f1f5f9' : '#18181b' }]}>
          {item.title}
        </Text>
        {item.description && (
          <Text style={[styles.description, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            {item.description}
          </Text>
        )}
        <View style={styles.metaContainer}>
          <View style={[styles.badge, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Text style={[styles.badgeText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              {item.strategy === 'linear' ? t('tests.strategy.linear') : t('tests.strategy.adaptive')}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={isDark ? '#64748b' : '#94a3b8'} />
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]}>
        <ThemedHeader overrideTitle={t('tests.title')} />
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#18181b' : '#ffffff' }]} edges={['left', 'right', 'bottom']}>
      <ThemedHeader overrideTitle={t('tests.title')} />
      <FlatList
        data={blueprints}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              {t('tests.empty')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
  },
  metaContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
})
