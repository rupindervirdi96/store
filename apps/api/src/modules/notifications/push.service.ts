import { UserModel } from '../users/user.model';

interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Android notification channel (created by the apps). */
  channelId?: string;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const isExpoToken = (t: string) => t.startsWith('ExponentPushToken[');

/**
 * Sends push notifications via the Expo Push Service, which relays to FCM
 * (Android) and APNs (iOS) using the credentials configured in your EAS
 * project. To talk to FCM directly instead, swap this implementation for
 * firebase-admin's `messaging().sendEachForMulticast()` and store native FCM tokens.
 */
async function sendToUsers(users: { _id: unknown; pushTokens?: string[] }[], msg: PushMessage): Promise<void> {
  const targets = users.flatMap((u) => (u.pushTokens ?? []).filter(isExpoToken).map((token) => ({ userId: u._id, token })));
  if (targets.length === 0) return;

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      targets.map(({ token }) => ({
        to: token,
        sound: 'default',
        priority: 'high',
        title: msg.title,
        body: msg.body,
        data: msg.data,
        ...(msg.channelId && { channelId: msg.channelId }),
      })),
    ),
  });

  if (!res.ok) {
    console.warn(`[push] Expo push failed: ${res.status} ${await res.text()}`);
    return;
  }

  // Prune tokens for uninstalled apps so we stop sending to them.
  const { data } = (await res.json()) as { data: { status: 'ok' | 'error'; details?: { error?: string } }[] };
  const dead = targets.filter((_, i) => data[i]?.details?.error === 'DeviceNotRegistered');
  for (const { userId, token } of dead) {
    await UserModel.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
  }
}

/** Every registered device of one user (e.g. a customer's order updates). */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<void> {
  try {
    const user = await UserModel.findById(userId).select('+pushTokens').lean();
    if (user) await sendToUsers([user], msg);
  } catch (err) {
    console.warn('[push] error sending notification', err);
  }
}

/** Every device signed in to the restaurant admin app (e.g. new paid orders). */
export async function sendPushToAdmins(msg: PushMessage): Promise<void> {
  try {
    const admins = await UserModel.find({ role: 'admin', 'pushTokens.0': { $exists: true } })
      .select('+pushTokens')
      .lean();
    await sendToUsers(admins, msg);
  } catch (err) {
    console.warn('[push] error sending admin notification', err);
  }
}
