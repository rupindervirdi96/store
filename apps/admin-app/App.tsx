import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerForOrderAlerts } from './src/lib/notifications';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuth } from './src/store/auth';
import { colors } from './src/theme';

export default function App() {
  const hydrated = useAuth((s) => s.hydrated);
  const token = useAuth((s) => s.token);

  // Register this device for "new order" alerts whenever staff are signed in.
  useEffect(() => {
    if (token) void registerForOrderAlerts(token);
  }, [token]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
