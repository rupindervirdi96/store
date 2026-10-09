import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Linking, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { StoreStatusCard, useAdminStoreInfo } from '../components/StoreStatusCard';
import { Button, Section } from '../components/ui';
import { API_URL, WEB_URL } from '../lib/api';
import { confirm } from '../lib/dialog';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { colors, ui, useLayout } from '../theme';

function Row({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[ui.row, { gap: 12, justifyContent: 'space-between' }]}>
      <View style={{ flex: 1 }}>
        <Text style={[ui.body, { fontWeight: '600' }]}>{label}</Text>
        <Text style={ui.muted}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.success, false: '#d6d3d1' }} />
    </View>
  );
}

export function SettingsScreen() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const settings = useSettings();
  const { pad } = useLayout();
  const navigation = useNavigation();
  const [storeInfo, setStoreInfo] = useAdminStoreInfo();

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: pad, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
      <StoreStatusCard
        info={storeInfo}
        onChange={setStoreInfo}
        right={<Button title="Edit hours" variant="secondary" size="sm" onPress={() => navigation.navigate('Hours')} />}
      />

      <Section title="Signed in">
        <Text style={[ui.body, { fontWeight: '700' }]}>{user?.name}</Text>
        <Text style={ui.muted}>{user?.email}</Text>
      </Section>

      <Section title="This device">
        {Platform.OS !== 'web' && (
          <Row
            label="Keep screen on"
            hint="Stops the tablet sleeping while the orders board is open."
            value={settings.keepAwake}
            onChange={(v) => settings.set({ keepAwake: v })}
          />
        )}
        <Row
          label="Vibrate on new orders"
          hint="Vibrates when a new paid order arrives while the app is open."
          value={settings.vibrateOnNewOrder}
          onChange={(v) => settings.set({ vibrateOnNewOrder: v })}
        />
        <Text style={ui.muted}>
          When the app is in the background, new orders arrive as notifications (requires an installed build with notifications allowed).
        </Text>
      </Section>

      <Section title="Store">
        <Button title="Open the website" variant="secondary" onPress={() => Linking.openURL(WEB_URL)} />
        <Text style={ui.muted}>Server: {API_URL}</Text>
        <Text style={ui.muted}>App version {Constants.expoConfig?.version ?? '—'}</Text>
      </Section>

      <Button
        title="Sign out"
        variant="danger"
        onPress={async () => {
          if (await confirm('Sign out?', 'New order alerts stop on this device until someone signs in again.', 'Sign out', true)) logout();
        }}
      />
    </ScrollView>
  );
}
