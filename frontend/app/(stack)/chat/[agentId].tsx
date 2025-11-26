import React, { useEffect, useState, useRef } from 'react'
import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Alert, Modal } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { AgentDoc, fetchAgents, streamDifyMessage, fetchConversations, fetchMessages, deleteConversation, generateConversationTitle } from '@/lib/payload'
// import { getAuthToken } from '@/lib/auth-session'
import { useThemeMode } from '../../theme-context'
import { ThemedHeader } from '@/components/ThemedHeader'
import Markdown from 'react-native-markdown-display'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

type Conversation = {
  id: string
  name: string
  inputs: any
  introduction: string
  created_at: number
}

export default function ChatScreen() {
  const { agentId } = useLocalSearchParams<{ agentId: string }>()
  // const router = useRouter()
  const { t, i18n } = useTranslation()
  const { colorScheme } = useThemeMode()
  
  const [agent, setAgent] = useState<AgentDoc | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  const [historyVisible, setHistoryVisible] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Track if this is the first exchange to trigger summarization
  const isFirstExchange = useRef(true)
  const flatListRef = useRef<FlatList>(null)

  // Auth check moved to agents list screen to prevent entry
  // useEffect(() => {
  //   const checkAuth = async () => {
  //     const token = await getAuthToken()
  //     if (!token) {
  //       Alert.alert(t('common.error'), t('chat.loginRequired'), [
  //         { text: t('common.cancel'), style: 'cancel', onPress: () => router.back() },
  //         { text: t('settings.login'), onPress: () => router.push('/auth/login') }
  //       ])
  //     }
  //   }
  //   checkAuth()
  // }, [router, t])

  useEffect(() => {
    const loadAgent = async () => {
      try {
        const agents = await fetchAgents(i18n.language)
        const found = agents.find(a => a.id === agentId)
        if (found) {
          setAgent(found)
          startNewChat(found)
        }
      } catch (error) {
        console.error('Failed to load agent:', error)
      }
    }
    loadAgent()
  }, [agentId, i18n.language])

  const startNewChat = (agentDoc: AgentDoc) => {
    setConversationId(undefined)
    setMessages([])
    isFirstExchange.current = true
    if (agentDoc.welcomeMessage) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: agentDoc.welcomeMessage,
        createdAt: Date.now()
      }])
    }
  }

  const loadConversations = async () => {
    if (!agentId) return
    try {
      setLoadingHistory(true)
      const data = await fetchConversations(agentId)
      setConversations(data.data || [])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadConversation = async (convId: string) => {
    if (!agentId) return
    try {
      setLoadingHistory(true)
      const data = await fetchMessages(agentId, convId)
      // Dify API returns list.
      // We need to map them.
      // Dify returns messages in reverse chronological order (newest first) by default.
      // However, it seems in some versions or configs it might be chronological.
      // The user reported seeing newest at top with .reverse(), implying Dify returned oldest first.
      // Let's try without reverse() to see if it fixes the order.
      // Update: Actually, if Dify returns Newest First [Msg3, Msg2, Msg1], and we want Oldest First [Msg1, Msg2, Msg3], we MUST reverse.
      // But the user says they see Newest at Top. This means we HAVE Newest First in our state.
      // This means .reverse() produced Newest First.
      // This means Dify returned Oldest First.
      // So we should REMOVE .reverse().
      const mappedMessages: Message[] = (data.data || []).flatMap((msg: any) => {
        const msgs: Message[] = []
        if (msg.query) {
          msgs.push({
            id: msg.id + '_user',
            role: 'user',
            content: msg.query,
            createdAt: msg.created_at * 1000
          })
        }
        if (msg.answer) {
          msgs.push({
            id: msg.id + '_assistant',
            role: 'assistant',
            content: msg.answer,
            createdAt: msg.created_at * 1000
          })
        }
        return msgs
      })
      
      setMessages(mappedMessages)
      setConversationId(convId)
      isFirstExchange.current = false // Loaded conversation is not new
      setHistoryVisible(false)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteConversation = async (convId: string) => {
    if (!agentId) return
    try {
      await deleteConversation(agentId, convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (conversationId === convId) {
        if (agent) startNewChat(agent)
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      createdAt: Date.now()
    }

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setSending(true)

    // Create placeholder for assistant message
    const botMsgId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: botMsgId,
      role: 'assistant',
      content: '',
      createdAt: Date.now()
    }])

    let currentConversationId = conversationId

    try {
      await streamDifyMessage(
        agentId!,
        userMsg.content,
        conversationId,
        (answer, newConversationId) => {
          if (newConversationId) {
            setConversationId(newConversationId)
            currentConversationId = newConversationId
          }
          setMessages(prev => prev.map(msg => {
            if (msg.id === botMsgId) {
              return { ...msg, content: msg.content + answer }
            }
            return msg
          }))
        },
        () => {
          setSending(false)
          // If this was the first exchange, generate a title
          if (isFirstExchange.current && currentConversationId) {
             isFirstExchange.current = false
             // Trigger background title generation
             generateConversationTitle(agentId!, currentConversationId).catch(err => {
               console.log('Failed to auto-generate title:', err)
             })
          }
        },
        (error) => {
          console.error('Chat error:', error)
          setSending(false)
          // Optionally remove the empty message or show error
        }
      )
    } catch (error) {
      console.error('Chat setup error:', error)
      setSending(false)
    }
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user'
    
    // Parse <think> tags
    let content = item.content
    let isThinking = false
    
    if (!isUser) {
      if (!content) {
        isThinking = true
      } else if (content.startsWith('<think>')) {
        if (content.includes('</think>')) {
          // Thinking complete, remove the tag
          content = content.replace(/<think>.*?<\/think>/s, '').trim()
          // If content is empty after removing think tag, show spinner
          if (!content) isThinking = true
        } else {
          // Still thinking
          isThinking = true
          content = '' // Hide content while thinking
        }
      }
    }

    return (
      <View style={{
        flexDirection: 'row',
        marginBottom: 16,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}>
        {/* {!isUser && (
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
            backgroundColor: colorScheme === 'dark' ? '#374151' : '#dbeafe',
          }}>
            <MaterialIcons name={"psychology" as any} size={16} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
          </View>
        )} */}
        <View style={{
          maxWidth: isUser ? '80%' : '100%',
          padding: isUser ? 12 : 0,
          borderRadius: isUser ? 16 : 0,
          backgroundColor: isUser 
            ? (colorScheme === 'dark' ? '#2563EB' : '#3b82f6') 
            : (colorScheme === 'dark' ? 'transparent' : 'transparent'),
        }}>
          {isThinking ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'} style={{ marginRight: 8 }} />
              <Text style={{ color: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280', fontStyle: 'italic' }}>
                {t('chat.thinking')}
              </Text>
            </View>
          ) : (
            isUser ? (
              <Text style={{
                fontSize: 16,
                color: '#fff',
              }}>
                {content}
              </Text>
            ) : (
              <Markdown
                style={{
                  body: {
                    color: colorScheme === 'dark' ? '#f3f4f6' : '#111827',
                    fontSize: 16,
                  },
                  paragraph: {
                    marginBottom: 8,
                  },
                  link: {
                    color: colorScheme === 'dark' ? '#60A5FA' : '#2563EB',
                  },
                }}
              >
                {content}
              </Markdown>
            )
          )}
        </View>
      </View>
    )
  }

  return (
    <>
      <ThemedHeader 
        overrideTitle={agent?.title} 
        titleKey={!agent?.title ? 'agents.title' : undefined}
        headerRight={() => (
          <Pressable onPress={() => {
            setHistoryVisible(true)
            loadConversations()
          }}
            style={{ paddingHorizontal: 12, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' }}
          >
            <MaterialIcons name="history" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
          </Pressable>
        )}
      />
      <SafeAreaView 
        style={{ 
          flex: 1, 
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff' 
        }} 
        edges={['left', 'right', 'bottom']}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <View style={{
            paddingTop: 8,
            paddingBottom: 24,
            paddingHorizontal: 8,
            borderColor: colorScheme === 'dark' ? '#1f2937' : '#f3f4f6',
            backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 9999,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f3f4f6',
            }}>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 16,
                  maxHeight: 96,
                  color: colorScheme === 'dark' ? '#fff' : '#111827',
                }}
                placeholder={t('chat.placeholder')}
                placeholderTextColor={colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
              />
              <Pressable 
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
                style={{
                  marginLeft: 8,
                  padding: 8,
                  marginRight: -8,
                  borderRadius: 9999,
                  backgroundColor: !inputText.trim() || sending 
                    ? (colorScheme === 'dark' ? '#374151' : '#d1d5db')
                    : '#3b82f6',
                }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialIcons name="send" size={16} color="white" />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal
          visible={historyVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setHistoryVisible(false)}
        >
          <View style={{ 
            flex: 1, 
            backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
            paddingTop: Platform.OS === 'android' ? 20 : 16,
            paddingHorizontal: 20,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderColor: colorScheme === 'dark' ? '#374151' : '#e5e7eb',
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colorScheme === 'dark' ? '#fff' : '#111827',
              }}>
                {t('chat.history.title')}
              </Text>
              {loadingHistory && (
                <ActivityIndicator size="small" style={{ marginVertical: 0 }} />
              )}
              <Pressable onPress={() => setHistoryVisible(false)}>
                <MaterialIcons name="close" size={24} color={colorScheme === 'dark' ? '#fff' : '#000'} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                if (agent) startNewChat(agent)
                setHistoryVisible(false)
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f9fafb',
                borderRadius: 12,
                marginVertical: 12,
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colorScheme === 'dark' ? '#374151' : '#eff6ff',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <MaterialIcons name="add" size={24} color={colorScheme === 'dark' ? '#60A5FA' : '#2563EB'} />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: colorScheme === 'dark' ? '#60A5FA' : '#2563EB',
              }}>
                {t('chat.newChat')}
              </Text>
            </Pressable>

            <FlatList
              data={conversations}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 8,
                  backgroundColor: colorScheme === 'dark' ? '#1f2937' : '#f9fafb',
                }}>
                  <Pressable 
                    style={{ flex: 1 }}
                    onPress={() => loadConversation(item.id)}
                  >
                    <Text style={{
                      fontSize: 16,
                      fontWeight: item.id === conversationId ? 'bold' : 'normal',
                      color: colorScheme === 'dark' ? '#fff' : '#111827',
                      marginBottom: 4,
                    }} numberOfLines={1}>
                      {item.name || t('chat.untitledConversation')}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
                    }}>
                      {new Date(item.created_at * 1000).toLocaleString()}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        t('chat.deleteConversation'),
                        t('chat.deleteConfirmation'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('chat.delete'), style: 'destructive', onPress: () => handleDeleteConversation(item.id) }
                        ]
                      )
                    }}
                    style={{ padding: 8 }}
                  >
                    <MaterialIcons name="delete-outline" size={20} color={colorScheme === 'dark' ? '#ef4444' : '#ef4444'} />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={
                <Text style={{
                  textAlign: 'center',
                  marginTop: 40,
                  color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
                }}>
                  {t('chat.noHistory')}
                </Text>
              }
            />
          </View>
        </Modal>
      </SafeAreaView>
    </>
  )
}
