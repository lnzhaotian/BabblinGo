import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from "react-i18next";
import { config } from "@/lib/config";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import { ThemedHeader } from "@/components/ThemedHeader";
import { AvatarIconPicker } from "@/components/AvatarIconPicker";
import { SelectModal, SelectOption } from "@/components/SelectModal";
import DateTimePicker from '@react-native-community/datetimepicker';

// Levels for learning languages
const LEVEL_OPTIONS = [
  { key: 'beginner', labelKey: 'profile.level.beginner' },
  { key: 'elementary', labelKey: 'profile.level.elementary' },
  { key: 'intermediate', labelKey: 'profile.level.intermediate' },
  { key: 'advanced', labelKey: 'profile.level.advanced' },
  { key: 'native', labelKey: 'profile.level.native' },
] as const;

type LearningLang = { language: string; level?: string };

// Helpers for DOB normalization
function extractDateOnly(input?: string | null): string {
  if (!input) return '';
  const m = String(input).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function toDateOrNull(dateOnly: string): Date | null {
  if (!dateOnly) return null;
  // Construct Date from YYYY-MM-DD safely
  const [y, m, d] = dateOnly.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function UserProfileScreen() {
  const { t, i18n } = useTranslation();
  const { colorScheme } = useThemeMode();

  // Profile state
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarIcon, setAvatarIcon] = useState<string>('person');
  const [bio, setBio] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [nativeLanguage, setNativeLanguage] = useState<string>('');
  const [learningLanguages, setLearningLanguages] = useState<LearningLang[]>([]);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editBio, setEditBio] = useState<string>("");
  const [editLocation, setEditLocation] = useState<string>("");
  const [editWebsite, setEditWebsite] = useState<string>("");
  
  const [editNativeLanguage, setEditNativeLanguage] = useState<string>("");
  const [editLearningLanguages, setEditLearningLanguages] = useState<LearningLang[]>([]);

  // Misc state
  const [userId, setUserId] = useState<string | null>(null);
  const [iconPickerVisible, setIconPickerVisible] = useState(false);
  const [selectKey, setSelectKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // DOB picker - single date instead of separate Y/M/D
  const [editDateOfBirth, setEditDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const colors = useMemo(() => ({
    bg: colorScheme === 'dark' ? '#0b0b0d' : '#f3f4f6',
    card: colorScheme === 'dark' ? '#18181b' : '#ffffff',
    text: colorScheme === 'dark' ? '#fafafa' : '#111827',
    sub: colorScheme === 'dark' ? '#d1d5db' : '#6b7280',
    inputBg: colorScheme === 'dark' ? '#111113' : '#f9fafb',
    inputBorder: colorScheme === 'dark' ? '#26262b' : '#e5e7eb',
    inputText: colorScheme === 'dark' ? '#e5e7eb' : '#111827',
    primary: '#6366f1',
    danger: '#ef4444',
    divider: colorScheme === 'dark' ? '#23232a' : '#e5e7eb',
    icon: colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af',
    muted: colorScheme === 'dark' ? '#9ca3af' : '#6b7280',
  }), [colorScheme]);

  // Validation
  const isNameValid = useMemo(() => editName.trim().length >= 2, [editName]);
  const isBioValid = useMemo(() => editBio.length <= 500, [editBio]);
  const isUrlValid = useMemo(() => {
    if (!editWebsite.trim()) return true;
    try { new URL(editWebsite); return true; } catch { return false; }
  }, [editWebsite]);
  const isDobValid = useMemo(() => {
    // editDateOfBirth is either null (not set, valid) or a valid Date object
    return true; // Date picker only allows valid dates
  }, []);
  const areLearningLangsValid = useMemo(() =>
    editLearningLanguages.every(ll => !ll.language || typeof ll.language === 'string') &&
    editLearningLanguages.every(ll => !ll.level || LEVEL_OPTIONS.some(o => o.key === ll.level))
  , [editLearningLanguages]);

  const isFormValid = isNameValid && isBioValid && isUrlValid && isDobValid && areLearningLangsValid;
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cachedEmail, cachedName, cachedIcon] = await Promise.all([
          AsyncStorage.getItem('user_email'),
          AsyncStorage.getItem('user_displayName'),
          AsyncStorage.getItem('user_avatarIcon'),
        ]);

        if (cancelled) {
          return;
        }

        const normalizedEmail = cachedEmail && cachedEmail.trim().length ? cachedEmail : null;
        const normalizedName = cachedName && cachedName.trim().length ? cachedName : null;
        const normalizedIcon = cachedIcon && cachedIcon.trim().length ? cachedIcon : undefined;

        if (normalizedEmail !== null) {
          setEmail(normalizedEmail);
        }
        if (normalizedName !== null) {
          setDisplayName(normalizedName);
          setEditName(normalizedName);
        }
        if (normalizedIcon) {
          setAvatarIcon(normalizedIcon);
        }
      } catch {
        // ignore cache hydration errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch user
  useEffect(() => {
    const fetchUserInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await AsyncStorage.getItem('jwt');
        if (!token) throw new Error('Not authenticated');
        const res = await fetch(`${config.apiUrl}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const rawUser = (data && typeof data === 'object') ? (data.user ?? data.doc ?? data) : null;
        if (!rawUser || typeof rawUser !== 'object') {
          throw new Error('Invalid profile response');
        }

        const u = rawUser as Record<string, any>;
        const nextEmail = typeof u.email === 'string' && u.email.trim().length ? u.email : null;
        const nextDisplayName = typeof u.displayName === 'string' && u.displayName.trim().length
          ? u.displayName
          : null;
        const nextAvatarIcon = typeof u.avatarIcon === 'string' && u.avatarIcon.trim().length
          ? u.avatarIcon
          : 'person';

        setEmail(nextEmail);
        setDisplayName(nextDisplayName);
        setAvatarIcon(nextAvatarIcon);
        setBio(typeof u.bio === 'string' ? u.bio : '');
        setLocation(typeof u.location === 'string' ? u.location : '');
        setWebsite(typeof u.website === 'string' ? u.website : '');

        const dobOnly = extractDateOnly(u.dateOfBirth);
        setDateOfBirth(dobOnly);

        const nativeLang = typeof u.nativeLanguage === 'string' ? u.nativeLanguage : '';
        const learningLangs = Array.isArray(u.learningLanguages) ? u.learningLanguages : [];
        setNativeLanguage(nativeLang);
        setLearningLanguages(learningLangs);

        setEditName(nextDisplayName ?? '');
        setEditBio(typeof u.bio === 'string' ? u.bio : '');
        setEditLocation(typeof u.location === 'string' ? u.location : '');
        setEditWebsite(typeof u.website === 'string' ? u.website : '');

        setEditDateOfBirth(toDateOrNull(dobOnly));
        setEditNativeLanguage(nativeLang);
        setEditLearningLanguages(learningLangs);
        setUserId((typeof u.id === 'string' && u.id) || (typeof u._id === 'string' && u._id) || null);

        if (nextEmail !== null) {
          await AsyncStorage.setItem('user_email', nextEmail);
        } else {
          await AsyncStorage.removeItem('user_email');
        }

        if (nextDisplayName !== null) {
          await AsyncStorage.setItem('user_displayName', nextDisplayName);
        } else {
          await AsyncStorage.removeItem('user_displayName');
        }

        await AsyncStorage.setItem('user_avatarIcon', nextAvatarIcon || 'person');
      } catch (err: any) {
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  // Helpers
  const startEdit = () => {
    setFieldErrors({});
    setIsEditing(true);
  };
  const cancelEdit = () => {
    setEditName(displayName || '');
    setEditBio(bio || '');
    setEditLocation(location || '');
    setEditWebsite(website || '');
    
    // Restore DOB from stored string
    setEditDateOfBirth(toDateOrNull(extractDateOnly(dateOfBirth)));
    setEditNativeLanguage(nativeLanguage || '');
    setEditLearningLanguages(learningLanguages || []);
    setFieldErrors({});
    setIsEditing(false);
  };

  const saveProfile = async () => {
    // Build field error map
    const errs: Record<string, string> = {};
    if (!isNameValid) errs.displayName = t('profile.nameRequired');
    if (!isBioValid) errs.bio = t('profile.bioTooLong');
    if (!isUrlValid) errs.website = t('profile.invalidUrl');
  if (!isDobValid) errs.dateOfBirth = 'Invalid date';
    // Validate learning languages minimal
    editLearningLanguages.forEach((ll, idx) => {
      if (ll.language && ll.level && !LEVEL_OPTIONS.some(o => o.key === ll.level)) {
        errs[`learningLanguages.${idx}.level`] = 'Invalid level';
      }
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('jwt');
      if (!token) throw new Error('Not authenticated');
      if (!userId) throw new Error('User ID not found');
      // Convert Date object to YYYY-MM-DD string
      const dateString = editDateOfBirth ? 
        `${editDateOfBirth.getFullYear()}-${String(editDateOfBirth.getMonth() + 1).padStart(2, '0')}-${String(editDateOfBirth.getDate()).padStart(2, '0')}` 
        : null;
      const payload: Record<string, any> = {
        displayName: editName,
        bio: editBio || null,
        location: editLocation || null,
        website: editWebsite || null,
        dateOfBirth: dateString,
        nativeLanguage: editNativeLanguage || null,
        learningLanguages: editLearningLanguages.length ? editLearningLanguages : null,
      };
      const res = await fetch(`${config.apiUrl}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
      const u = data.doc || {};
      setDisplayName(u.displayName ?? editName);
      setBio(u.bio ?? editBio ?? '');
      setLocation(u.location ?? editLocation ?? '');
      setWebsite(u.website ?? editWebsite ?? '');
      // Normalize server DOB to date-only string; fall back to what we sent
      const serverDob = (u.dateOfBirth ?? dateString ?? '') as string;
      const normalizedDob = extractDateOnly(serverDob);
      setDateOfBirth(normalizedDob);
      setEditDateOfBirth(toDateOrNull(normalizedDob));
      setNativeLanguage(u.nativeLanguage ?? editNativeLanguage ?? '');
      setLearningLanguages(u.learningLanguages ?? editLearningLanguages ?? []);
      await AsyncStorage.setItem('user_displayName', u.displayName ?? editName);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Learning languages ops
  const addLearningLang = () => setEditLearningLanguages([...editLearningLanguages, { language: '', level: 'beginner' }]);
  const removeLearningLang = (index: number) => setEditLearningLanguages(editLearningLanguages.filter((_, i) => i !== index));
  const updateLearningLang = (index: number, patch: Partial<LearningLang>) => setEditLearningLanguages(editLearningLanguages.map((ll, i) => i === index ? { ...ll, ...patch } : ll));

  if (loading && !displayName) {
    return (
      <>
        <ThemedHeader titleKey="profile.title" />
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <ThemedHeader
        titleKey="profile.title"
        headerRight={isEditing ? () => (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Pressable onPress={cancelEdit} disabled={saving} style={{ paddingVertical: 6, paddingHorizontal: 8, opacity: saving ? 0.6 : 1 }}>
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>{t('profile.cancel')}</Text>
            </Pressable>
            <Pressable onPress={saveProfile} disabled={saving || !isFormValid} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: (!saving && isFormValid) ? colors.primary : colors.inputBorder, borderRadius: 8 }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{t('profile.save')}</Text>
              )}
            </Pressable>
          </View>
        ) : undefined}
      />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            {/* Summary Card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 }}) }}>
              {/* Row: Avatar + Basic Info */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Pressable onPress={() => setIconPickerVisible(true)} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }}>
                  <MaterialIcons name={avatarIcon as any} size={40} color={colors.primary} />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {t('profile.displayName')} *
                  </Text>
                  {isEditing ? (
                    <TextInput value={editName} onChangeText={setEditName} placeholder={t('profile.displayName')} placeholderTextColor={colors.text + '60'} autoCapitalize="words" autoFocus={false} style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: (!isNameValid || fieldErrors.displayName) ? colors.danger : colors.inputBorder, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }} />
                  ) : (
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{displayName || t('profile.notSet')}</Text>
                  )}
                  {isEditing && fieldErrors.displayName ? (
                    <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{fieldErrors.displayName}</Text>
                  ) : null}

                  <Text style={{ marginTop: 12, fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.email')}</Text>
                  <Text style={{ fontSize: 16, color: colors.text, opacity: 0.85 }}>{email || t('profile.notSet')}</Text>
                </View>

                {!isEditing && (
                  <Pressable onPress={startEdit} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.primary + '10', borderRadius: 8 }}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('profile.editProfile')}</Text>
                  </Pressable>
                )}
              </View>

              {/* Change avatar */}
              <Pressable onPress={() => setIconPickerVisible(true)} style={{ alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.inputBg, borderRadius: 16, borderWidth: 1, borderColor: colors.inputBorder }}>
                <MaterialIcons name="edit" size={14} color={colors.icon} />
                <Text style={{ marginLeft: 6, color: colors.sub, fontSize: 12, fontWeight: '500' }}>{t('profile.changeAvatar')}</Text>
              </Pressable>
            </View>

            {/* About Card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 16, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 }}) }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>{t('settings.about')}</Text>

              {/* Bio */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.bio')}</Text>
              {isEditing ? (
                <>
                  <TextInput value={editBio} onChangeText={setEditBio} placeholder={t('profile.bioPlaceholder')} placeholderTextColor={colors.text + '60'} multiline numberOfLines={4} maxLength={500} autoFocus={false} style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: (!isBioValid || fieldErrors.bio) ? colors.danger : colors.inputBorder, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, minHeight: 100, textAlignVertical: 'top' }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    {fieldErrors.bio ? (<Text style={{ color: colors.danger, fontSize: 12 }}>{fieldErrors.bio}</Text>) : (<Text />)}
                    <Text style={{ color: colors.sub, fontSize: 12 }}>{editBio.length}/500</Text>
                  </View>
                </>
              ) : (
                <Text style={{ fontSize: 16, color: colors.text, opacity: bio ? 1 : 0.5 }}>{bio || t('profile.notSet')}</Text>
              )}

              {/* Location + Website */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.location')}</Text>
                  {isEditing ? (
                    <TextInput 
                      value={editLocation} 
                      onChangeText={setEditLocation} 
                      placeholder={t('profile.locationPlaceholder')} 
                      placeholderTextColor={colors.text + '60'} 
                      autoFocus={false}
                      style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }} 
                    />
                  ) : (
                    <Text style={{ fontSize: 16, color: colors.text, opacity: location ? 1 : 0.5 }}>{location || t('profile.notSet')}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.website')}</Text>
                  {isEditing ? (
                    <>
                      <TextInput value={editWebsite} onChangeText={setEditWebsite} placeholder={t('profile.websitePlaceholder')} placeholderTextColor={colors.text + '60'} keyboardType="url" autoCapitalize="none" autoFocus={false} style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: (!isUrlValid || fieldErrors.website) ? colors.danger : colors.inputBorder, borderRadius: 12, padding: 14, fontSize: 16, color: colors.text }} />
                      {fieldErrors.website ? (<Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{fieldErrors.website}</Text>) : null}
                    </>
                  ) : (
                    <Text style={{ fontSize: 16, color: website ? colors.primary : colors.text, opacity: website ? 1 : 0.5 }}>{website || t('profile.notSet')}</Text>
                  )}
                </View>
              </View>

              {/* Date of Birth */}
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.dateOfBirth')}</Text>
                {isEditing ? (
                  <View>
                    <Pressable 
                      onPress={() => setShowDatePicker(true)} 
                      style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: fieldErrors.dateOfBirth ? colors.danger : colors.inputBorder, borderRadius: 12, padding: 14 }}
                    >
                      <Text style={{ color: editDateOfBirth ? colors.text : colors.muted }}>
                        {editDateOfBirth 
                          ? editDateOfBirth.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })
                          : t('profile.selectDateOfBirth') || 'Select Date of Birth'
                        }
                      </Text>
                    </Pressable>
                    {fieldErrors.dateOfBirth && (
                      <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{fieldErrors.dateOfBirth}</Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: 16, color: colors.text, opacity: dateOfBirth ? 1 : 0.5 }}>{dateOfBirth || t('profile.notSet')}</Text>
                )}
              </View>
            </View>

            {/* Languages Card */}
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, marginBottom: 24, ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }, android: { elevation: 4 }}) }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12 }}>{t('settings.learningPreferences')}</Text>

              {/* Native Language */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.nativeLanguage')}</Text>
              {isEditing ? (
                <Pressable onPress={() => setSelectKey('native')} style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, padding: 14 }}>
                  <Text style={{ color: editNativeLanguage ? colors.text : colors.muted }}>{editNativeLanguage || t('profile.nativeLanguagePlaceholder')}</Text>
                </Pressable>
              ) : (
                <Text style={{ fontSize: 16, color: colors.text, opacity: nativeLanguage ? 1 : 0.5 }}>{nativeLanguage || t('profile.notSet')}</Text>
              )}

              {/* Learning Languages List */}
              <Text style={{ marginTop: 16, fontSize: 12, fontWeight: '700', color: colors.text, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('profile.learningLanguages')}</Text>

              {isEditing ? (
                <>
                  {editLearningLanguages.map((ll, idx) => (
                    <View key={idx} style={{ marginTop: 12, padding: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>{t('profile.language')}</Text>
                          <Pressable onPress={() => setSelectKey(`ll-lang-${idx}`)} style={{ backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, padding: 12 }}>
                            <Text style={{ color: ll.language ? colors.text : colors.muted }}>{ll.language || t('profile.language')}</Text>
                          </Pressable>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 6 }}>{t('profile.level')}</Text>
                          {/* Simple select: show buttons */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {LEVEL_OPTIONS.map(opt => (
                              <Pressable key={opt.key} onPress={() => updateLearningLang(idx, { level: opt.key })} style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: (ll.level === opt.key) ? colors.primary : colors.inputBorder, backgroundColor: (ll.level === opt.key) ? colors.primary + '20' : 'transparent' }}>
                                <Text style={{ color: (ll.level === opt.key) ? colors.primary : colors.text }}>{t(opt.labelKey)}</Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      </View>
                      <Pressable onPress={() => removeLearningLang(idx)} style={{ alignSelf: 'flex-start', marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#fee' }}>
                        <Text style={{ color: '#c00', fontWeight: '700' }}>{t('profile.removeLanguage')}</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPress={addLearningLang} style={{ marginTop: 12, alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>+ {t('profile.addLanguage')}</Text>
                  </Pressable>
                </>
              ) : (
                <View style={{ marginTop: 8 }}>
                  {learningLanguages?.length ? (
                    learningLanguages.map((ll, idx) => (
                      <Text key={idx} style={{ fontSize: 16, color: colors.text, opacity: 0.9, marginTop: idx ? 6 : 0 }}>
                        • {ll.language}{ll.level ? ` — ${t(`profile.level.${ll.level}` as any)}` : ''}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ fontSize: 16, color: colors.text, opacity: 0.5 }}>{t('profile.notSet')}</Text>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons moved to header when editing */}

            {/* Invalid summary hint */}
            {isEditing && !isFormValid && (
              <View style={{ marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#fff3cd', borderWidth: 1, borderColor: '#ffecb5' }}>
                <Text style={{ color: '#8a6d3b' }}>Please fix the highlighted fields before saving.</Text>
              </View>
            )}

            {/* Global error */}
            {!!error && (
              <View style={{ marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#fee' }}>
                <Text style={{ color: '#c00' }}>{error}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Avatar Icon Picker Modal */}
        <AvatarIconPicker visible={iconPickerVisible} currentIcon={avatarIcon} onSelect={async (iconName) => {
          // Update immediately and save to backend
          setAvatarIcon(iconName);
          try {
            const token = await AsyncStorage.getItem('jwt');
            if (!token) throw new Error('Not authenticated');
            if (!userId) throw new Error('User ID not found');
            await fetch(`${config.apiUrl}/api/users/${userId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Accept: 'application/json' },
              body: JSON.stringify({ avatarIcon: iconName }),
            });
            await AsyncStorage.setItem('user_avatarIcon', iconName);
          } catch {
            // Silent fail; avatar will revert next fetch if backend rejects
          } finally {
            setIconPickerVisible(false);
          }
        }} onClose={() => setIconPickerVisible(false)} />

        {/* Select Modals */}
        <SelectModal
          visible={selectKey === 'native'}
          title="Select Native Language"
          options={LANGUAGE_OPTIONS}
          value={editNativeLanguage}
          onSelect={(val) => setEditNativeLanguage(val)}
          onClose={() => setSelectKey(null)}
        />
        {editLearningLanguages.map((_, idx) => (
          <SelectModal
            key={`ll-${idx}`}
            visible={selectKey === `ll-lang-${idx}`}
            title="Select Language"
            options={LANGUAGE_OPTIONS}
            value={editLearningLanguages[idx]?.language}
            onSelect={(val) => updateLearningLang(idx, { language: val })}
            onClose={() => setSelectKey(null)}
          />
        ))}

        {/* Native Date Picker Modal */}
        {showDatePicker && (
          <Modal transparent animationType="none" onRequestClose={() => setShowDatePicker(false)}>
            <Pressable 
              style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
              onPress={() => setShowDatePicker(false)}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={{ backgroundColor: colors.card, padding: 16, paddingBottom: 40 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.cancel') || 'Cancel'}</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>{t('common.done') || 'Done'}</Text>
                    </Pressable>
                  </View>
                  <View style={{ alignItems: 'center', width: '100%' }}>
                    <DateTimePicker
                      value={editDateOfBirth || new Date()}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setEditDateOfBirth(selectedDate);
                        }
                      }}
                      maximumDate={new Date()}
                      textColor={colors.text}
                      locale={i18n.language}
                      style={{ width: '100%' }}
                    />
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </>
  );
}

// Options data
const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'English', label: 'English' },
  { value: '中文', label: '中文 (Chinese)' },
  { value: '日本語', label: '日本語 (Japanese)' },
  { value: '한국어', label: '한국어 (Korean)' },
  { value: 'Español', label: 'Español (Spanish)' },
  { value: 'Français', label: 'Français (French)' },
  { value: 'Deutsch', label: 'Deutsch (German)' },
  { value: 'Italiano', label: 'Italiano (Italian)' },
  { value: 'Português', label: 'Português (Portuguese)' },
  { value: 'Русский', label: 'Русский (Russian)' },
  { value: 'العربية', label: 'العربية (Arabic)' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Türkçe', label: 'Türkçe (Turkish)' },
  { value: 'Tiếng Việt', label: 'Tiếng Việt (Vietnamese)' },
  { value: 'ไทย', label: 'ไทย (Thai)' },
  { value: 'Other', label: 'Other' },
];
