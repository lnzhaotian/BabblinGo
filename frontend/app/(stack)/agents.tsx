import React, { useEffect, useState, useCallback } from 'react'
import { FlatList, Pressable, Text, View, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AgentDoc, fetchAgents } from '@/lib/payload'
import { getAuthToken } from '@/lib/auth-session'
import { useThemeMode } from '../theme-context'
import { ThemedHeader } from '@/components/ThemedHeader'

export default function AgentsScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const [agents, setAgents] = useState<AgentDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { colorScheme } = useThemeMode()

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchAgents(i18n.language)
      setAgents(data)
    } catch (error) {
      console.log('Failed to load agents:', error)
      setError(t('agents.offlineError'))
    } finally {
      setLoading(false)
    }
  }, [i18n.language, t])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  const handleAgentPress = async (agentId: string) => {
    const token = await getAuthToken()
    if (!token) {
      Alert.alert(t('common.error'), t('chat.loginRequired'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.login'), onPress: () => router.push('/auth/login') }
      ])
      return
    }
    router.push(`/(stack)/chat/${agentId}`)
  }

  const renderItem = ({ item }: { item: AgentDoc }) => (
    <Pressable
      onPress={() => handleAgentPress(item.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
        shadowColor: colorScheme === 'dark' ? '#000' : '#000',
        shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
        borderWidth: colorScheme === 'dark' ? 1 : 0,
        borderColor: colorScheme === 'dark' ? '#2f2f36' : 'transparent',
      }}
    >
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        backgroundColor: colorScheme === 'dark' ? '#18181b' : '#eef2ff',
      }}>
        <MaterialIcons
          name={(item.icon as any) || 'psychology'}
          size={24}
          color={colorScheme === 'dark' ? '#6366f1' : '#4f46e5'}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 18,
          fontWeight: 'bold',
          marginBottom: 4,
          color: colorScheme === 'dark' ? '#fff' : '#111827',
        }}>
          {item.title}
        </Text>
        {item.description && (
          <Text style={{
            fontSize: 14,
            color: colorScheme === 'dark' ? '#d1d5db' : '#4b5563',
          }} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <MaterialIcons
        name="chevron-right"
        size={28}
        color={colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af'}
      />
    </Pressable>
  )

  return (
    <>
      <ThemedHeader titleKey="agents.title" />
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#f9fafb'
        }}
        edges={['left', 'right', 'bottom']}
      >
        <View style={{ flex: 1, paddingVertical: 16 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colorScheme === 'dark' ? "#fff" : "#18181b"} />
          ) : error ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
              <MaterialIcons name="cloud-off" size={48} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} style={{ marginBottom: 16 }} />
              <Text style={{
                textAlign: 'center',
                color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
                fontSize: 16,
                lineHeight: 24
              }}>
                {error}
              </Text>
              <Pressable
                onPress={loadAgents}
                style={{
                  marginTop: 24,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  backgroundColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
                  borderRadius: 8
                }}
              >
                <Text style={{ color: colorScheme === 'dark' ? '#fff' : '#374151', fontWeight: '600' }}>
                  {t('common.refresh')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={agents}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              ListEmptyComponent={
                <Text style={{
                  textAlign: 'center',
                  marginTop: 40,
                  color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
                }}>
                  {t('agents.noAgents')}
                </Text>
              }
            />
          )}
        </View>
      </SafeAreaView>
    </>
  )
}
