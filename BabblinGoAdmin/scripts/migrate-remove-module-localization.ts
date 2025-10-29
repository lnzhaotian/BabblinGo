/**
 * Migration script to remove localization from Module fields
 * 
 * This script:
 * 1. Finds all modules with localized fields (title, body, image, audio)
 * 2. Flattens them to use the 'en' value as the default
 * 3. Updates the documents in MongoDB
 * 
 * Run with: pnpm tsx scripts/migrate-remove-module-localization.ts
 */

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Load environment variables
dotenv.config({ path: path.resolve(dirname, '../.env') })

async function migrateModules() {
  console.log('🚀 Starting module localization migration...')
  
  const resolvedConfig = await config
  const payload = await getPayload({ 
    config: {
      ...resolvedConfig,
      secret: process.env.PAYLOAD_SECRET || resolvedConfig.secret,
    }
  })
  
  try {
    // Fetch all modules
    const modules = await payload.find({
      collection: 'modules',
      limit: 1000,
      depth: 0,
    })
    
    console.log(`📦 Found ${modules.docs.length} modules to process`)
    
    let updated = 0
    let skipped = 0
    
    for (const module of modules.docs) {
      let needsUpdate = false
      const updates: any = {}
      
      // Check and flatten title
      if (module.title && typeof module.title === 'object') {
        const titleObj = module.title as any
        updates.title = titleObj.en || titleObj.zh || ''
        needsUpdate = true
        console.log(`  - Flattening title for module ${module.id}`)
      }
      
      // Check and flatten body
      if (module.body && typeof module.body === 'object' && !Array.isArray(module.body)) {
        const bodyObj = module.body as any
        // Check if it has locale keys (en/zh)
        if ('en' in bodyObj || 'zh' in bodyObj) {
          updates.body = bodyObj.en || bodyObj.zh || { root: { children: [], direction: null, format: '', indent: 0, type: 'root', version: 1 } }
          needsUpdate = true
          console.log(`  - Flattening body for module ${module.id}`)
        }
      }
      
      // Check and flatten image (relationship ID)
      if (module.image && typeof module.image === 'object' && 'en' in module.image) {
        const imageObj = module.image as any
        updates.image = imageObj.en || imageObj.zh || null
        needsUpdate = true
        console.log(`  - Flattening image for module ${module.id}`)
      }
      
      // Check and flatten audio (relationship ID)
      if (module.audio && typeof module.audio === 'object' && 'en' in module.audio) {
        const audioObj = module.audio as any
        updates.audio = audioObj.en || audioObj.zh || null
        needsUpdate = true
        console.log(`  - Flattening audio for module ${module.id}`)
      }
      
      if (needsUpdate) {
        await payload.update({
          collection: 'modules',
          id: module.id,
          data: updates,
          overrideAccess: true,
          depth: 0,
        })
        updated++
        console.log(`✅ Updated module ${module.id}`)
      } else {
        skipped++
      }
    }
    
    console.log('\n🎉 Migration complete!')
    console.log(`✅ Updated: ${updated}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
  
  process.exit(0)
}

migrateModules()
