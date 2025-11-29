// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { en } from '@payloadcms/translations/languages/en'
import { zh } from '@payloadcms/translations/languages/zh'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';

import Courses from './collections/Courses'
import { Lessons } from './collections/Lessons'
import { Media } from './collections/Media'
import { Modules } from './collections/Modules'
import { Users } from './collections/Users'
import LearningRecords from './collections/LearningRecords'
import Tools from './collections/Tools'
import UserPreferences from './collections/UserPreferences'
import Agents from './collections/Agents'
import SystemSettings from './globals/SystemSettings'
import ChatHistory from './globals/ChatHistory'
import { 
  difyChatHandler, 
  getConversationsHandler, 
  getMessagesHandler, 
  renameConversationHandler, 
  deleteConversationHandler,
  generateTitleHandler
} from './endpoints/dify'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Courses, Lessons, Modules, Agents, Tools, LearningRecords, UserPreferences, Users, Media],
  globals: [ChatHistory, SystemSettings],
  endpoints: [
    {
      path: '/dify/chat-messages',
      method: 'post',
      handler: difyChatHandler,
    },
    {
      path: '/dify/conversations',
      method: 'get',
      handler: getConversationsHandler,
    },
    {
      path: '/dify/messages',
      method: 'get',
      handler: getMessagesHandler,
    },
    {
      path: '/dify/conversations/rename',
      method: 'post',
      handler: renameConversationHandler,
    },
    {
      path: '/dify/conversations/delete',
      method: 'post',
      handler: deleteConversationHandler,
    },
    {
      path: '/dify/conversations/generate-title',
      method: 'post',
      handler: generateTitleHandler,
    },
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages: {
      en,
      zh,
    },
  },
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  localization: {
    locales: [
      {
        code: 'en',
        label: {
          en: 'English Content',
          zh: '英文内容',
        },
      },
      {
        code: 'zh',
        label: {
          en: 'Chinese Content',
          zh: '中文内容',
        },
      },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
  sharp,
  email: nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM!,
    defaultFromName: 'BabblinGo',
    transportOptions: {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      secure: true,
    },
  }),
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename }: { filename: string }) => {
            return `${process.env.OSS_PUBLIC_URL}/${filename}`
          },
        },
      },
      bucket: process.env.OSS_BUCKET!,
      config: {
        endpoint: process.env.OSS_ENDPOINT,
        region: process.env.OSS_REGION || 'oss-cn-beijing',
        credentials: {
          accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET!,
        },
        forcePathStyle: false, // Use virtual-hosted-style URLs for OSS
      },
      acl: 'public-read', // or 'private' if using signed URLs
    }),
  ],
})
