import React, { useEffect, useState } from 'react'
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
  const { colorScheme } = useThemeMode()

  useEffect(() => {
    loadAgents()
  }, [i18n.language])

  const loadAgents = async () => {
    try {
      setLoading(true)
      const data = await fetchAgents(i18n.language)
      setAgents(data)
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoading(false)
    }
  }

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
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
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
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff'
        }}
        edges={['left', 'right', 'bottom']}
      >
        <View style={{ flex: 1, padding: 16 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colorScheme === 'dark' ? "#fff" : "#18181b"} />
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
