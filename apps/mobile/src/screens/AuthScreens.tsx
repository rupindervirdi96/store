import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { Button } from '../components/Button';
import { ApiError } from '../lib/api';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { colors, ui } from '../theme';

function AuthForm({ mode, onDone, onSwitch }: { mode: 'login' | 'register'; onDone: () => void; onSwitch: () => void }) {
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        {mode === 'register' && (
          <TextInput style={ui.input} placeholder="Name" value={name} onChangeText={setName} autoComplete="name" />
        )}
        <TextInput
          style={ui.input}
          placeholder="Email"
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
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
        />
        {error && <Text style={ui.error}>{error}</Text>}
        <Button title={mode === 'login' ? 'Sign in' : 'Create account'} onPress={submit} loading={submitting} />
        <Pressable onPress={onSwitch} style={{ alignItems: 'center', padding: 8 }}>
          <Text style={{ color: colors.brand }}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  return <AuthForm mode="login" onDone={() => navigation.goBack()} onSwitch={() => navigation.replace('Register')} />;
}

export function RegisterScreen({ navigation }: RootScreenProps<'Register'>) {
  return <AuthForm mode="register" onDone={() => navigation.goBack()} onSwitch={() => navigation.replace('Login')} />;
}
