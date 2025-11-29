import { GlobalConfig } from 'payload'

const ChatHistory: GlobalConfig = {
  slug: 'chat-history',
  label: 'Chat History',
  admin: {
    group: 'User Management',
    components: {
      views: {
        edit: {
          root: {
            Component: '@/components/ChatHistoryView#ChatHistoryView',
          },
        },
      },
    },
  },
  fields: [
      {
          name: 'placeholder',
          type: 'text',
          admin: {
              hidden: true
          }
      }
  ],
}

export default ChatHistory
