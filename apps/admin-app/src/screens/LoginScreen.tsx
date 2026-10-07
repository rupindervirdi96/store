import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button } from '../components/ui';
import { ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { colors, ui } from '../theme';

export function LoginScreen() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[ui.screen, { backgroundColor: colors.ink }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 30 }}>🔥</Text>
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>Ember & Bun Kitchen</Text>
            <Text style={{ color: '#a8a29e', fontSize: 15 }}>Orders, menu and stock for your restaurant</Text>
          </View>

          <View style={[ui.card, { gap: 12, padding: 20 }]}>
            <TextInput
              style={ui.input}
              placeholder="Admin email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <TextInput
              style={ui.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              onSubmitEditing={submit}
            />
            {error && <Text style={ui.error}>{error}</Text>}
            <Button title="Sign in" size="lg" onPress={submit} loading={busy} disabled={!email || !password} />
          </View>
          <Text style={{ color: '#78716c', textAlign: 'center', fontSize: 12 }}>For restaurant staff only. Customers use the Ember & Bun app.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
