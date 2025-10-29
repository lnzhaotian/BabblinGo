/**
 * Script to delete all modules and clear module references from lessons
 * 
 * Run with: pnpm tsx scripts/delete-all-modules.ts
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

async function deleteAllModules() {
  console.log('🗑️  Starting module deletion...')
  
  const resolvedConfig = await config
  const payload = await getPayload({ 
    config: {
      ...resolvedConfig,
      secret: process.env.PAYLOAD_SECRET || resolvedConfig.secret,
    }
  })
  
  try {
    // First, clear module references from all lessons
    console.log('\n📚 Clearing module references from lessons...')
    const lessons = await payload.find({
      collection: 'lessons',
      limit: 1000,
      depth: 0,
    })
    
    console.log(`📦 Found ${lessons.docs.length} lessons to update`)
    
    for (const lesson of lessons.docs) {
      if (lesson.modules && Array.isArray(lesson.modules) && lesson.modules.length > 0) {
        await payload.update({
          collection: 'lessons',
          id: lesson.id,
          data: { modules: [] },
          depth: 0,
        })
        console.log(`✅ Cleared modules from lesson ${lesson.id}`)
      }
    }
    
    // Now delete all modules
    console.log('\n🗑️  Deleting all modules...')
    const modules = await payload.find({
      collection: 'modules',
      limit: 1000,
      depth: 0,
    })
    
    console.log(`📦 Found ${modules.docs.length} modules to delete`)
    
    let deleted = 0
    for (const module of modules.docs) {
      await payload.delete({
        collection: 'modules',
        id: module.id,
      })
      deleted++
      console.log(`✅ Deleted module ${module.id}: "${module.title}"`)
    }
    
    console.log('\n🎉 Cleanup complete!')
    console.log(`✅ Deleted ${deleted} modules`)
    console.log(`✅ Cleared references from ${lessons.docs.length} lessons`)
    console.log('\n💡 You can now recreate your modules with the new schema!')
    
  } catch (error) {
    console.error('❌ Deletion failed:', error)
    process.exit(1)
  }
  
  process.exit(0)
}

deleteAllModules()
