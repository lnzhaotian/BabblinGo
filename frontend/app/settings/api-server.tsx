import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from '../theme-context';
import { ThemedHeader } from '@/components/ThemedHeader';
import {
  getApiUrl,
  getDefaultApiUrl,
  setApiUrlOverride,
  clearApiUrlOverride,
} from '@/lib/config';

const PRESET_SERVERS = [
  { id: 'prod', label: 'Production', url: 'https://admin.babblinguide.cn' },
  { id: 'new', label: 'New Unified API', url: 'https://testapi.babblinguide.cn' },
  { id: 'local', label: 'Local Dev', url: 'http://localhost:3000' },
] as const;

const normalize = (value: string) => value.trim().replace(/\/$/, '');

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function ApiServerSettings() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();
  const defaultUrl = getDefaultApiUrl();
  const [inputValue, setInputValue] = useState(getApiUrl());
  const [saving, setSaving] = useState(false);

  const colors = useMemo(
    () => ({
      bg: colorScheme === 'dark' ? '#18181b' : '#f9fafb',
      card: colorScheme === 'dark' ? '#23232a' : '#ffffff',
      border: colorScheme === 'dark' ? '#2f2f39' : '#e5e7eb',
      text: colorScheme === 'dark' ? '#fafafa' : '#111827',
      sub: colorScheme === 'dark' ? '#d1d5db' : '#6b7280',
      inputBg: colorScheme === 'dark' ? '#111113' : '#f9fafb',
      inputBorder: colorScheme === 'dark' ? '#3f3f46' : '#d1d5db',
    }),
    [colorScheme],
  );

  const currentApiUrl = normalize(inputValue || '');

  const saveUrl = async (url: string) => {
    const normalized = normalize(url);
    if (!normalized || !isValidHttpUrl(normalized)) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('settings.apiServer.invalidUrl', {
          defaultValue: 'Please enter a valid http(s) API URL.',
        }),
      );
      return;
    }

    setSaving(true);
    try {
      await setApiUrlOverride(normalized);
      setInputValue(normalized);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('settings.apiServer.updated', {
          defaultValue: 'API server updated. New requests will use this URL immediately.',
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    setSaving(true);
    try {
      await clearApiUrlOverride();
      setInputValue(defaultUrl);
      Alert.alert(
        t('common.success', { defaultValue: 'Success' }),
        t('settings.apiServer.reset', {
          defaultValue: 'API server reset to the build default.',
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ThemedHeader titleKey="settings.apiServer.title" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
              {t('settings.apiServer.current', { defaultValue: 'Current API Server' })}
            </Text>
            <Text style={{ color: colors.sub, marginBottom: 8 }}>
              {currentApiUrl || getApiUrl()}
            </Text>
            <Text style={{ color: colors.sub, fontSize: 12 }}>
              {t('settings.apiServer.default', { defaultValue: 'Build default' })}: {defaultUrl}
            </Text>
          </View>

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
              {t('settings.apiServer.quickSwitch', { defaultValue: 'Quick Switch' })}
            </Text>
            <View style={{ gap: 10 }}>
              {PRESET_SERVERS.map((server) => (
                <Pressable
                  key={server.id}
                  disabled={saving}
                  onPress={() => saveUrl(server.url)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.inputBg : 'transparent',
                    opacity: saving ? 0.6 : 1,
                  })}
                >
                  <View>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{server.label}</Text>
                    <Text style={{ color: colors.sub, fontSize: 12 }}>{server.url}</Text>
                  </View>
                  {normalize(server.url) === normalize(currentApiUrl) && (
                    <MaterialIcons name="check-circle" size={20} color="#10b981" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 10 }}>
              {t('settings.apiServer.custom', { defaultValue: 'Custom URL' })}
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="https://your-api.example.com"
              placeholderTextColor={colors.sub}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              style={{
                borderWidth: 1,
                borderColor: colors.inputBorder,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: colors.inputBg,
                marginBottom: 12,
              }}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                disabled={saving}
                onPress={() => saveUrl(inputValue)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: pressed ? '#4338ca' : '#4f46e5',
                  opacity: saving ? 0.6 : 1,
                })}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {t('common.save', { defaultValue: 'Save' })}
                </Text>
              </Pressable>

              <Pressable
                disabled={saving}
                onPress={resetToDefault}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.inputBg : 'transparent',
                  opacity: saving ? 0.6 : 1,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {t('settings.apiServer.useDefault', { defaultValue: 'Use Default' })}
                </Text>
              </Pressable>
            </View>
          </View>

          <Text style={{ color: colors.sub, fontSize: 12, paddingHorizontal: 4 }}>
            {t('settings.apiServer.note', {
              defaultValue:
                'This setting is stored on-device and is ideal for TestFlight QA. If the selected server is unreachable, requests will fail until you switch back.',
            })}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
