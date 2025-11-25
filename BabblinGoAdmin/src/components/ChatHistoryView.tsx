'use client'

import React, { useEffect, useState } from 'react'
import { Gutter } from '@payloadcms/ui'

type User = {
  id: string
  email: string
  displayName?: string
}

type Agent = {
  id: string
  title: string
}

type Conversation = {
  id: string
  name: string
  created_at: number
}

type Message = {
  id: string
  query: string
  answer: string
  created_at: number
}

export const ChatHistoryView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch Users and Agents on mount
    const fetchData = async () => {
      try {
        console.log('Fetching users and agents...')
        const usersRes = await fetch('/api/users?limit=100')
        if (!usersRes.ok) throw new Error(`Failed to fetch users: ${usersRes.statusText}`)
        const usersData = await usersRes.json()
        console.log('Users fetched:', usersData.docs.length)
        setUsers(usersData.docs)

        const agentsRes = await fetch('/api/agents?limit=100')
        if (!agentsRes.ok) throw new Error(`Failed to fetch agents: ${agentsRes.statusText}`)
        const agentsData = await agentsRes.json()
        console.log('Agents fetched:', agentsData.docs.length)
        setAgents(agentsData.docs)
      } catch (error: unknown) {
        console.error('Error fetching initial data:', error)
        setError(error instanceof Error ? error.message : 'Unknown error')
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedUser && selectedAgent) {
      const fetchConversations = async () => {
        setLoading(true)
        setError(null)
        try {
          console.log(`Fetching conversations for User: ${selectedUser}, Agent: ${selectedAgent}`)
          const res = await fetch(`/api/dify/conversations?agentId=${selectedAgent}&userId=${selectedUser}`)
          if (res.ok) {
            const data = await res.json()
            console.log('Conversations fetched:', data.data?.length)
            setConversations(data.data || [])
          } else {
            const errText = await res.text()
            console.error('Failed to fetch conversations:', errText)
            setError(`Failed to fetch conversations: ${errText}`)
            setConversations([])
          }
        } catch (error: unknown) {
          console.error('Error fetching conversations:', error)
          setError(error instanceof Error ? error.message : 'Unknown error')
        } finally {
          setLoading(false)
        }
      }
      fetchConversations()
    } else {
      setConversations([])
    }
    setSelectedConversation('')
    setMessages([])
  }, [selectedUser, selectedAgent])

  useEffect(() => {
    if (selectedConversation && selectedUser && selectedAgent) {
      const fetchMessages = async () => {
        setLoading(true)
        setError(null)
        try {
          const res = await fetch(`/api/dify/messages?agentId=${selectedAgent}&conversationId=${selectedConversation}&userId=${selectedUser}`)
          if (res.ok) {
            const data = await res.json()
            // Dify returns newest first, reverse for display
            setMessages((data.data || []).reverse())
          } else {
            console.error('Failed to fetch messages')
            setMessages([])
          }
        } catch (error) {
          console.error('Error fetching messages:', error)
        } finally {
          setLoading(false)
        }
      }
      fetchMessages()
    } else {
      setMessages([])
    }
  }, [selectedConversation, selectedUser, selectedAgent])

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation?')) return

    try {
      const res = await fetch(`/api/dify/conversations/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent,
          conversationId: convId,
          userId: selectedUser
        }),
      })
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId))
        if (selectedConversation === convId) {
          setSelectedConversation('')
          setMessages([])
        }
      } else {
        alert('Failed to delete conversation')
      }
    } catch (error) {
      console.error('Error deleting conversation:', error)
    }
  }

  const renameConversation = async (convId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newName = prompt('Enter new name:', currentName)
    if (!newName || newName === currentName) return

    try {
      const res = await fetch(`/api/dify/conversations/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent,
          conversationId: convId,
          name: newName,
          userId: selectedUser
        }),
      })
      if (res.ok) {
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, name: newName } : c))
      } else {
        alert('Failed to rename conversation')
      }
    } catch (error) {
      console.error('Error renaming conversation:', error)
    }
  }

  return (
    <Gutter>
      <h1>Chat History Manager</h1>
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', marginBottom: '20px', borderRadius: '4px' }}>
          Error: {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: '20px', marginTop: '20px', height: '80vh' }}>
        
        {/* Sidebar: Filters */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3>Filters</h3>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>User</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Select User</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.email}
                </option>
              ))}
            </select>
            {users.length === 0 && <div style={{ fontSize: '0.8em', color: '#666' }}>No users found</div>}
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Agent</label>
            <select 
              value={selectedAgent} 
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">Select Agent</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.title}
                </option>
              ))}
            </select>
            {agents.length === 0 && <div style={{ fontSize: '0.8em', color: '#666' }}>No agents found</div>}
          </div>
        </div>

        {/* Middle: Conversations List */}
        <div style={{ width: '300px', borderRight: '1px solid #ccc', borderLeft: '1px solid #ccc', padding: '0 10px', overflowY: 'auto' }}>
          <h3>Conversations</h3>
          {loading && !conversations.length && <p>Loading...</p>}
          {!loading && conversations.length === 0 && <p>No conversations found.</p>}
          {conversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => setSelectedConversation(conv.id)}
              style={{
                padding: '10px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                backgroundColor: selectedConversation === conv.id ? '#f0f0f0' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.name}</div>
                <div style={{ fontSize: '0.8em', color: '#666' }}>
                  {new Date(conv.created_at * 1000).toLocaleString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button 
                  onClick={(e) => renameConversation(conv.id, conv.name, e)}
                  style={{ fontSize: '0.8em', padding: '2px 5px' }}
                  title="Rename"
                >
                  ✎
                </button>
                <button 
                  onClick={(e) => deleteConversation(conv.id, e)}
                  style={{ fontSize: '0.8em', padding: '2px 5px', color: 'red' }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Messages */}
        <div style={{ flex: 1, padding: '0 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h3>Messages</h3>
          {loading && !messages.length && <p>Loading...</p>}
          {!loading && messages.length === 0 && selectedConversation && <p>No messages found.</p>}
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: '20px' }}>
                {/* User Message */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
                  <div style={{ 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    padding: '10px', 
                    borderRadius: '10px 10px 0 10px',
                    maxWidth: '70%'
                  }}>
                    {msg.query}
                  </div>
                </div>
                
                {/* AI Message */}
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ 
                    backgroundColor: '#f1f1f1', 
                    color: 'black', 
                    padding: '10px', 
                    borderRadius: '10px 10px 10px 0',
                    maxWidth: '70%'
                  }}>
                    {msg.answer}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Gutter>
  )
}
