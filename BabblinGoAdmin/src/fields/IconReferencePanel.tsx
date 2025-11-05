'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

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
  const isDarkMode = useIsDarkMode()

  useEffect(() => {
    if (expanded) {
      ensureMaterialIconFont()
    }
  }, [expanded])

  const icons = useMemo(() => materialIconOptions, [])

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  return (
    <div style={{ ...panelContainerStyle, ...(isDarkMode ? panelContainerDarkStyle : {}) }}>
      <div style={panelHeaderStyle}>
        <span>Need an icon? Browse the Material list</span>
        <button type="button" onClick={handleToggle} style={{ ...toggleButtonStyle, ...(isDarkMode ? toggleButtonDarkStyle : {}) }}>
          {expanded ? 'Hide icons' : 'Show icons'}
        </button>
      </div>
      {expanded ? (
        <div style={gridStyle}>
          {icons.map((icon) => {
            const glyphCode = materialIconGlyphMap[icon.value]
            const glyphChar = glyphCode ? String.fromCodePoint(glyphCode) : '□'
            return (
              <div
                key={icon.value}
                style={{ ...iconTileStyle, ...(isDarkMode ? iconTileDarkStyle : {}) }}
              >
                <span style={{ ...iconSwatchStyle, ...(isDarkMode ? iconSwatchDarkStyle : {}) }}>
                  <span style={{ ...iconGlyphStyle, ...(isDarkMode ? iconGlyphDarkStyle : {}) }}>{glyphChar}</span>
                </span>
                <span style={{ ...iconLabelStyle, ...(isDarkMode ? iconLabelDarkStyle : {}) }}>{icon.label}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ marginTop: 12, fontSize: 13, color: isDarkMode ? '#e5e7eb' : '#4b5563' }}>
          Click Show icons to reveal a scrollable list of every Material icon name.
        </p>
      )}
    </div>
  )
}

export default IconReferencePanel
