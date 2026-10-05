import { UserModel } from '../users/user.model';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Sends a push notification to every registered device of a user.
 *
 * Uses the Expo Push Service, which relays to FCM (Android) and APNs (iOS)
 * using the credentials configured in your EAS project. To talk to FCM
 * directly instead, swap this implementation for firebase-admin's
 * `messaging().sendEachForMulticast()` and store native FCM tokens.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const user = await UserModel.findById(userId).select('+pushTokens').lean();
    const tokens = (user?.pushTokens ?? []).filter((t) => t.startsWith('ExponentPushToken['));
    if (tokens.length === 0) return;

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({ to, sound: 'default', title: msg.title, body: msg.body, data: msg.data })),
      ),
    });

    if (!res.ok) {
      console.warn(`[push] Expo push failed: ${res.status} ${await res.text()}`);
      return;
    }

    // Prune tokens for uninstalled apps so we stop sending to them.
    const { data } = (await res.json()) as {
      data: { status: 'ok' | 'error'; details?: { error?: string } }[];
    };
    const dead = tokens.filter((_, i) => data[i]?.details?.error === 'DeviceNotRegistered');
    if (dead.length) await UserModel.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: dead } } });
  } catch (err) {
    console.warn('[push] error sending notification', err);
  }
}
