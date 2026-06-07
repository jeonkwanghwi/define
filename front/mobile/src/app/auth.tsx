/**
 * /auth — 로그인 ↔ 회원가입 토글 풀스크린. 마이페이지 또는 가입 유도 게이트(AuthGate)에서 진입.
 *
 * (tabs) 밖의 루트 Stack 화면(mypage와 동일하게 자동 라우팅 + 자체 back 헤더).
 * 성공 시 router.back()으로 진입한 화면(마이페이지·게이트 탭)에 로그인 상태가 반영된다.
 * 시스템 다이얼로그 X — 검증/서버 에러는 인라인 메시지(우리 톤).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<Mode>('login');
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

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.back();
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError(null);
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* ─── 헤더 ─── */}
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
            <Icon name="back" size={22} color={theme.colors.ink.strong} />
          </Pressable>
          <ThemedText variant="h3" style={{ flex: 1, textAlign: 'center' }}>
            {isSignup ? '회원가입' : '로그인'}
          </ThemedText>
          <View style={styles.iconBtn} />
        </View>

        {/* ─── 본문 ─── */}
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
            label={submitting ? '잠시만요…' : isSignup ? '가입하기' : '로그인'}
            onPress={handleSubmit}
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
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** 서버/네트워크 에러 → 우리 톤 인라인 문구(이번엔 합리적 기본값, 카피는 후속). */
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
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
