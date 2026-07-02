/**
 * /auth — 로그인 ↔ 회원가입 토글 풀스크린. 마이페이지/AuthGate에서 진입.
 *
 * 가입은 step으로 진행: 'form'(이메일+비번) → 'verify'(본인인증 목업) → 계정 생성.
 * 인증 후 프로필 미완성이면 /profile-setup으로 replace(설계: 단일 프로필 게이트).
 * 시스템 다이얼로그 X — 검증/서버 에러는 인라인 메시지.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/primitives';
import { ScreenHeader } from '@/components/domain/screen-header';
import { VerifyIdentityMock } from '@/components/domain/verify-identity-mock';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type Mode = 'login' | 'signup';
type Step = 'form' | 'verify';

export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '올바른 이메일 형식이 아니에요.';
    if (password.length < 8) return '비밀번호는 8자 이상이에요.';
    return null;
  }

  // 폼 제출: 로그인이면 바로 로그인, 가입이면 본인인증 step으로.
  async function handleFormSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    if (isSignup) {
      setStep('verify');
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      if (completed) router.back();
      else router.replace('/profile-setup');
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  // 본인인증 완료 → 계정 생성 → 프로필 화면.
  async function handleVerified() {
    setError(null);
    setSubmitting(true);
    try {
      await signup(email.trim(), password);
      router.replace('/profile-setup');
    } catch (e) {
      setError(mapAuthError(e));
      setStep('form'); // 가입 실패 시 폼으로 되돌려 에러 노출
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setStep('form');
    setError(null);
  }

  function handleBack() {
    if (step === 'verify') {
      setStep('form');
      setError(null);
      return;
    }
    router.back();
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader
          title={isSignup ? '회원가입' : '로그인'}
          onBack={handleBack}
        />

        {step === 'verify' ? (
          <VerifyIdentityMock onComplete={handleVerified} submitting={submitting} />
        ) : (
          <View style={styles.body}>
            <ThemedText variant="h1" style={{ marginBottom: theme.spacing.s8 }}>
              {isSignup ? '나만의 정의를\n저장해 보세요' : '다시 만나서\n반가워요'}
            </ThemedText>

            <TextField
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{ marginBottom: theme.spacing.s3 }}
            />
            <TextField
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호 (8자 이상)"
              autoCapitalize="none"
              secureTextEntry
              style={{ marginBottom: theme.spacing.s2 }}
            />

            {error ? (
              <ThemedText
                variant="sm"
                style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s1 }}
              >
                {error}
              </ThemedText>
            ) : null}

            <Button
              label={submitting ? '잠시만요…' : isSignup ? '다음' : '로그인'}
              onPress={handleFormSubmit}
              disabled={submitting}
              fullWidth
              style={{ marginTop: theme.spacing.s5 }}
            />

            <Pressable onPress={toggleMode} style={styles.toggle} hitSlop={8}>
              <ThemedText variant="sm" tone="secondary">
                {isSignup ? '이미 계정이 있으세요? ' : '계정이 없으세요? '}
                <ThemedText variant="sm" style={{ color: theme.colors.point.p600 }}>
                  {isSignup ? '로그인' : '가입하기'}
                </ThemedText>
              </ThemedText>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** 서버/네트워크 에러 → 우리 톤 인라인 문구. */
function mapAuthError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.status === 409) return '이미 가입된 이메일이에요.';
  if (err?.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (err?.message) return err.message;
  return '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  toggle: {
    alignSelf: 'center',
    marginTop: 24,
  },
});
