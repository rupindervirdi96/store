import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

/**
 * expo-notifications throws on import in Expo Go on Android (remote push was
 * removed in SDK 53), so it's only loaded in development/production builds.
 */
export const Notifications: typeof import('expo-notifications') | null =
  Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? null
    : require('expo-notifications');

// While the app is open the board updates live, so show banners quietly.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this tablet for "new order" push notifications (sent by the API
 * to every admin device when an order is paid). Needs a development or
 * production build with an EAS projectId; not available in Expo Go or on web.
 */
export async function registerForOrderAlerts(authToken: string): Promise<string | null> {
  if (!Notifications || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new-orders', {
      name: 'New orders',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400],
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[push] Set expo.extra.eas.projectId in app.json to enable new-order alerts');
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
