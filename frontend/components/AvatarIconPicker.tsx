import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../app/theme-context';

// Curated list of 42 icons suitable for avatars
const AVATAR_ICONS: (keyof typeof MaterialIcons.glyphMap)[] = [
  'person',
  'face',
  'account-circle',
  'emoji-emotions',
  'sentiment-satisfied',
  'child-care',
  'school',
  'workspace-premium',
  'military-tech',
  'sports-esports',
  'sports-soccer',
  'sports-basketball',
  'sports-tennis',
  'directions-bike',
  'directions-run',
  'fitness-center',
  'pool',
  'beach-access',
  'auto-awesome',
  'wb-sunny',
  'nightlight',
  'pets',
  'favorite',
  'stars',
  'cake',
  'coffee',
  'local-pizza',
  'fastfood',
  'icecream',
  'music-note',
  'headphones',
  'mic',
  'piano',
  'brush',
  'palette',
  'camera',
  'photo-camera',
  'videogame-asset',
  'rocket-launch',
  'flight',
  'sailing',
  'park',
];

interface AvatarIconPickerProps {
  visible: boolean;
  currentIcon?: string;
  onSelect: (iconName: string) => void;
  onClose: () => void;
}

export function AvatarIconPicker({ visible, currentIcon, onSelect, onClose }: AvatarIconPickerProps) {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();

  const colors = useMemo(() => ({
    bg: colorScheme === 'dark' ? '#18181b' : '#fff',
    text: colorScheme === 'dark' ? '#fafafa' : '#111827',
    sub: colorScheme === 'dark' ? '#d1d5db' : '#6b7280',
    border: colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb',
    primary: '#6366f1',
    selected: colorScheme === 'dark' ? '#312e81' : '#e0e7ff',
    hover: colorScheme === 'dark' ? '#27272a' : '#f3f4f6',
  }), [colorScheme]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('profile.selectAvatar')}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <MaterialIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        {/* Icon Grid */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.grid}>
            {AVATAR_ICONS.map((iconName) => {
              const isSelected = currentIcon === iconName;
              return (
                <Pressable
                  key={iconName}
                  onPress={() => {
                    onSelect(iconName);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.iconButton,
                    {
                      backgroundColor: isSelected
                        ? colors.selected
                        : pressed
                        ? colors.hover
                        : 'transparent',
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <MaterialIcons
                    name={iconName}
                    size={32}
                    color={isSelected ? colors.primary : colors.text}
                  />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  iconButton: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
