import type { CollectionConfig, CollectionSlug, PayloadRequest } from 'payload'
import type { Module } from '../payload-types'

import { createSlugField } from '../fields/slug'
import {
  extractRelationshipId,
  mergeContext,
  RelationshipValue,
  uniqueRelationshipIds,
} from './utils/relationshipHelpers'

import { generateTranscript } from '../utilities/transcription'
import { MediaPlayer } from '../components/MediaPlayer'
import { TimestampField } from '../components/TimestampField'

const syncModulesOnLessons = async (
  req: PayloadRequest,
  lessonId: string,
  moduleId: string,
  action: 'add' | 'remove'
) => {
  if (!lessonId || !moduleId) {
    return
  }

  try {
    const lesson = await req.payload.findByID({
      collection: 'lessons',
      id: lessonId,
      depth: 0,
      locale: req.locale || 'en',
      fallbackLocale: false,
    })

    const moduleIds = uniqueRelationshipIds(lesson?.modules as RelationshipValue[])
    const hasModule = moduleIds.includes(moduleId)

    if (action === 'add') {
      if (!hasModule) {
        moduleIds.push(moduleId)
      }

      await req.payload.update({
        collection: 'lessons',
        id: lessonId,
        data: {
          title: lesson.title,
          course: lesson.course,
          modules: moduleIds,
        },
        depth: 0,
        locale: req.locale === 'all' ? 'en' : req.locale,
        overrideAccess: true,
        context: mergeContext(req.context, { skipSyncLessonModules: true }),
      })
    } else {
      if (!hasModule) return

      const nextModuleIds = moduleIds.filter((id) => id !== moduleId)

      await req.payload.update({
        collection: 'lessons',
        id: lessonId,
        data: {
          title: lesson.title,
          course: lesson.course,
          modules: nextModuleIds,
        },
        depth: 0,
        locale: req.locale === 'all' ? 'en' : req.locale,
        overrideAccess: true,
        context: mergeContext(req.context, { skipSyncLessonModules: true }),
      })
    }
  } catch (error) {
    console.error(
      `Failed to ${action === 'add' ? 'link' : 'unlink'} module ${moduleId} ${
        action === 'add' ? 'to' : 'from'
      } lesson ${lessonId}`,
      error
    )
  }
}

