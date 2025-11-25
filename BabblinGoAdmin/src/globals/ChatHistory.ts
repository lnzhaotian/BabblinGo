import { GlobalConfig } from 'payload'

const ChatHistory: GlobalConfig = {
  slug: 'chat-history',
  label: 'Chat History',
  admin: {
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
