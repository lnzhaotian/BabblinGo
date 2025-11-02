import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { loginUser } from '../../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMode } from "../theme-context";

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { colorScheme } = useThemeMode();
  const [email, setEmail] = useState(() => (typeof params.email === 'string' ? params.email : ''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
  const isFormValid = email.length > 3 && isEmailValid && password.length >= 6;

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await loginUser({ email, password });
      if (result?.token) {
        await AsyncStorage.setItem('jwt', result.token);
        await AsyncStorage.setItem('user_email', email);
        setSuccess(true);
        // Go back after successful login and trigger settings refresh
        setTimeout(() => {
          router.back();
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ title: t("settings.login") }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.shadow }]}> 
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.text }]}>{t('settings.login')}</Text>
              <MaterialIcons name="login" size={24} color={colors.icon} />
            </View>

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
                  returnKeyType="next"
                />
              </View>
              {!!email && !isEmailValid && (
                <Text style={[styles.validation, { color: colors.danger }]}>Invalid email format</Text>
              )}
            </View>

            {/* Password */}
            <View style={[styles.inputGroup]}> 
              <Text style={[styles.label, { color: colors.sub }]}>{t('auth.password')}</Text>
              <View style={[styles.inputWrapper, { borderColor: colors.inputBorder, backgroundColor: colors.inputBg }]}> 
                <MaterialIcons name="lock-outline" size={20} color={colors.icon} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.input, { color: colors.inputText, flex: 1 }]}
                  placeholder={t('auth.password')}
                  placeholderTextColor={colors.sub}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => { if (isFormValid && !loading) handleLogin(); }}
                />
                <Pressable onPress={() => setShowPassword(p => !p)} hitSlop={10}>
                  <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color={colors.icon} />
                </Pressable>
              </View>
              {!!password && password.length < 6 && (
                <Text style={[styles.validation, { color: colors.danger }]}>At least 6 characters</Text>
              )}
            </View>

            {error && <Text style={[styles.error, { color: colors.danger }]}>{t('auth.loginError', { error })}</Text>}
            {success && <Text style={[styles.success, { color: colors.success }]}>{t('auth.loginSuccess')}</Text>}

            <Pressable onPress={() => router.push('/auth/forgot')} style={({ pressed }) => [{ alignSelf: 'flex-end', marginTop: 8, opacity: pressed ? 0.8 : 1 }]}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{t('auth.forgotPassword')}</Text>
            </Pressable>

            <Pressable
              onPress={handleLogin}
              disabled={!isFormValid || loading}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: (!isFormValid || loading) ? (colorScheme === 'dark' ? '#27272a' : '#e5e7eb') : (pressed ? colors.primaryPressed : colors.primary),
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t('settings.login')}</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            </View>

            <Text style={[styles.helperText, { color: colors.sub }]}>{t('auth.noAccount')}</Text>
            <Pressable
              onPress={() => router.replace('/auth/register')}
              style={({ pressed }) => [styles.secondaryBtn, { opacity: pressed ? 0.85 : 1, borderColor: colors.inputBorder }]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.text }]}>{t('settings.register')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  inputGroup: {
    marginTop: 10,
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    height: 40,
    fontSize: 16,
    flex: 1,
  },
  validation: {
    marginTop: 6,
    fontSize: 12,
  },
  error: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  success: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  primaryBtn: {
    marginTop: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  dividerRow: {
    marginVertical: 16,
  },
  divider: {
    height: 1,
    width: '100%',
    opacity: 0.6,
  },
  helperText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 8,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
