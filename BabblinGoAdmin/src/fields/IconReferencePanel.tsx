'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type CSSProperties } from 'react'

import materialIconOptions, { materialIconGlyphMap } from '../data/materialIconOptions'
import materialIconFontUrl from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'

const MATERIAL_ICON_FONT = 'MaterialIconsExpo'
const MATERIAL_ICON_FONT_STYLE_ID = 'material-icons-expo-font'

const panelContainerStyle: CSSProperties = {
  marginTop: 16,
  border: '1px solid #d1d5db',
  borderRadius: 8,
  backgroundColor: '#f9fafb',
  padding: 16,
}

const panelContainerDarkStyle: CSSProperties = {
  border: '1px solid #374151',
  backgroundColor: '#111827',
}

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontWeight: 600,
  fontSize: 15,
}

const toggleButtonStyle: CSSProperties = {
  appearance: 'none',
  border: '1px solid transparent',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 13,
  fontWeight: 500,
  backgroundColor: '#6366f1',
  color: '#ffffff',
  cursor: 'pointer',
}

const toggleButtonDarkStyle: CSSProperties = {
  backgroundColor: '#4f46e5',
}

const gridStyle: CSSProperties = {
  marginTop: 16,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  maxHeight: 300,
  overflowY: 'auto',
  paddingRight: 4,
}

const searchContainerStyle: CSSProperties = {
  marginTop: 16,
  display: 'flex',
  alignItems: 'stretch',
  gap: 8,
}

const searchInputStyle: CSSProperties = {
  flex: 1,
  borderRadius: 6,
  border: '1px solid #d1d5db',
  padding: '8px 12px',
  fontSize: 14,
}

const searchInputDarkStyle: CSSProperties = {
  border: '1px solid #4b5563',
  backgroundColor: '#1f2937',
  color: '#e5e7eb',
}

const copyFeedbackStyle: CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: '#16a34a',
  fontWeight: 500,
}

const copyFeedbackDarkStyle: CSSProperties = {
  color: '#4ade80',
}

const emptyStateStyle: CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: '#6b7280',
}

const emptyStateDarkStyle: CSSProperties = {
  color: '#9ca3af',
}

const iconTileStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 8,
  borderRadius: 6,
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
}

const iconTileDarkStyle: CSSProperties = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
}

const iconSwatchStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: 'rgba(99, 102, 241, 0.12)',
}

const iconSwatchDarkStyle: CSSProperties = {
  backgroundColor: 'rgba(99, 102, 241, 0.24)',
}

const iconGlyphStyle: CSSProperties = {
  fontFamily: MATERIAL_ICON_FONT,
  fontSize: 22,
  color: '#4338ca',
}

const iconGlyphDarkStyle: CSSProperties = {
  color: '#c7d2fe',
}

const iconLabelStyle: CSSProperties = {
  fontSize: 13,
  color: '#111827',
}

const iconLabelDarkStyle: CSSProperties = {
  color: '#e5e7eb',
}

const useIsDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const resolve = () => {
      const root = document.documentElement
      const body = document.body

      const themeAttr =
        root.getAttribute('data-theme') ||
        root.dataset.theme ||
        body?.getAttribute('data-theme') ||
        body?.dataset?.theme ||
        ''

      if (themeAttr) {
        const normalized = themeAttr.toLowerCase()
        if (normalized.includes('dark')) return true
        if (normalized.includes('light')) return false
      }

      const classes = `${root.className} ${body?.className ?? ''}`
      if (/\bpayload-theme-dark\b/i.test(classes) || /\bdark\b/i.test(classes)) return true
      if (/\bpayload-theme-light\b/i.test(classes) || /\blight\b/i.test(classes)) return false

      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    }

    const update = () => setIsDark(resolve())

    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      })
    }

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    const handleMedia = () => update()
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleMedia)
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleMedia)
    }

    return () => {
      observer.disconnect()
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMedia)
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(handleMedia)
      }
    }
  }, [])

  return isDark
}

