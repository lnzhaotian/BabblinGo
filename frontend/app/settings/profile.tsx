
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Image, TextInput, Pressable, Modal, ActivityIndicator, Alert, useColorScheme } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";
import { config } from "@/lib/config";

export default function UserProfileScreen() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editAvatar, setEditAvatar] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await AsyncStorage.getItem('jwt');
        if (!token) throw new Error('Not authenticated');
        // Fetch user profile from API
        const res = await fetch(`${config.apiUrl}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          console.log('User profile response:', data);
          // Use data.user for all profile info
          setEmail(data.user?.email || null);
          setDisplayName(data.user?.displayName || null);
          setAvatar(data.user?.avatarUrl || null);
          setUserId(data.user?.id || data.user?._id || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  const openEditModal = () => {
    setEditName(displayName || "");
    setEditAvatar(avatar || "");
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('jwt');
      if (!token) throw new Error('Not authenticated');
      if (!userId) throw new Error('User ID not found');
      // PATCH to /api/users/:id
      const res = await fetch(`${config.apiUrl}/api/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ displayName: editName, avatarUrl: editAvatar }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDisplayName(data.displayName || editName);
      setAvatar(data.avatarUrl || editAvatar);
      setEditModalVisible(false);
      Alert.alert(t('common.done'), t('settings.learning.savedMessage'));
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      Alert.alert(t('common.error'), err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, colorScheme === 'dark' && { backgroundColor: '#18181b' }]}> 
      <Stack.Screen options={{ title: t("profile.title") }} />
      <View style={[styles.card, colorScheme === 'dark' && { backgroundColor: '#23232a' }]}> 
        {loading ? (
          <ActivityIndicator size="large" color="#6366f1" />
        ) : (
          <>
            <View style={styles.avatarContainer}>
              <Image
                source={avatar ? { uri: avatar } : require('@/assets/images/default-avatar.png')}
                style={styles.avatar}
              />
            </View>
            <Text style={[styles.name, colorScheme === 'dark' && { color: '#fff' }]}>{displayName || t('profile.noDisplayName', 'N/A')}</Text>
            <Text style={[styles.email, colorScheme === 'dark' && { color: '#d1d5db' }]}>{email || t('profile.noEmail', 'N/A')}</Text>
            <Pressable style={styles.editButton} onPress={openEditModal}>
              <Text style={styles.editButtonText}>{t('common.tapToEdit', 'Edit')}</Text>
            </Pressable>
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </View>
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, colorScheme === 'dark' && { backgroundColor: '#23232a' }]}> 
            <Text style={[styles.modalTitle, colorScheme === 'dark' && { color: '#fff' }]}>{t('profile.title', 'Edit Profile')}</Text>
            <TextInput
              style={[styles.input, colorScheme === 'dark' && { backgroundColor: '#18181b', color: '#fff', borderColor: '#444' }]}
              value={editName}
              onChangeText={setEditName}
              placeholder={t('auth.displayName')}
              placeholderTextColor={colorScheme === 'dark' ? '#888' : undefined}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input, colorScheme === 'dark' && { backgroundColor: '#18181b', color: '#fff', borderColor: '#444' }]}
              value={editAvatar}
              onChangeText={setEditAvatar}
              placeholder={t('profile.avatarUrl', 'Avatar URL')}
              placeholderTextColor={colorScheme === 'dark' ? '#888' : undefined}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('common.save', 'Save')}</Text>
                )}
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 400,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e5e7eb',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  email: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  editButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  error: {
    color: '#ef4444',
    marginTop: 12,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 18,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#f9fafb',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginRight: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
});
