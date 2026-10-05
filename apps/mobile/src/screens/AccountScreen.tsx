import { Text, View } from 'react-native';
import { Button } from '../components/Button';
import type { TabScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { ui } from '../theme';

export function AccountScreen({ navigation }: TabScreenProps<'Account'>) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  if (!user) {
    return (
      <View style={[ui.screen, { padding: 24, gap: 12, justifyContent: 'center' }]}>
        <Text style={[ui.h1, { textAlign: 'center' }]}>Welcome</Text>
        <Text style={[ui.muted, { textAlign: 'center', marginBottom: 12 }]}>
          Sign in to check out and track your orders live.
        </Text>
        <Button title="Sign in" onPress={() => navigation.navigate('Login')} />
        <Button title="Create account" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </View>
    );
  }

  return (
    <View style={[ui.screen, { padding: 16, gap: 16 }]}>
      <View style={[ui.card, { gap: 4 }]}>
        <Text style={ui.h2}>{user.name}</Text>
        <Text style={ui.muted}>{user.email}</Text>
      </View>
      <Button title="Sign out" variant="danger" onPress={logout} />
    </View>
  );
}
