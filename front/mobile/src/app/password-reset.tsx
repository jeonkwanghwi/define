/**
 * /password-reset — 이메일 인증번호로 비밀번호를 다시 설정한다. 로그인 폼에서 진입.
 *
 * 3단계: 'email'(주소 입력 → 인증번호 발송) → 'code'(6자리 입력) → 'password'(새 비밀번호).
 * 성공하면 서버가 토큰을 주므로 **그 자리에서 로그인된다** — 재설정하고 또 로그인시키면 마찰만 는다.
 *
 * 비동기 3종을 미리 정해 둔다(코드보다 먼저):
 *   진행 중 → submitting(단계별 버튼 스피너) · resending(EmailCodeForm "보내는 중…")
 *   실패    → error. 세 단계 **모두** 그리는 자리가 있다:
 *             email/password는 아래 인라인 문구, code는 EmailCodeForm이 입력칸 아래에 그린다.
 *   성공    → email/code는 다음 단계로, password는 router.replace로 홈(또는 /profile-setup).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { EmailCodeForm } from '@/components/domain/email-code-form';
import { ScreenHeader } from '@/components/domain/screen-header';
import { Button, FadeIn, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { ApiError } from '@/services/api-client';
import { requestEmailCode } from '@/services/auth-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type Step = 'email' | 'code' | 'password';

export default function PasswordResetScreen() {
  const theme = useTheme();
  const router = useRouter();
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 재전송 발송 중. submitting과 섞으면 확인 버튼이 멋대로 스피너가 된다.
  const [resending, setResending] = useState(false);
  // 인증번호를 마지막으로 보낸 시각 — EmailCodeForm의 60초 카운트다운을 재시작시키는 신호.
  const [cooldownFrom, setCooldownFrom] = useState(0);

  /** 1단계: 인증번호 발송. 발송이 성공해야 단계를 넘긴다(먼저 넘어가면 실패를 보여줄 자리가 없다). */
  async function handleSendCode() {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setError('올바른 이메일 형식이 아니에요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await requestEmailCode(addr, 'reset');
      // 계정이 없어도 서버는 204를 준다 — 존재 여부를 숨기려는 의도된 설계다.
      // 그래서 "가입된 적 없는 이메일이에요"를 띄울 수 없다(띄우면 남의 가입 여부가 새어 나간다).
      // 주소를 잘못 넣었다면 번호가 오지 않아 마지막 단계의 400으로 드러난다.
      setCooldownFrom(Date.now());
      setStep('code');
    } catch (e) {
      setError(mapResetError(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** 인증번호 재전송. 성공하면 cooldownFrom을 갱신해 카운트다운을 60초로 되돌린다. */
  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      await requestEmailCode(email.trim(), 'reset');
      setCooldownFrom(Date.now());
    } catch (e) {
      setError(mapResetError(e)); // 429 '잠시 후에 다시 시도해 주세요.'도 그대로 보여준다
    } finally {
      setResending(false);
    }
  }

  /**
   * 2단계: 받은 번호를 들고 다음으로. **여기서는 서버에 보내지 않는다** —
   * 검증을 마지막 한 번(재설정)에 모아, 코드 확인과 비밀번호 저장이 같이 성공/실패하게 한다.
   */
  function handleCodeSubmit(next: string) {
    setCode(next);
    setError(null);
    setStep('password');
  }

  /** 3단계: 새 비밀번호 저장 → 바로 로그인 상태로 홈(프로필 미완성이면 /profile-setup). */
  async function handleSubmitPassword() {
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이에요.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 서로 달라요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(email.trim(), code, password);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      router.replace(completed ? '/' : '/profile-setup');
    } catch (e) {
      const err = e as Partial<ApiError>;
      // 400 = 인증번호 불일치/만료. 번호를 고칠 자리는 code 단계뿐이라 거기로 되돌리고
      // 에러도 거기에 그린다(여기 남겨두면 "틀렸다"만 보이고 고칠 입력칸이 없다).
      if (err?.status === 400) {
        setStep('code');
        setError(err.message ?? '인증번호가 올바르지 않아요.');
        return;
      }
      setError(mapResetError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    setError(null);
    if (step === 'password') {
      setStep('code');
      return;
    }
    if (step === 'code') {
      setStep('email');
      return;
    }
    // 딥링크·웹 새로고침으로 바로 들어오면 돌아갈 히스토리가 없다 → 로그인 화면으로 대체.
    if (router.canGoBack()) router.back();
    else router.replace('/auth');
  }

  // 세 단계가 공유하는 에러 자리. 단계 밖으로 빼면 "그리는 JSX를 깜빡하는" 사고가 안 난다.
  const errorText = error ? (
    <FadeIn>
      <ThemedText
        variant="sm"
        style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s3 }}
      >
        {error}
      </ThemedText>
    </FadeIn>
  ) : null;

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader title="비밀번호 재설정" onBack={handleBack} />

        {step === 'code' ? (
          // 가입 흐름과 같은 화면을 그대로 쓴다(코드 규칙이 같아서 따로 만들 이유가 없다).
          // 코드 확인을 마지막 단계로 모았으므로 여기서는 submitting이 늘 false다.
          <EmailCodeForm
            email={email.trim()}
            onSubmit={handleCodeSubmit}
            onResend={handleResend}
            resending={resending}
            error={error}
            cooldownFrom={cooldownFrom}
          />
        ) : (
          // key={step} — 단계가 바뀔 때마다 FadeIn이 다시 재생된다(툭 바뀌지 않도록).
          <View style={styles.body}>
            <FadeIn key={step} style={{ marginTop: theme.spacing.s8 }}>
              {step === 'email' ? (
                <>
                  <ThemedText variant="h1">{'비밀번호를\n다시 설정해요'}</ThemedText>
                  <ThemedText
                    variant="body"
                    tone="secondary"
                    style={{ marginTop: theme.spacing.s3 }}
                  >
                    가입할 때 쓴 이메일로 인증번호를 보내드려요.
                  </ThemedText>

                  <TextField
                    value={email}
                    onChangeText={setEmail}
                    placeholder="이메일"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    autoFocus
                    style={{ marginTop: theme.spacing.s6 }}
                  />
                  {errorText}

                  <Button
                    label="인증번호 받기"
                    onPress={handleSendCode}
                    loading={submitting}
                    fullWidth
                    style={{ marginTop: theme.spacing.s5 }}
                  />
                </>
              ) : (
                <>
                  <ThemedText variant="h1">{'새 비밀번호를\n정해 주세요'}</ThemedText>
                  <ThemedText
                    variant="body"
                    tone="secondary"
                    style={{ marginTop: theme.spacing.s3 }}
                  >
                    저장하면 바로 로그인돼요.
                  </ThemedText>

                  <TextField
                    value={password}
                    // 공백은 입력 즉시 제거 — 자동완성이 몰래 붙이는 공백 때문에
                    // "재설정은 됐는데 로그인이 안 되는" 사고를 원천 차단.
                    onChangeText={(t) => setPassword(t.replace(/\s/g, ''))}
                    placeholder="새 비밀번호 (8자 이상)"
                    autoCapitalize="none"
                    secureTextEntry
                    autoFocus
                    style={{ marginTop: theme.spacing.s6 }}
                  />
                  <TextField
                    value={passwordConfirm}
                    onChangeText={(t) => setPasswordConfirm(t.replace(/\s/g, ''))}
                    placeholder="새 비밀번호 확인"
                    autoCapitalize="none"
                    secureTextEntry
                    style={{ marginTop: theme.spacing.s3 }}
                  />
                  {errorText}

                  <Button
                    label="비밀번호 바꾸기"
                    onPress={handleSubmitPassword}
                    loading={submitting}
                    fullWidth
                    style={{ marginTop: theme.spacing.s5 }}
                  />
                </>
              )}
            </FadeIn>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/**
 * 서버/네트워크 에러 → 화면 문구.
 * 서버가 이미 사용자용 한국어 문장을 준다(400 '인증번호가 올바르지 않아요.', 429 '잠시 후에…')
 * → 그대로 쓰고, 메시지가 없을 때(네트워크 단절)만 우리 문구로 대체한다.
 */
function mapResetError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.message) return err.message;
  return '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
});