const ensureMaterialIconFont = () => {
  if (typeof document === 'undefined') return
  if (document.getElementById(MATERIAL_ICON_FONT_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = MATERIAL_ICON_FONT_STYLE_ID
  style.innerHTML = `
    @font-face {
      font-family: '${MATERIAL_ICON_FONT}';
      src: url('${materialIconFontUrl}') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
  `
  document.head.appendChild(style)
}

const IconReferencePanel = () => {
  const [expanded, setExpanded] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedIcon, setCopiedIcon] = useState<string | null>(null)
  const isDarkMode = useIsDarkMode()

  useEffect(() => {
    if (expanded) {
      ensureMaterialIconFont()
    }
  }, [expanded])

  const icons = useMemo(() => materialIconOptions, [])
  const filteredIcons = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) {
      return icons
    }

    return icons.filter((icon) => icon.label.toLowerCase().includes(query))
  }, [icons, searchTerm])

  useEffect(() => {
    if (!copiedIcon || typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedIcon(null)
    }, 2000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [copiedIcon])

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }, [])

  const handleIconClick = useCallback(async (iconName: string) => {
    let copied = false

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(iconName)
        copied = true
      } catch (error) {
        console.warn('Unable to copy using clipboard API', error)
      }
    }

    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = iconName
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        copied = document.execCommand('copy')
        document.body.removeChild(textarea)
      } catch (error) {
        console.warn('Unable to copy icon name fallback', error)
      }
    }

    if (copied) {
      setCopiedIcon(iconName)
    }
  }, [])

  return (
    <div style={{ ...panelContainerStyle, ...(isDarkMode ? panelContainerDarkStyle : {}) }}>
      <div style={panelHeaderStyle}>
        <span>Need an icon? Browse the Material list</span>
        <button type="button" onClick={handleToggle} style={{ ...toggleButtonStyle, ...(isDarkMode ? toggleButtonDarkStyle : {}) }}>
          {expanded ? 'Hide icons' : 'Show icons'}
        </button>
      </div>
      {copiedIcon ? (
        <div style={{ ...copyFeedbackStyle, ...(isDarkMode ? copyFeedbackDarkStyle : {}) }}>
          Copied &quot;{copiedIcon}&quot; to your clipboard.
        </div>
      ) : null}
      {expanded ? (
        <>
          <div style={searchContainerStyle}>
            <input
              type="search"
              placeholder="Search by icon name"
              value={searchTerm}
              onChange={handleSearchChange}
              style={{ ...searchInputStyle, ...(isDarkMode ? searchInputDarkStyle : {}) }}
            />
          </div>
          {filteredIcons.length > 0 ? (
            <div style={gridStyle}>
              {filteredIcons.map((icon) => {
                const glyphCode = materialIconGlyphMap[icon.value]
                const glyphChar = glyphCode ? String.fromCodePoint(glyphCode) : '□'
                return (
                  <button
                    key={icon.value}
                    type="button"
                    onClick={() => handleIconClick(icon.value)}
                    title={`Copy "${icon.label}"`}
                    style={{
                      ...iconTileStyle,
                      ...(isDarkMode ? iconTileDarkStyle : {}),
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ ...iconSwatchStyle, ...(isDarkMode ? iconSwatchDarkStyle : {}) }}>
                      <span style={{ ...iconGlyphStyle, ...(isDarkMode ? iconGlyphDarkStyle : {}) }}>{glyphChar}</span>
                    </span>
                    <span style={{ ...iconLabelStyle, ...(isDarkMode ? iconLabelDarkStyle : {}) }}>{icon.label}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p style={{ ...emptyStateStyle, ...(isDarkMode ? emptyStateDarkStyle : {}) }}>
              No icons match &quot;{searchTerm}&quot;.
            </p>
          )}
        </>
      ) : (
        <p style={{ marginTop: 12, fontSize: 13, color: isDarkMode ? '#e5e7eb' : '#4b5563' }}>
          Click Show icons to reveal a scrollable list of every Material icon name.
        </p>
      )}
    </div>
  )
}

export default IconReferencePanel
