// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Levels } from './collections/Levels'
import { Lessons } from './collections/Lessons'
import { Media } from './collections/Media'
import { Modules } from './collections/Modules'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Levels, Lessons, Modules],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  localization: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    fallback: true,
  },
  sharp,
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
