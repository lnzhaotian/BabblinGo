import React, { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from "../theme-context";
import { config } from "@/lib/config";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colorScheme } = useThemeMode();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const colors = useMemo(() => ({
    bg: colorScheme === 'dark' ? '#0b0b0d' : '#f3f4f6',
    card: colorScheme === 'dark' ? '#18181b' : '#ffffff',
    text: colorScheme === 'dark' ? '#fafafa' : '#111827',
    sub: colorScheme === 'dark' ? '#d1d5db' : '#6b7280',
    inputBg: colorScheme === 'dark' ? '#111113' : '#f9fafb',
    inputBorder: colorScheme === 'dark' ? '#26262b' : '#e5e7eb',
    inputText: colorScheme === 'dark' ? '#e5e7eb' : '#111827',
    primary: '#6366f1',
    primaryPressed: colorScheme === 'dark' ? '#4f46e5' : '#4f46e5',
    danger: '#ef4444',
    success: '#10b981',
    divider: colorScheme === 'dark' ? '#23232a' : '#e5e7eb',
    shadow: '#000',
    icon: colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af',
  }), [colorScheme]);

  const isEmailValid = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      // Call backend reset endpoint using configured API base
      const res = await fetch(`${config.apiUrl}/api/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
  {/* No header for modal auth screens; header is hidden at layout level */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}> 
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>{t('auth.forgotPassword')}</Text>
              <MaterialIcons name="help-outline" size={24} color={colors.icon} />
            </View>

            <Text style={[styles.helper, { color: colors.sub }]}>{t('auth.resetInstructions')}</Text>

            {/* Email */}
            <View style={[styles.inputGroup]}> 
              <Text style={[styles.label, { color: colors.sub }]}>{t('auth.email')}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}> 
                <MaterialIcons name="mail-outline" size={20} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: colors.inputText }]}
                  placeholder={t('auth.email')}
                  placeholderTextColor={colors.sub}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="send"
                  onSubmitEditing={() => { if (isEmailValid && !loading) handleSend(); }}
                />
              </View>
              {!!email && !isEmailValid && (
                <Text style={[styles.validation, { color: colors.danger }]}>Invalid email format</Text>
              )}
            </View>

            {error && <Text style={[styles.error, { color: colors.danger }]}>{t('auth.resetError', { error })}</Text>}
            {sent && <Text style={[styles.success, { color: colors.success }]}>{t('auth.resetSent')}</Text>}

            <Pressable
              onPress={handleSend}
              disabled={!isEmailValid || loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: (!isEmailValid || loading) ? (colorScheme === 'dark' ? '#27272a' : '#e5e7eb') : (pressed ? colors.primaryPressed : colors.primary) },
              ]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('auth.sendReset')}</Text>}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            </View>

            <Pressable onPress={() => router.replace('/auth/login')} style={({ pressed }) => [{ paddingVertical: 10, alignItems: 'center', opacity: pressed ? 0.85 : 1 }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{t('auth.backToLogin')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  helper: { fontSize: 14, marginBottom: 8 },
  inputGroup: { marginTop: 10 },
  label: { fontSize: 14, marginBottom: 6, fontWeight: '500' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  input: { height: 40, fontSize: 16, flex: 1 },
  validation: { marginTop: 6, fontSize: 12 },
  error: { marginTop: 10, textAlign: 'center', fontSize: 14 },
  success: { marginTop: 10, textAlign: 'center', fontSize: 14 },
  primaryBtn: { marginTop: 16, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dividerRow: { marginVertical: 16 },
  divider: { height: 1, width: '100%', opacity: 0.6 },
})
