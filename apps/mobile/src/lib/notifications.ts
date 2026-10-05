import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './api';

// Show banners even when the app is foregrounded (the socket also updates UI).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission, obtains an Expo push token (backed by FCM on Android and
 * APNs on iOS) and registers it with the API so order updates can be pushed.
 *
 * Requires a development/production build — remote push isn't available in
 * Expo Go — plus an EAS projectId and FCM credentials uploaded to EAS.
 */
export async function registerForPushNotifications(authToken: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Order updates',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[push] Set expo.extra.eas.projectId in app.json to enable push notifications');
    return null;
  }

  try {
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/users/me/push-tokens', { method: 'POST', body: { token: pushToken }, token: authToken });
    return pushToken;
  } catch (err) {
    console.warn('[push] registration failed', err);
    return null;
  }
}

export async function unregisterPushToken(authToken: string, pushToken: string) {
  await api('/users/me/push-tokens', { method: 'DELETE', body: { token: pushToken }, token: authToken }).catch(
    () => undefined,
  );
}
