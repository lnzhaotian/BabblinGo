import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from "react-i18next";
import { Stack } from "expo-router";

export default function UserProfileScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // Example: fetch user info from AsyncStorage or API
    const fetchUserInfo = async () => {
      // You may want to fetch from API using JWT
      const storedEmail = await AsyncStorage.getItem('user_email');
      const storedDisplayName = await AsyncStorage.getItem('user_displayName');
      setEmail(storedEmail);
      setDisplayName(storedDisplayName);
    };
    fetchUserInfo();
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t("profile.title") }} />
      <Text style={styles.title}>{t('profile.title', 'User Profile')}</Text>
      <Text style={styles.label}>{t('auth.email')}: {email || t('profile.noEmail', 'N/A')}</Text>
      <Text style={styles.label}>{t('auth.displayName')}: {displayName || t('profile.noDisplayName', 'N/A')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    marginBottom: 12,
  },
});
