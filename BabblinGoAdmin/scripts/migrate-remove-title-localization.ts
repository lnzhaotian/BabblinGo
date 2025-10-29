/**
 * Migration script to remove title localization from Lessons and Levels
 * 
 * This script:
 * 1. Finds all lessons and levels with localized titles
 * 2. Flattens them to use the 'en' value as the default
 * 3. Keeps summary localized
 * 
 * Run with: pnpm tsx scripts/migrate-remove-title-localization.ts
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

async function migrateTitles() {
  console.log('🚀 Starting title localization migration...')
  
  const payload = await getPayload({ config: await config })
  
  try {
    // Migrate Lessons
    console.log('\n📚 Processing Lessons...')
    const lessons = await payload.find({
      collection: 'lessons',
      limit: 1000,
      depth: 0,
    })
    
    console.log(`📦 Found ${lessons.docs.length} lessons to process`)
    
    let lessonsUpdated = 0
    
    for (const lesson of lessons.docs) {
      if (lesson.title && typeof lesson.title === 'object') {
        const titleObj = lesson.title as any
        const flatTitle = titleObj.en || titleObj.zh || ''
        
        await payload.update({
          collection: 'lessons',
          id: lesson.id,
          data: { title: flatTitle },
        })
        
        lessonsUpdated++
        console.log(`✅ Updated lesson ${lesson.id}: "${flatTitle}"`)
      }
    }
    
    // Migrate Levels
    console.log('\n📊 Processing Levels...')
    const levels = await payload.find({
      collection: 'levels',
      limit: 1000,
      depth: 0,
    })
    
    console.log(`📦 Found ${levels.docs.length} levels to process`)
    
    let levelsUpdated = 0
    
    for (const level of levels.docs) {
      if (level.title && typeof level.title === 'object') {
        const titleObj = level.title as any
        const flatTitle = titleObj.en || titleObj.zh || ''
        
        await payload.update({
          collection: 'levels',
          id: level.id,
          data: { title: flatTitle },
        })
        
        levelsUpdated++
        console.log(`✅ Updated level ${level.id}: "${flatTitle}"`)
      }
    }
    
    console.log('\n🎉 Migration complete!')
    console.log(`✅ Lessons updated: ${lessonsUpdated}`)
    console.log(`✅ Levels updated: ${levelsUpdated}`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
  
  process.exit(0)
}

migrateTitles()
