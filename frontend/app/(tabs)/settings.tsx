import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import { useFocusEffect } from '@react-navigation/native';
import { clearAuthSession, getAuthToken, getCachedProfile, subscribeAuthState } from '@/lib/auth-session';

type SettingItem = {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  titleKey: string;
  descriptionKey?: string;
  route: string;
  showChevron?: boolean;
};

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userAvatarIcon, setUserAvatarIcon] = useState<string>('person');
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const { colorScheme } = useThemeMode();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshAuthSnapshot = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!isMountedRef.current) return;

      setIsAuthenticated(!!token);

      if (token) {
        const profile = await getCachedProfile();
        if (!isMountedRef.current) return;

        setUserEmail(profile.email);
        setUserName(profile.displayName);
        setUserAvatarIcon(profile.avatarIcon || 'person');
        setTokenBalance(profile.tokenBalance);
      } else {
        setUserEmail(null);
        setUserName(null);
        setUserAvatarIcon('person');
        setTokenBalance(null);
      }
    } catch {
      if (!isMountedRef.current) return;
      setIsAuthenticated(false);
      setUserEmail(null);
      setUserName(null);
      setUserAvatarIcon('person');
      setTokenBalance(null);
    }
  }, []);

  // Update auth state on screen focus and initial mount
  useFocusEffect(
    useCallback(() => {
      refreshAuthSnapshot();
      return undefined;
    }, [refreshAuthSnapshot])
  );

  useEffect(() => {
    const unsubscribe = subscribeAuthState(() => {
      refreshAuthSnapshot();
    });
    return unsubscribe;
  }, [refreshAuthSnapshot]);

  const handleLogout = useCallback(async () => {
    await clearAuthSession();
    await refreshAuthSnapshot();
  }, [refreshAuthSnapshot]);

  const preferencesSection: SettingItem[] = [
    {
      id: "language",
      icon: "language" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#6366f1",
      titleKey: "settings.language",
      descriptionKey: "settings.languageDescription",
      route: "/settings/language",
      showChevron: true,
    },
    {
      id: "learning",
      icon: "school" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#3b82f6",
      titleKey: "settings.learningPreferences",
      descriptionKey: "settings.learningPreferencesDescription",
      route: "/settings/learning",
      showChevron: true,
    },
    {
      id: "cache",
      icon: "cloud-queue" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#10b981",
      titleKey: "settings.cache.title",
      descriptionKey: "settings.cache.description",
      route: "/settings/cache",
      showChevron: true,
    },
    {
      id: "records",
      icon: "history" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#f59e0b",
      titleKey: "settings.records.title",
      descriptionKey: "settings.records.description",
      route: "/settings/records",
      showChevron: true,
    },
    {
      id: "theme",
      icon: "dark-mode" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#6366f1",
      titleKey: "settings.theme",
      descriptionKey: "settings.themeDescription",
      route: "/settings/theme",
      showChevron: true,
    },
    {
      id: "about",
      icon: "info" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#8b5cf6",
      titleKey: "settings.about",
      route: "/settings/about",
      showChevron: true,
    },
  ];

  const renderSettingItem = (item: SettingItem) => {
    const title = t(item.titleKey);
    const description = item.descriptionKey ? t(item.descriptionKey) : undefined;

    return (
      <Pressable
        key={item.id}
        onPress={() => item.route && router.push(item.route as never)}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 18,
          paddingHorizontal: 16,
          backgroundColor: pressed ? "#f3f4f6" : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }, colorScheme === 'dark' && {
          backgroundColor: pressed ? '#23232a' : '#18181b',
          borderBottomColor: '#23232a',
        }]}
      >
        <MaterialIcons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 18 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "500", color: colorScheme === 'dark' ? '#fff' : undefined }}>{title}</Text>
          {description && <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", marginTop: 2 }}>{description}</Text>}
        </View>
        {item.showChevron && (
          <MaterialIcons name="chevron-right" size={24} color={colorScheme === 'dark' ? '#a1a1aa' : "#d1d5db"} />
        )}
      </Pressable>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={{ 
      paddingHorizontal: 16, 
      paddingTop: 24, 
      paddingBottom: 8,
      backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb"
    }}>
      <Text style={{ 
        fontSize: 13, 
        fontWeight: '600', 
        color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5
      }}>
        {title}
      </Text>
    </View>
  );

  const renderUserCard = () => (
    <Pressable
      onPress={() => router.push('/settings/profile')}
      style={({ pressed }) => [{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: pressed ? "#f3f4f6" : "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
      }, colorScheme === 'dark' && {
        backgroundColor: pressed ? '#23232a' : '#18181b',
        borderBottomColor: '#23232a',
      }]}
    >
      <View style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
      }}>
        <MaterialIcons name={userAvatarIcon as any} size={32} color="#6366f1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontSize: 18, 
          fontWeight: "600", 
          color: colorScheme === 'dark' ? '#fff' : '#111827',
          marginBottom: 2
        }}>
          {userName || t('profile.noDisplayName')}
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: colorScheme === 'dark' ? '#d1d5db' : '#6b7280' 
        }}>
          {userEmail || t('profile.noEmail')}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colorScheme === 'dark' ? '#a1a1aa' : "#d1d5db"} />
    </Pressable>
  );

  const renderTokenCard = () => (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff",
      borderBottomWidth: 1,
      borderBottomColor: colorScheme === 'dark' ? '#23232a' : "#f3f4f6",
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
        marginLeft: 8
      }}>
        <MaterialIcons name="stars" size={24} color="#6366f1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: "600", 
          color: colorScheme === 'dark' ? '#fff' : '#111827',
        }}>
          {t('settings.tokenBalance', { defaultValue: 'Token Balance' })}
        </Text>
      </View>
      <Text style={{ 
        fontSize: 18, 
        fontWeight: "700", 
        color: colorScheme === 'dark' ? '#818cf8' : '#4f46e5' 
      }}>
        {tokenBalance !== null ? tokenBalance.toLocaleString() : '-'}
      </Text>
    </View>
  );

  const renderAuthButtons = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
      <Pressable
        onPress={() => router.push('/auth/login')}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? "#5b5fc7" : "#6366f1",
          borderRadius: 12,
          paddingVertical: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 2,
        }]}
      >
        <MaterialIcons name="login" size={22} color="#fff" style={{ marginRight: 10 }} />
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>{t('settings.login')}</Text>
      </Pressable>
      
      <Pressable
        onPress={() => router.push('/auth/register')}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
          borderRadius: 12,
          paddingVertical: 16,
          borderWidth: 2,
          borderColor: colorScheme === 'dark' ? '#3f3f46' : '#e5e7eb',
          opacity: pressed ? 0.7 : 1
        }]}
      >
        <MaterialIcons name="person-add" size={22} color={colorScheme === 'dark' ? '#a1a1aa' : '#6b7280'} style={{ marginRight: 10 }} />
        <Text style={{ 
          color: colorScheme === 'dark' ? '#d1d5db' : '#374151', 
          fontSize: 17, 
          fontWeight: '600' 
        }}>
          {t('settings.register')}
        </Text>
      </Pressable>
    </View>
  );

  const renderLogout = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}>
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? "#dc2626" : colorScheme === 'dark' ? '#7f1d1d' : '#fee2e2',
          borderRadius: 12,
          paddingVertical: 16,
          borderWidth: 1,
          borderColor: colorScheme === 'dark' ? '#991b1b' : '#fecaca',
        }]}
      >
        <MaterialIcons name="logout" size={22} color={colorScheme === 'dark' ? '#fca5a5' : '#dc2626'} style={{ marginRight: 10 }} />
        <Text style={{ 
          color: colorScheme === 'dark' ? '#fca5a5' : '#dc2626', 
          fontSize: 17, 
          fontWeight: '600' 
        }}>
          {t('settings.logout')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <>
  {/* Header handled by Tabs layout; avoid per-screen header overrides */}
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={['top', 'left', 'right']}>
        <ScrollView>
          {/* Account Section */}
          {renderSectionHeader(t('settings.accountSection'))}
          {isAuthenticated ? (
            <>
              {renderUserCard()}
              {renderTokenCard()}
            </>
          ) : (
            renderAuthButtons()
          )}

          {/* Preferences Section */}
          {renderSectionHeader(t('settings.preferencesSection'))}
          <View style={{
            backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: colorScheme === 'dark' ? '#23232a' : '#f3f4f6',
          }}>
            {preferencesSection.map(renderSettingItem)}
          </View>

          {/* Logout Section */}
          {isAuthenticated && renderLogout()}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
