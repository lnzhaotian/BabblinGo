import MaterialIconsGlyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json"

export type MaterialIconOption = {
  label: string
  value: string
}

export const materialIconGlyphMap = MaterialIconsGlyphMap as Record<string, number>

export const materialIconOptions: MaterialIconOption[] = Object.keys(materialIconGlyphMap)
  .sort((a, b) => a.localeCompare(b))
  .map((iconName) => ({
    label: iconName,
    value: iconName,
  }))

export default materialIconOptions
