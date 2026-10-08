import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { OTP_LENGTH, type VerificationSentResponse } from '@store/shared';
import { Button } from '../components/Button';
import { store } from '../config/store';
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
  // Set once sign-up details are accepted and a code has been emailed.
  const [pending, setPending] = useState<VerificationSentResponse | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        onDone();
      } else {
        setPending(await register(name.trim(), email.trim(), password));
        setSubmitting(false);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  if (pending) {
    return <VerifyEmailForm sent={pending} onSent={setPending} onDone={onDone} onBack={() => setPending(null)} />;
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={ui.h1}>{mode === 'login' ? `Welcome back to ${store.name}` : `Join ${store.name}`}</Text>
        <Text style={[ui.muted, { marginBottom: 8 }]}>{store.tagline}</Text>
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
          placeholder={mode === 'register' ? 'Password (at least 8 characters)' : 'Password'}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
        />
        {error && <Text style={ui.error}>{error}</Text>}
        <Button title={mode === 'login' ? 'Sign in' : 'Continue'} onPress={submit} loading={submitting} />
        {mode === 'register' && (
          <Text style={[ui.muted, { textAlign: 'center' }]}>We'll email you a code to confirm your address.</Text>
        )}
        <Pressable onPress={onSwitch} style={{ alignItems: 'center', padding: 8 }}>
          <Text style={{ color: colors.brand }}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Seconds until `iso`, ticking every second (0 once passed). */
function useSecondsUntil(iso: string): number {
  const [now, setNow] = useState(() => Date.now());
  const target = new Date(iso).getTime();
  useEffect(() => {
    if (target <= Date.now()) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= target) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
}

function VerifyEmailForm({
  sent,
  onSent,
  onDone,
  onBack,
}: {
  sent: VerificationSentResponse;
  onSent: (s: VerificationSentResponse) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const resendCode = useAuth((s) => s.resendCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resendIn = useSecondsUntil(sent.resendAvailableAt);

  async function verify(value: string) {
    setError(null);
    setSubmitting(true);
    try {
      await verifyEmail(sent.email, value);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    try {
      onSent(await resendCode(sent.email));
      setCode('');
      setNotice('A new code is on its way.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={ui.h1}>Check your email</Text>
        <Text style={ui.body}>
          We sent a {OTP_LENGTH}-digit code to <Text style={{ fontWeight: '600' }}>{sent.email}</Text>. It expires in 10
          minutes.
        </Text>
        <TextInput
          style={[ui.input, { fontSize: 26, letterSpacing: 10, textAlign: 'center', fontVariant: ['tabular-nums'] }]}
          value={code}
          onChangeText={(v) => {
            const digits = v.replace(/\D/g, '').slice(0, OTP_LENGTH);
            setCode(digits);
            // Submit as soon as the last digit is typed or pasted.
            if (digits.length === OTP_LENGTH && !submitting) void verify(digits);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
          maxLength={OTP_LENGTH}
          placeholder={'•'.repeat(OTP_LENGTH)}
          accessibilityLabel="Verification code"
        />
        {error && <Text style={ui.error}>{error}</Text>}
        {notice && !error && <Text style={{ color: colors.success }}>{notice}</Text>}
        <Button
          title="Verify and create account"
          onPress={() => verify(code)}
          loading={submitting}
          disabled={code.length !== OTP_LENGTH}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={ui.muted}>Use a different email</Text>
          </Pressable>
          <Pressable onPress={resend} disabled={resendIn > 0} hitSlop={8}>
            <Text style={{ color: resendIn > 0 ? colors.muted : colors.brand, fontWeight: '600' }}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Text>
          </Pressable>
        </View>
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
