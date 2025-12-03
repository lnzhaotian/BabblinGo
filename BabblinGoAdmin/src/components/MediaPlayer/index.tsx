'use client'
import React, { useEffect, useRef, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

interface PlayerApi {
  getCurrentTime: () => number
}

interface CustomWindow extends Window {
  BabblinGoPlayers?: Record<string, PlayerApi>
}

const registerPlayer = (id: string, api: PlayerApi) => {
  if (typeof window === 'undefined') return
  const win = window as CustomWindow
  if (!win.BabblinGoPlayers) win.BabblinGoPlayers = {}
  win.BabblinGoPlayers[id] = api
}

const unregisterPlayer = (id: string) => {
  if (typeof window === 'undefined') return
  const win = window as CustomWindow
  if (win.BabblinGoPlayers) delete win.BabblinGoPlayers[id]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MediaPlayer: React.FC<any> = (props) => {
  const { path } = props // e.g. "video.mediaPlayer" or "audio.tracks.0.mediaPlayer"
  // The parent path is the path without the last segment.
  const parentPath = path?.split('.').slice(0, -1).join('.')
  
  // We need to find the video/audio source.
  // For video: parentPath + ".videoFile" or parentPath + ".streamUrl"
  // For audio: parentPath + ".audio"
  
  const videoFileId = useFormFields(([fields]) => fields[`${parentPath}.videoFile`]?.value) as string
  const streamUrl = useFormFields(([fields]) => fields[`${parentPath}.streamUrl`]?.value) as string
  const audioFileId = useFormFields(([fields]) => fields[`${parentPath}.audio`]?.value) as string
  
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [isFloating, setIsFloating] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  useEffect(() => {
    const fetchMedia = async (id: string) => {
      try {
        const res = await fetch(`/api/media/${id}`)
        const data = await res.json()
        if (data.url) setMediaUrl(data.url)
      } catch (e) {
        console.error('Failed to fetch media', e)
      }
    }
    
    if (videoFileId) {
      fetchMedia(videoFileId)
    } else if (streamUrl) {
      setMediaUrl(streamUrl)
    } else if (audioFileId) {
      fetchMedia(audioFileId)
    } else {
      setMediaUrl(null)
    }
  }, [videoFileId, streamUrl, audioFileId])
  
  useEffect(() => {
    if (!parentPath) return
    const api: PlayerApi = {
      getCurrentTime: () => {
        if (videoRef.current) return videoRef.current.currentTime
        if (audioRef.current) return audioRef.current.currentTime
        return 0
      }
    }
    registerPlayer(parentPath, api)
    return () => unregisterPlayer(parentPath)
  }, [parentPath, mediaUrl])
  
  if (!mediaUrl) return null
  
  const isVideo = !!(videoFileId || streamUrl)

  const containerStyle: React.CSSProperties = isFloating ? {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    width: '400px',
    zIndex: 1000,
    background: 'var(--theme-elevation-50)',
    borderRadius: '8px',
    border: '1px solid var(--theme-elevation-150)',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    padding: '10px',
    transition: 'all 0.3s ease'
  } : {
    marginBottom: '20px',
    padding: '10px',
    background: 'var(--theme-elevation-50)',
    borderRadius: '4px',
    border: '1px solid var(--theme-elevation-150)',
    position: 'sticky',
    top: '20px',
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  }
  
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--theme-elevation-800)' }}>Preview Player</div>
        <button
          type="button"
          onClick={() => setIsFloating(!isFloating)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '4px',
            borderRadius: '4px',
          }}
          title={isFloating ? "Dock player" : "Float player"}
        >
          {isFloating ? '📌' : '☁️'}
        </button>
      </div>
      {isVideo ? (
        <video 
          ref={videoRef} 
          src={mediaUrl} 
          controls 
          style={{ width: '100%', maxHeight: '400px' }} 
        />
      ) : (
        <audio 
          ref={audioRef} 
          src={mediaUrl} 
          controls 
          style={{ width: '100%' }} 
        />
      )}
    </div>
  )
}