export const Modules: CollectionConfig = {
  slug: 'modules',
  admin: {
    group: 'Course Management',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'lesson', 'order'],
    description:
      'Modules are the lowest level of lesson content. Select a module type, then provide the matching media and copy.',
  },
  access: {
    read: () => true,
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }: { doc: Module; previousDoc: Module; req: PayloadRequest }) => {
        if (!doc?.id || req?.context?.skipSyncLessonModules) {
          return doc
        }

        const currentLessonId = extractRelationshipId(doc.lesson as RelationshipValue)
        const previousLessonId = extractRelationshipId(previousDoc?.lesson as RelationshipValue)

        if (previousLessonId && previousLessonId !== currentLessonId) {
          await syncModulesOnLessons(req, previousLessonId, doc.id, 'remove')
        }

        if (currentLessonId) {
          await syncModulesOnLessons(req, currentLessonId, doc.id, 'add')
        }

        // Transcription Hook
        if (!req.context.skipTranscription) {
          const isVideo = doc.type === 'video'
          const isAudio = doc.type === 'audio'

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (isVideo && (doc.video as any)?.requestTranscription) {
            let url = doc.video?.streamUrl
            if (doc.video?.videoFile) {
              try {
                const videoFileId = extractRelationshipId(doc.video?.videoFile)
                if (videoFileId) {
                  const media = await req.payload.findByID({
                    collection: 'media',
                    id: videoFileId,
                  })
                  url = media.url
                }
              } catch (e) {
                console.error('Failed to fetch video media', e)
              }
            }

            if (url) {
              // Update to processing and reset request flag
              await req.payload.update({
                collection: 'modules',
                id: doc.id,
                data: { 
                  video: { 
                    ...(doc.video || {}), 
                    transcriptionStatus: 'processing',
                    requestTranscription: false 
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  } as any
                },
                context: { skipTranscription: true },
              })

              // Trigger async
              generateTranscript(url)
                .then((segments) => {
                  req.payload.update({
                    collection: 'modules',
                    id: doc.id,
                    data: {
                      video: {
                        ...(doc.video || {}),
                        transcriptSegments: segments,
                        transcriptionStatus: 'completed',
                        requestTranscription: false, // Ensure it stays false
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      } as any,
                    },
                    context: { skipTranscription: true },
                  })
                })
                .catch((err) => {
                  console.error('Transcription failed', err)
                  req.payload.update({
                    collection: 'modules',
                    id: doc.id,
                    data: { 
                      video: { 
                      ...(doc.video || {}), 
                      transcriptionStatus: 'failed',
                      requestTranscription: false 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } as any
                    },
                    context: { skipTranscription: true },
                  })
                })
            }
          }

          if (isAudio && doc.audio?.tracks) {
            const tracks = doc.audio.tracks
            const tracksToProcess = tracks
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((t: any, i: number) => ({ ...t, index: i }))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t: any) => t.requestTranscription)

            if (tracksToProcess.length > 0) {
              // Mark as processing and reset flags
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const newTracks = [...tracks] as any[]
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tracksToProcess.forEach((t: any) => {
                newTracks[t.index].transcriptionStatus = 'processing'
                newTracks[t.index].requestTranscription = false
              })

              await req.payload.update({
                collection: 'modules',
                id: doc.id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: { audio: { ...(doc.audio || {}), tracks: newTracks } as any },
                context: { skipTranscription: true },
              })

              // Process each track
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tracksToProcess.forEach(async (track: any) => {
                try {
                  const audioFileId = extractRelationshipId(track.audio)
                  if (audioFileId) {
                    const media = await req.payload.findByID({
                      collection: 'media',
                      id: audioFileId,
                    })
                    const url = media.url
                    if (url) {
                      const segments = await generateTranscript(url)

                      const latestDoc = await req.payload.findByID({
                        collection: 'modules',
                        id: doc.id,
                      })
                      const currentTracks = latestDoc.audio?.tracks
                      // Ensure the track still exists and matches (simple index check for now)
                      if (currentTracks && currentTracks[track.index]) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const trackToUpdate = currentTracks[track.index] as any
                        trackToUpdate.transcriptSegments = segments
                        trackToUpdate.transcriptionStatus = 'completed'
                        // No need to reset requestTranscription again as it was done in the first update, 
                        // but good to be safe if user toggled it again (unlikely in this short window)

                        await req.payload.update({
                          collection: 'modules',
                          id: doc.id,
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          data: { audio: { ...latestDoc.audio, tracks: currentTracks } as any },
                          context: { skipTranscription: true },
                        })
                      }
                    }
                  }
                } catch (err) {
                  console.error('Track transcription failed', err)
                  const latestDoc = await req.payload.findByID({
                    collection: 'modules',
                    id: doc.id,
                  })
                  const currentTracks = latestDoc.audio?.tracks
                  if (currentTracks && currentTracks[track.index]) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const trackToUpdate = currentTracks[track.index] as any
                    trackToUpdate.transcriptionStatus = 'failed'

                    await req.payload.update({
                      collection: 'modules',
                      id: doc.id,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      data: { audio: { ...latestDoc.audio, tracks: currentTracks } as any },
                      context: { skipTranscription: true },
                    })
                  }
                }
              })
            }
          }
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        if (!doc?.id || req?.context?.skipSyncLessonModules) {
          return doc
        }

        const lessonId = extractRelationshipId(doc.lesson as RelationshipValue)

        if (lessonId) {
          await syncModulesOnLessons(req, lessonId, doc.id, 'remove')
        }

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    createSlugField('title'),
    {
      name: 'order',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Optional numeric position used to order modules within a lesson.',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'lessons' as unknown as CollectionSlug,
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'audioSlideshow',
      options: [
        {
          label: 'Audio Slideshow',
          value: 'audioSlideshow',
        },
        {
          label: 'Video',
          value: 'video',
        },
        {
          label: 'Rich Post',
          value: 'richPost',
        },
        {
          label: 'Audio (Playlist)',
          value: 'audio',
        },
        {
          label: 'Web Page',
          value: 'webPage',
        },
      ],
      admin: {
        description: 'Determines how the lesson module is rendered for learners.',
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'Optional short summary that appears in lesson overviews.',
      },
    },
    {
      name: 'webPage',
      label: 'Web Page Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'webPage',
        description: 'Embed a web page or external content.',
      },
      fields: [
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: {
            description: 'The URL to display.',
          },
        },
      ],
    },
    {
      name: 'audioSlideshow',
      label: 'Audio Slideshow Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'audioSlideshow',
        description: 'Slides with imagery and per-slide audio clips. Works with the existing slideshow + audio player.',
      },
      fields: [
        {
          name: 'slides',
          type: 'array',
          required: true,
          minRows: 1,
          admin: {
            description: 'Ordered slides presented alongside narration. At least one slide is required.',
          },
          fields: [
            {
              name: 'title',
              type: 'text',
              admin: {
                description: 'Optional slide title displayed in the player and analytics.',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Primary visual for the slide. Required when no video is present.',
              },
            },
            {
              name: 'audio',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Optional slide-specific audio narration.',
              },
            },
            {
              name: 'body',
              label: 'Slide Body',
              type: 'richText',
              admin: {
                description: 'Optional rich text copy that appears beneath the image.',
              },
            },
          ],
        },
        {
          name: 'transcript',
          label: 'Module Transcript',
          type: 'richText',
          admin: {
            description: 'Optional transcript or extended notes for the module.',
          },
        },
      ],
    },
    {
      name: 'video',
      label: 'Video Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'video',
        description: 'Upload a video or provide an external streaming URL with supporting copy.',
      },
      fields: [
        {
          name: 'videoFile',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Upload a hosted video file (MP4, MOV, etc.).',
          },
        },
        {
          name: 'streamUrl',
          type: 'text',
          admin: {
            description: 'External streaming URL (e.g., Mux, Vimeo, S3). Use when not uploading a file.',
            placeholder: 'https://example.com/video.m3u8',
          },
        },
        {
          name: 'posterImage',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description: 'Optional poster image displayed before playback.',
          },
        },
        {
          name: 'captions',
          type: 'array',
          admin: {
            description: 'Optional caption/subtitle files (WebVTT).',
          },
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
            },
            {
              name: 'file',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'language',
              type: 'text',
              admin: {
                description: 'BCP-47 language tag (e.g., en, en-US, zh-CN).',
              },
            },
          ],
        },
        {
          name: 'transcript',
          type: 'richText',
          admin: {
            description: 'Optional transcript or supporting copy for the video.',
          },
        },
        {
          name: 'mediaPlayer',
          type: 'ui',
          admin: {
            components: {
              Field: MediaPlayer as any,
            },
          },
        },
        {
          name: 'transcriptSegments',
          type: 'array',
          admin: {
            description: 'Time-synced transcript segments for Listen & Repeat.',
          },
          fields: [
            {
              name: 'start',
              type: 'number',
              required: true,
              admin: {
                components: {
                  Field: TimestampField as any,
                },
              },
            },
            {
              name: 'end',
              type: 'number',
              required: true,
              admin: {
                components: {
                  Field: TimestampField as any,
                },
              },
            },
            {
              name: 'text',
              type: 'textarea',
              required: true,
            },
          ],
        },
        {
          name: 'transcriptionStatus',
          type: 'select',
          options: [
            { label: 'Idle', value: 'idle' },
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'Completed', value: 'completed' },
            { label: 'Failed', value: 'failed' },
          ],
          defaultValue: 'idle',
          admin: {
            readOnly: true,
            description: 'Status of the automated transcription process.',
          },
        },
        {
          name: 'requestTranscription',
          type: 'checkbox',
          label: 'Request Transcription / Retry',
          defaultValue: false,
          admin: {
            description: 'Check this box and save to start/retry transcription.',
          },
        },
      ],
    },
    {
      name: 'richPost',
      label: 'Rich Post Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'richPost',
        description: 'Long-form lesson content combining text and media blocks.',
      },
      fields: [
        {
          name: 'body',
          label: 'Post Body',
          type: 'richText',
          required: true,
        },
        {
          name: 'mediaGallery',
          type: 'array',
          admin: {
            description: 'Optional supporting images or documents embedded in the post.',
          },
          fields: [
            {
              name: 'media',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'caption',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'audio',
      label: 'Audio Playlist Content',
      type: 'group',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'audio',
        description: 'One or more audio tracks presented without slides.',
      },
      fields: [
        {
          name: 'tracks',
          type: 'array',
          required: true,
          minRows: 1,
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
            },
            {
              name: 'audio',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Optional cover art for this track.',
              },
            },
            {
              name: 'durationSeconds',
              type: 'number',
              admin: {
                description: 'Optional duration in seconds (used for progress estimates).',
              },
            },
            {
              name: 'transcript',
              type: 'richText',
              admin: {
                description: 'Optional per-track transcript or notes.',
              },
            },
            {
              name: 'mediaPlayer',
              type: 'ui',
              admin: {
                components: {
                  Field: MediaPlayer as any,
                },
              },
            },
            {
              name: 'transcriptSegments',
              type: 'array',
              admin: {
                description: 'Time-synced transcript segments for Listen & Repeat.',
              },
              fields: [
                {
                  name: 'start',
                  type: 'number',
                  required: true,
                  admin: {
                    components: {
                      Field: TimestampField as any,
                    },
                  },
                },
                {
                  name: 'end',
                  type: 'number',
                  required: true,
                  admin: {
                    components: {
                      Field: TimestampField as any,
                    },
                  },
                },
                {
                  name: 'text',
                  type: 'textarea',
                  required: true,
                },
              ],
            },
            {
              name: 'transcriptionStatus',
              type: 'select',
              options: [
                { label: 'Idle', value: 'idle' },
                { label: 'Pending', value: 'pending' },
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
              ],
              defaultValue: 'idle',
              admin: {
                readOnly: true,
                description: 'Status of the automated transcription process.',
              },
            },
            {
              name: 'requestTranscription',
              type: 'checkbox',
              label: 'Request Transcription / Retry',
              defaultValue: false,
              admin: {
                description: 'Check this box and save to start/retry transcription.',
              },
            },
          ],
        },
        {
          name: 'introduction',
          type: 'richText',
          admin: {
            description: 'Optional introduction shown before the playlist.',
          },
        },
      ],
    },
    {
      name: 'resources',
      type: 'array',
      admin: {
        description: 'Optional supporting links or downloads for the module.',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
}
