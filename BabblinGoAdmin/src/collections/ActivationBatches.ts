import { CollectionConfig } from 'payload'
import crypto from 'crypto'
import BatchExportLink from '../components/BatchExportLink'

const generateCode = (prefix: string = '') => {
  // Generate 12 random hex characters (6 bytes)
  const random = crypto.randomBytes(6).toString('hex').toUpperCase()
  // Format as XXXX-XXXX-XXXX
  const formatted = random.match(/.{1,4}/g)?.join('-') || random
  return `${prefix}${formatted}`
}

const ActivationBatches: CollectionConfig = {
  slug: 'activation-batches',
  admin: {
    useAsTitle: 'name',
    group: 'System',
    defaultColumns: ['name', 'numberOfCodes', 'tokensPerCode', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => user?.collection === 'users' && user?.role === 'manager',
    create: ({ req: { user } }) => user?.collection === 'users' && user?.role === 'manager',
    update: ({ req: { user } }) => user?.collection === 'users' && user?.role === 'manager',
    delete: ({ req: { user } }) => user?.collection === 'users' && user?.role === 'manager',
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          const { numberOfCodes, tokensPerCode, expirationDate, prefix, id } = doc
          
          // Generate codes in background to avoid timeout
          // Note: In a serverless environment, this might need a proper queue.
          // For a standard Node server, this async operation continues after response.
          const generate = async () => {
            try {
              const batchSize = 50 // Insert in chunks
              let generatedCount = 0
              
              while (generatedCount < numberOfCodes) {
                const currentBatchSize = Math.min(batchSize, numberOfCodes - generatedCount)
                const promises = []
                
                for (let i = 0; i < currentBatchSize; i++) {
                  const code = generateCode(prefix ? `${prefix}-` : '')
                  promises.push(
                    req.payload.create({
                      collection: 'activation-codes',
                      data: {
                        code,
                        tokens: tokensPerCode,
                        status: 'active',
                        expiresAt: expirationDate,
                        batch: id,
                      },
                    })
                  )
                }
                
                await Promise.all(promises)
                generatedCount += currentBatchSize
                console.log(`Generated ${generatedCount}/${numberOfCodes} codes for batch ${id}`)
              }
            } catch (error) {
              console.error('Error generating activation codes:', error)
            }
          }

          // Trigger generation
          generate()
        }
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Batch Name / Label',
      admin: {
        description: 'e.g., "Winter Promo 2025" or "Conference Giveaway"',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'numberOfCodes',
          type: 'number',
          required: true,
          min: 1,
          max: 10000,
          defaultValue: 10,
          admin: {
            description: 'How many codes to generate',
          },
        },
        {
          name: 'tokensPerCode',
          type: 'number',
          required: true,
          min: 1,
          defaultValue: 100,
          admin: {
            description: 'Tokens granted per code',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'prefix',
          type: 'text',
          admin: {
            description: 'Optional prefix (e.g., "VIP")',
            placeholder: 'VIP',
          },
        },
        {
          name: 'expirationDate',
          type: 'date',
          admin: {
            description: 'Optional expiration date for all codes in this batch',
          },
        },
      ],
    },
    {
      name: 'exportLinks',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          // @ts-expect-error - Component type mismatch
          Field: BatchExportLink,
        },
      },
    },
  ],
}

export default ActivationBatches
