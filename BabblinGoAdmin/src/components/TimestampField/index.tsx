'use client'
import React from 'react'
import { useField } from '@payloadcms/ui'

interface PlayerApi {
  getCurrentTime: () => number
}

interface CustomWindow extends Window {
  BabblinGoPlayers?: Record<string, PlayerApi>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface TimestampFieldProps {
  path: string
  label?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TimestampField: React.FC<any> = (props) => {
  const { path, label } = props
  const { value, setValue } = useField<number>({ path })
  
  const handleGrabTime = (e: React.MouseEvent) => {
    e.preventDefault()
    const parts = path.split('.')
    // Remove last 3 parts (transcriptSegments, index, fieldName)
    // e.g. video.transcriptSegments.0.start -> video
    const parentPath = parts.slice(0, -3).join('.')
    
    const win = window as CustomWindow
    const player = win.BabblinGoPlayers?.[parentPath]
    
    if (player) {
      const time = player.getCurrentTime()
      setValue(Number(time.toFixed(3)))
    } else {
      alert('Player not found. Make sure the player is visible.')
    }
  }
  
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
        <div style={{ flexGrow: 1 }}>
          <label className="field-label" style={{ marginBottom: '5px', display: 'block' }}>
            {label}
          </label>
          <input
            type="number"
            step="0.001"
            value={value ?? ''}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid var(--theme-elevation-150)',
              background: 'var(--theme-elevation-0)',
              color: 'var(--theme-elevation-800)',
              borderRadius: '4px'
            }}
          />
        </div>
        <button 
          type="button" 
          onClick={handleGrabTime}
          style={{
            padding: '0 15px',
            background: 'var(--theme-elevation-800)',
            color: 'var(--theme-elevation-0)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem'
          }}
          title="Set to current player time"
        >
          ⏱️
        </button>
      </div>
    </div>
  )
}
