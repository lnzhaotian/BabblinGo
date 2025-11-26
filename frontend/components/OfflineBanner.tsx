import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeMode } from '../app/theme-context';
import { EVENT_APP_OFFLINE_MODE } from '../lib/payload';

export const OfflineBanner = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();
  const [isNetOffline, setIsNetOffline] = useState(false);
  const [isAppOffline, setIsAppOffline] = useState(false);
  const [heightAnim] = useState(new Animated.Value(0));

  const isOffline = isNetOffline || isAppOffline;

  useEffect(() => {
    const unsubscribeNet = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false || (state.isConnected === true && state.isInternetReachable === false);
      setIsNetOffline(offline);
    });

    const subscriptionApp = DeviceEventEmitter.addListener(EVENT_APP_OFFLINE_MODE, (offline: boolean) => {
      setIsAppOffline(offline);
    });

    return () => {
      unsubscribeNet();
      subscriptionApp.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(heightAnim, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, heightAnim]);

  const backgroundColor = colorScheme === 'dark' ? '#b91c1c' : '#ef4444';
  const textColor = '#ffffff';

  return (
    <Animated.View
      pointerEvents={isOffline ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          backgroundColor,
          top: insets.top + 8,
          opacity: heightAnim,
          transform: [
            {
              translateY: heightAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <MaterialIcons name="cloud-off" size={14} color={textColor} style={styles.icon} />
        <Text style={[styles.text, { color: textColor }]}>
          {t('common.offlineMode')}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
