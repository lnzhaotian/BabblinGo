import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from "react-i18next";
import { config } from "@/lib/config";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import { ThemedHeader } from "../components/ThemedHeader";

export default function UserProfileScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  const isNameValid = useMemo(() => editName.trim().length >= 2, [editName]);
  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await AsyncStorage.getItem('jwt');
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${config.apiUrl}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setEmail(data.user?.email || null);
        setDisplayName(data.user?.displayName || null);
        setEditName(data.user?.displayName || "");
        setUserId(data.user?.id || data.user?._id || null);
        // Store for settings page
        await AsyncStorage.setItem('user_email', data.user?.email || '');
        await AsyncStorage.setItem('user_displayName', data.user?.displayName || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  const handleEdit = () => {
    setEditName(displayName || "");
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditName(displayName || "");
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!isNameValid) return;
    setSaving(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('jwt');
      if (!token) throw new Error('Not authenticated');
      if (!userId) throw new Error('User ID not found');
      const res = await fetch(`${config.apiUrl}/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ displayName: editName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDisplayName(data.doc?.displayName || editName);
      await AsyncStorage.setItem('user_displayName', data.doc?.displayName || editName);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !displayName) {
    return (
      <>
        <ThemedHeader titleKey="profile.title" />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <ThemedHeader titleKey="profile.title" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ padding: 20 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Card */}
          <View style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 24,
            marginBottom: 16,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
              },
              android: {
                elevation: 4,
              },
            }),
          }}>
            {/* Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: colors.primary + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
              }}>
                <MaterialIcons name="person" size={40} color={colors.primary} />
              </View>
              {!isEditing && (
                <Pressable
                  onPress={handleEdit}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                    backgroundColor: colors.primary + '10',
                    borderRadius: 20,
                  }}
                >
                  <MaterialIcons name="edit" size={16} color={colors.primary} />
                  <Text style={{ 
                    marginLeft: 6, 
                    color: colors.primary,
                    fontSize: 14,
                    fontWeight: '600',
                  }}>
                    {t('profile.editProfile')}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={{
                backgroundColor: '#fee',
                padding: 12,
                borderRadius: 8,
                marginBottom: 16,
              }}>
                <Text style={{ color: '#c00', fontSize: 14 }}>{error}</Text>
              </View>
            )}

            {/* Display Name */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.text,
                opacity: 0.6,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {t('profile.displayName')}
              </Text>
              {isEditing ? (
                <View>
                  <TextInput
                    value={editName}
                    onChangeText={(text) => setEditName(text)}
                    placeholder={t('profile.displayName')}
                    placeholderTextColor={colors.text + '60'}
                    autoCapitalize="words"
                    style={{
                      backgroundColor: colors.inputBg,
                      borderWidth: 1,
                      borderColor: isNameValid ? colors.inputBorder : '#ff6b6b',
                      borderRadius: 12,
                      padding: 16,
                      fontSize: 16,
                      color: colors.text,
                    }}
                  />
                  {!isNameValid && (
                    <Text style={{ color: '#ff6b6b', fontSize: 12, marginTop: 4 }}>
                      {t('profile.nameRequired')}
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: colors.text,
                }}>
                  {displayName || t('profile.notSet')}
                </Text>
              )}
            </View>

            {/* Email (Read-only) */}
            <View style={{ marginBottom: isEditing ? 24 : 0 }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.text,
                opacity: 0.6,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {t('profile.email')}
              </Text>
              <Text style={{
                fontSize: 16,
                color: colors.text,
                opacity: 0.8,
              }}>
                {email || t('profile.notSet')}
              </Text>
            </View>

            {/* Edit Mode Buttons */}
            {isEditing && (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <Pressable
                  onPress={handleCancel}
                  disabled={saving}
                  style={{
                    flex: 1,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.inputBorder,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    {t('profile.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving || !isNameValid}
                  style={{
                    flex: 1,
                    backgroundColor: (!saving && isNameValid) ? colors.primary : colors.inputBorder,
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                  }}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{
                      color: '#fff',
                      fontSize: 16,
                      fontWeight: '600',
                    }}>
                      {t('profile.save')}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
}
