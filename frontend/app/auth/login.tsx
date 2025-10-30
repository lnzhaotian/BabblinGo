import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { Stack, useRouter } from "expo-router";
import { loginUser } from '../../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await loginUser({ email, password });
      if (result?.token) {
        await AsyncStorage.setItem('jwt', result.token);
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
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("settings.login") }} />
      <View style={styles.card}>
        {/* <Text style={styles.title}>{t('settings.login')}</Text>
        <Text style={styles.subtitle}>{t('auth.email')}</Text> */}
        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {/* <Text style={styles.subtitle}>{t('auth.password')}</Text> */}
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error && <Text style={styles.error}>{t('auth.loginError', { error })}</Text>}
        {success && <Text style={styles.success}>{t('auth.loginSuccess')}</Text>}
        <View style={{ marginTop: 16 }}>
          <Button title={loading ? t('auth.loggingIn') : t('settings.login')} onPress={handleLogin} disabled={loading} />
        </View>
        <Text style={styles.helperText}>{t('auth.noAccount')}</Text>
        <View style={{ marginTop: 8 }}>
          <Button title={t('settings.register')} onPress={() => router.replace('/auth/register')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f3f4f6',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#222',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 12,
    color: '#555',
  },
  input: {
    height: 48,
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  error: {
    color: '#ef4444',
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 15,
  },
  success: {
    color: '#10b981',
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 15,
  },
  helperText: {
    marginTop: 18,
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 15,
  },
});
