import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useThemeMode } from '../app/theme-context';

export type SelectOption = { value: string; label: string };

interface SelectModalProps {
  visible: boolean;
  title?: string;
  options: SelectOption[];
  value?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function SelectModal({ visible, title, options, value, onSelect, onClose }: SelectModalProps) {
  const { colorScheme } = useThemeMode();
  const colors = useMemo(() => ({
    bg: colorScheme === 'dark' ? '#18181b' : '#fff',
    text: colorScheme === 'dark' ? '#fafafa' : '#111827',
    border: colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb',
    hover: colorScheme === 'dark' ? '#27272a' : '#f3f4f6',
    primary: '#6366f1',
  }), [colorScheme]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }] }>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title || 'Select'}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
          {options.map(opt => {
            const selected = value === opt.value;
            return (
              <Pressable key={opt.value} onPress={() => { onSelect(opt.value); onClose(); }}
                style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, backgroundColor: pressed ? colors.hover : 'transparent' }]}>
                <Text style={{ color: colors.text, fontSize: 16, flex: 1 }}>{opt.label}</Text>
                {selected ? <Text style={{ color: colors.primary, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center' },
});
