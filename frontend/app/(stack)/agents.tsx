import React, { useEffect, useState } from 'react'
import { FlatList, Pressable, Text, View, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AgentDoc, fetchAgents } from '@/lib/payload'
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

  const renderItem = ({ item }: { item: AgentDoc }) => (
    <Pressable
      onPress={() => router.push(`/(stack)/chat/${item.id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#fff',
      }}
    >
      <View style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        backgroundColor: colorScheme === 'dark' ? '#374151' : '#eff6ff',
      }}>
        <MaterialIcons 
          name={(item.icon as any) || 'psychology'} 
          size={24} 
          color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} 
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
            color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
          }} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <MaterialIcons 
        name="chevron-right" 
        size={24} 
        color={colorScheme === 'dark' ? '#9CA3AF' : '#9CA3AF'} 
      />
    </Pressable>
  )

  return (
    <>
      <ThemedHeader titleKey="agents.title" />
      <SafeAreaView 
        style={{ 
          flex: 1, 
          backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb' 
        }} 
        edges={['left', 'right', 'bottom']}
      >
        <View style={{ flex: 1, padding: 16 }}>
          {loading ? (
            <ActivityIndicator size="large" color="#2563EB" />
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
