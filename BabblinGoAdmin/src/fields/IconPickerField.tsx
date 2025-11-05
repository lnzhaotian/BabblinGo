'use client'

import { useEffect, useMemo, type CSSProperties } from 'react'
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

const iconSwatchStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: 6,
  backgroundColor: '#eef2ff',
  marginRight: 10,
}

const optionLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
}

const OptionComponent = (props: OptionProps<MaterialIconOption, false>) => {
  const glyph = materialIconGlyphMap[props.data.value]
  const iconChar = glyph ? String.fromCodePoint(glyph) : '□'
  return (
    <components.Option {...props}>
      <span style={optionLabelStyle}>
        <span style={iconSwatchStyle}>
          <span style={{ fontFamily: MATERIAL_ICON_FONT, fontSize: 20, color: '#4338ca' }}>
            {iconChar}
          </span>
        </span>
        <span>{props.data.label}</span>
      </span>
    </components.Option>
  )
}

const SingleValueComponent = (props: SingleValueProps<MaterialIconOption, false>) => {
  const glyph = materialIconGlyphMap[props.data.value]
  const iconChar = glyph ? String.fromCodePoint(glyph) : '□'
  return (
    <components.SingleValue {...props}>
      <span style={optionLabelStyle}>
        <span style={{ ...iconSwatchStyle, marginRight: 6 }}>
          <span style={{ fontFamily: MATERIAL_ICON_FONT, fontSize: 20, color: '#4338ca' }}>
            {iconChar}
          </span>
        </span>
        <span>{props.data.label}</span>
      </span>
    </components.SingleValue>
  )
}

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
} & Record<string, unknown>

const IconPickerField = (props: IconPickerFieldProps) => {
  const {
    label,
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
  } = props

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

  const options = useMemo(() => materialIconOptions, [])

  const selected = useMemo(() => {
    if (!value) return null
    return options.find((option) => option.value === value) ?? null
  }, [options, value])

  return (
    <div className={className}>
      {label ? (
        <label htmlFor={path} style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
          {label}
          {required ? <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span> : null}
        </label>
      ) : null}

      <Select<MaterialIconOption, false>
        inputId={path}
        isClearable
        isDisabled={readOnly}
        options={options}
        value={selected}
        onChange={(option) => {
          onChange(option?.value ?? null)
        }}
        placeholder={placeholder ?? 'Select an icon'}
        classNamePrefix="icon-picker"
        components={{
          Option: OptionComponent,
          SingleValue: SingleValueComponent,
        }}
        styles={{
          control: (base, state) => ({
            ...base,
            borderColor: state.isFocused ? '#6366f1' : '#d1d5db',
            boxShadow: state.isFocused ? '0 0 0 2px rgba(99, 102, 241, 0.2)' : 'none',
            '&:hover': {
              borderColor: '#6366f1',
            },
          }),
          option: (base) => ({
            ...base,
            paddingTop: 8,
            paddingBottom: 8,
          }),
        }}
      />

      {description ? (
        <p style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>{description}</p>
      ) : null}

      {showError && errorMessage ? (
        <p style={{ marginTop: 6, color: '#dc2626', fontSize: 13 }}>{errorMessage}</p>
      ) : null}
    </div>
  )
}

export default IconPickerField
