import React, { useState } from 'react';
import { useRouter, Stack } from "expo-router";
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { registerUser } from '../../lib/auth';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await registerUser({ email, password, displayName });
      setSuccess(true);
      // Redirect to login after successful registration
      setTimeout(() => {
        router.replace('/auth/login');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("settings.register") }} />
      <View style={styles.card}>
        {/* <Text style={styles.title}>{t('settings.register')}</Text>
        <Text style={styles.subtitle}>{t('auth.email')}</Text> */}
        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        {/* <Text style={styles.subtitle}>{t('auth.displayName')}</Text> */}
        <TextInput
          style={styles.input}
          placeholder={t('auth.displayName')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        {/* <Text style={styles.subtitle}>{t('auth.password')}</Text> */}
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error && <Text style={styles.error}>{t('auth.registrationError', { error })}</Text>}
        {success && <Text style={styles.success}>{t('auth.registrationSuccess')}</Text>}
        <View style={{ marginTop: 16 }}>
          <Button title={loading ? t('auth.registering') : t('settings.register')} onPress={handleRegister} disabled={loading} />
        </View>
        <Text style={styles.helperText}>{t('auth.alreadyHaveAccount')}</Text>
        <View style={{ marginTop: 8 }}>
          <Button title={t('settings.login')} onPress={() => router.replace('/auth/login')} />
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
