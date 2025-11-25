import type { GlobalConfig } from 'payload'

const SystemSettings: GlobalConfig = {
  slug: 'system-settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'summarizerAgentApiKey',
      type: 'text',
      required: true,
      admin: {
        description: 'The API Key for the Dify Agent used to summarize conversations.',
      },
      access: {
        read: ({ req: { user } }) => {
          if (user) return true
          return false
        },
      },
    },
    {
      name: 'summarizerAgentApiUrl',
      type: 'text',
      defaultValue: 'https://ai.babblinguide.cn/v1',
      admin: {
        description: 'The base URL for the Summarizer Agent API.',
      },
    },
  ],
}

export default SystemSettings
