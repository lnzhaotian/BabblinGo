'use client'

import { useCallback, useEffect, useMemo, useId, useState, type CSSProperties } from 'react'
import Select, {
  components,
  type OptionProps,
  type SingleValueProps,
} from 'react-select'

import materialIconOptions, {
  materialIconGlyphMap,
  type MaterialIconOption,
} from '../data/materialIconOptions'
import materialIconFontUrl from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'

const MATERIAL_ICON_FONT = 'MaterialIconsExpo'
const MATERIAL_ICON_FONT_STYLE_ID = 'material-icons-expo-font'

type IconPickerFieldProps = {
  path: string
  label?: string
  value?: string | null
  required?: boolean
  readOnly?: boolean
  description?: string
  onChange: (value: string | null) => void
  errorMessage?: string
  showError?: boolean
  className?: string
  name?: string
  placeholder?: string
  field?: {
    label?: string
    required?: boolean
    admin?: {
      description?: string
      placeholder?: string
      readOnly?: boolean
    }
  }
} & Record<string, unknown>

const IconPickerField = (props: IconPickerFieldProps) => {
  const {
    label,
    field,
    path,
    required,
    readOnly,
    description,
    value,
    onChange,
    errorMessage,
    showError,
    className,
    placeholder,
    name,
  } = props

  const reactId = useId()
  const instanceId = useMemo(() => {
    if (path && typeof path === 'string') return `icon-picker-${path}`
    return `icon-picker-${reactId}`
  }, [path, reactId])

  const inputId = useMemo(() => {
    if (path && typeof path === 'string') return path
    return `icon-picker-input-${reactId}`
  }, [path, reactId])

  const effectiveLabel = useMemo(() => label ?? field?.label ?? name ?? undefined, [label, field?.label, name])
  const isFieldRequired = required ?? field?.required ?? false
  const isReadOnly = readOnly ?? field?.admin?.readOnly ?? false
  const fieldDescription = description ?? field?.admin?.description ?? undefined
  const fieldPlaceholder = placeholder ?? field?.admin?.placeholder ?? undefined

  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const getIsDark = () => {
      const root = document.documentElement
      const body = document.body
      const attributeValue =
        root.getAttribute('data-theme') ||
        root.dataset.theme ||
        body?.getAttribute('data-theme') ||
        body?.dataset?.theme ||
        ''

      if (attributeValue) {
        const normalized = attributeValue.toLowerCase()
        if (normalized.includes('dark')) return true
        if (normalized.includes('light')) return false
      }

      const combinedClasses = `${root.className} ${body?.className ?? ''}`
      if (/\bpayload-theme-dark\b/i.test(combinedClasses) || /\bdark\b/i.test(combinedClasses)) return true
      if (/\bpayload-theme-light\b/i.test(combinedClasses) || /\blight\b/i.test(combinedClasses)) return false

      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    }

    const updateTheme = () => {
      setIsDarkMode(getIsDark())
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
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
    const handleMediaChange = () => updateTheme()

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange)
    } else if (mediaQuery?.addListener) {
      mediaQuery.addListener(handleMediaChange)
    }

    return () => {
      observer.disconnect()
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange)
      } else if (mediaQuery?.removeListener) {
        mediaQuery.removeListener(handleMediaChange)
      }
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const existing = document.getElementById(MATERIAL_ICON_FONT_STYLE_ID)
    if (existing) return

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
  }, [])

  const themeStyles = useMemo(
    () => ({
      controlBackground: isDarkMode ? '#111827' : '#ffffff',
      controlBorder: isDarkMode ? '#4b5563' : '#d1d5db',
      controlShadow: isDarkMode ? '0 0 0 2px rgba(99, 102, 241, 0.45)' : '0 0 0 2px rgba(99, 102, 241, 0.2)',
      textColor: isDarkMode ? '#e5e7eb' : '#111827',
      placeholderColor: isDarkMode ? '#9ca3af' : '#6b7280',
      menuBackground: isDarkMode ? '#111827' : '#ffffff',
      menuBorder: isDarkMode ? '#374151' : '#e5e7eb',
      optionHoverBackground: isDarkMode ? 'rgba(67, 56, 202, 0.35)' : '#eef2ff',
      optionActiveBackground: isDarkMode ? 'rgba(99, 102, 241, 0.45)' : '#c7d2fe',
      optionTextColor: isDarkMode ? '#e5e7eb' : '#111827',
      iconSwatchBackground: isDarkMode ? 'rgba(99, 102, 241, 0.25)' : '#eef2ff',
      iconColor: isDarkMode ? '#c7d2fe' : '#4338ca',
      indicatorSeparator: isDarkMode ? '#4b5563' : '#d1d5db',
      helperText: isDarkMode ? '#9ca3af' : '#6b7280',
    }),
    [isDarkMode],
  )

  const optionLabelStyle = useMemo<CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      color: themeStyles.optionTextColor,
    }),
    [themeStyles.optionTextColor],
  )

  const iconSwatchStyle = useMemo<CSSProperties>(
    () => ({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: 6,
      backgroundColor: themeStyles.iconSwatchBackground,
      marginRight: 10,
    }),
    [themeStyles.iconSwatchBackground],
  )

  const iconGlyphStyle = useMemo<CSSProperties>(
    () => ({
      fontFamily: MATERIAL_ICON_FONT,
      fontSize: 20,
      color: themeStyles.iconColor,
    }),
    [themeStyles.iconColor],
  )

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      color: themeStyles.textColor,
    }),
    [themeStyles.textColor],
  )

  const OptionComponent = useCallback(
    (optionProps: OptionProps<MaterialIconOption, false>) => {
      const glyph = materialIconGlyphMap[optionProps.data.value]
      const iconChar = glyph ? String.fromCodePoint(glyph) : '□'

      return (
        <components.Option {...optionProps}>
          <span style={optionLabelStyle}>
            <span style={iconSwatchStyle}>
              <span style={iconGlyphStyle}>{iconChar}</span>
            </span>
            <span>{optionProps.data.label}</span>
          </span>
        </components.Option>
      )
    },
    [iconGlyphStyle, iconSwatchStyle, optionLabelStyle],
  )

  const SingleValueComponent = useCallback(
    (singleProps: SingleValueProps<MaterialIconOption, false>) => {
      const glyph = materialIconGlyphMap[singleProps.data.value]
      const iconChar = glyph ? String.fromCodePoint(glyph) : '□'

      return (
        <components.SingleValue {...singleProps}>
          <span style={optionLabelStyle}>
            <span style={{ ...iconSwatchStyle, marginRight: 6 }}>
              <span style={iconGlyphStyle}>{iconChar}</span>
            </span>
            <span>{singleProps.data.label}</span>
          </span>
        </components.SingleValue>
      )
    },
    [iconGlyphStyle, iconSwatchStyle, optionLabelStyle],
  )

  const options = useMemo(() => materialIconOptions, [])

  const normalizedValue = useMemo(() => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'value' in value) {
      const candidate = (value as { value?: unknown }).value
      return typeof candidate === 'string' ? candidate : null
    }
    return null
  }, [value])

  const selected = useMemo(() => {
    if (!normalizedValue) return null
    return options.find((option) => option.value === normalizedValue) ?? null
  }, [options, normalizedValue])

  const [selectedOption, setSelectedOption] = useState<MaterialIconOption | null>(selected)

  useEffect(() => {
    setSelectedOption(selected)
  }, [selected])

  const handleSelectChange = useCallback(
    (option: MaterialIconOption | null) => {
      setSelectedOption(option)
      if (typeof onChange === 'function') {
        onChange(option?.value ?? null)
      }
    },
    [onChange],
  )

  return (
    <div className={className} style={containerStyle}>
      {effectiveLabel ? (
        <label
          htmlFor={inputId}
          style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: themeStyles.textColor }}
        >
          {effectiveLabel}
          {isFieldRequired ? <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span> : null}
        </label>
      ) : null}

      <Select<MaterialIconOption, false>
        inputId={inputId}
        instanceId={instanceId}
        isClearable
        isDisabled={isReadOnly}
        options={options}
        value={selectedOption}
        onChange={handleSelectChange}
        placeholder={fieldPlaceholder ?? 'Select an icon'}
        classNamePrefix="icon-picker"
        components={{
          Option: OptionComponent,
          SingleValue: SingleValueComponent,
        }}
        styles={{
          control: (base, state) => ({
            ...base,
            backgroundColor: themeStyles.controlBackground,
            color: themeStyles.textColor,
            borderColor: state.isFocused ? '#6366f1' : themeStyles.controlBorder,
            boxShadow: state.isFocused ? themeStyles.controlShadow : 'none',
            '&:hover': {
              borderColor: '#6366f1',
            },
          }),
          valueContainer: (base) => ({
            ...base,
            color: themeStyles.textColor,
          }),
          singleValue: (base) => ({
            ...base,
            color: themeStyles.textColor,
          }),
          placeholder: (base) => ({
            ...base,
            color: themeStyles.placeholderColor,
          }),
          input: (base) => ({
            ...base,
            color: themeStyles.textColor,
          }),
          menu: (base) => ({
            ...base,
            backgroundColor: themeStyles.menuBackground,
            border: `1px solid ${themeStyles.menuBorder}`,
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.18)',
            color: themeStyles.optionTextColor,
            overflow: 'hidden',
          }),
          menuList: (base) => ({
            ...base,
            backgroundColor: themeStyles.menuBackground,
            color: themeStyles.optionTextColor,
          }),
          option: (base, state) => ({
            ...base,
            backgroundColor: state.isSelected
              ? themeStyles.optionActiveBackground
              : state.isFocused
              ? themeStyles.optionHoverBackground
              : themeStyles.menuBackground,
            color: themeStyles.optionTextColor,
            paddingTop: 8,
            paddingBottom: 8,
          }),
          dropdownIndicator: (base, state) => ({
            ...base,
            color: state.isFocused ? '#6366f1' : themeStyles.placeholderColor,
            '&:hover': {
              color: '#6366f1',
            },
          }),
          clearIndicator: (base) => ({
            ...base,
            color: themeStyles.placeholderColor,
            '&:hover': {
              color: '#ef4444',
            },
          }),
          indicatorSeparator: (base) => ({
            ...base,
            backgroundColor: themeStyles.indicatorSeparator,
          }),
        }}
      />

      {fieldDescription ? (
        <p style={{ marginTop: 6, color: themeStyles.helperText, fontSize: 13 }}>{fieldDescription}</p>
      ) : null}

      {showError && errorMessage ? (
        <p style={{ marginTop: 6, color: '#dc2626', fontSize: 13 }}>{errorMessage}</p>
      ) : null}
    </div>
  )
}

export default IconPickerField
