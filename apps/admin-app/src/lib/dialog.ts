import { Alert, Platform } from 'react-native';

/** Yes/no question that works on devices and in a browser preview. */
export function confirm(title: string, message: string, confirmLabel = 'OK', destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Pick one of several actions (an action sheet on devices). */
export function choose(title: string, options: { label: string; value: string }[]): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(options[options.length - 1]?.value ?? null);
  return new Promise((resolve) =>
    Alert.alert(title, undefined, [
      ...options.map((o) => ({ text: o.label, onPress: () => resolve(o.value) })),
      { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
    ]),
  );
}
