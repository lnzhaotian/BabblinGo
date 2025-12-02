'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'

const BatchExportLink: React.FC = () => {
  const { id } = useDocumentInfo()

  if (!id) {
    return (
      <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--theme-elevation-50)', borderRadius: '4px' }}>
        <p style={{ margin: 0, color: 'var(--theme-elevation-400)', fontSize: '13px' }}>
          Save batch to enable export
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '20px', padding: '15px', background: 'var(--theme-elevation-50)', borderRadius: '4px' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Export Codes</h4>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <a 
          href={`/api/activation/export?batchId=${id}&format=txt`} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'inline-block', 
            padding: '8px 12px', 
            background: 'var(--theme-elevation-150)', 
            color: 'var(--theme-elevation-800)', 
            textDecoration: 'none', 
            borderRadius: '4px',
            border: '1px solid var(--theme-elevation-200)',
            fontSize: '13px'
          }}
        >
          Download .txt
        </a>
        <a 
          href={`/api/activation/export?batchId=${id}&format=csv`} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'inline-block', 
            padding: '8px 12px', 
            background: 'var(--theme-elevation-150)', 
            color: 'var(--theme-elevation-800)', 
            textDecoration: 'none', 
            borderRadius: '4px',
            border: '1px solid var(--theme-elevation-200)',
            fontSize: '13px'
          }}
        >
          Download .csv
        </a>
      </div>
    </div>
  )
}

export default BatchExportLink
