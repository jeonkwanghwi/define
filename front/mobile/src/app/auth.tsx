/**
 * /auth — 로그인 ↔ 회원가입 토글 풀스크린. 마이페이지/AuthGate에서 진입.
 *
 * 가입은 step으로 진행: 'form'(이메일+비번) → 'verify'(본인인증 목업) → 계정 생성.
 * 인증 후 프로필 미완성이면 /profile-setup으로 replace(설계: 단일 프로필 게이트).
 * 시스템 다이얼로그 X — 검증/서버 에러는 인라인 메시지.
 */
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button, PressableScale, TextField } from '@/components/primitives';
import { EmailDomainDropdown } from '@/components/domain/email-domain-dropdown';
import { ScreenHeader } from '@/components/domain/screen-header';
import { VerifyIdentityMock } from '@/components/domain/verify-identity-mock';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { motion, useTheme } from '@/theme';

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
  // 가입 전용 — 아이디/도메인 분리 입력(오타 방지). 로그인은 위 email 단일 칸 사용.
  const [emailLocal, setEmailLocal] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [domainOpen, setDomainOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';
  // 가입=아이디@도메인 조합, 로그인=단일 이메일 칸(자동완성 유지).
  const effectiveEmail = isSignup ? `${emailLocal.trim()}@${emailDomain.trim()}` : email.trim();

  // 모드 전환 시 폼이 진행 방향(로그인=왼쪽, 회원가입=오른쪽)으로 슬라이드+페이드 →
  // "다른 화면으로 넘어왔다"는 느낌을 준다. 상단 세그먼트가 현재 모드를 항상 명시.
  const [dir, setDir] = useState(0);
  const swap = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    swap.setValue(0);
    Animated.timing(swap, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [mode, swap]);

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) return '올바른 이메일 형식이 아니에요.';
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
      await login(effectiveEmail, password);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      // 로그인 성공 후에는 어디서 들어왔든(마이페이지 등) 기록 탭(홈)으로 —
      // back()으로 이전 화면 복귀시키면 진입점마다 도착지가 달라져 혼란.
      if (completed) router.replace('/');
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
      await signup(effectiveEmail, password);
      router.replace('/profile-setup');
    } catch (e) {
      setError(mapAuthError(e));
      setStep('form'); // 가입 실패 시 폼으로 되돌려 에러 노출
    } finally {
      setSubmitting(false);
    }
  }

  function selectMode(next: Mode) {
    if (next === mode) return;
    setDir(next === 'signup' ? 1 : -1);
    setMode(next);
    setStep('form');
    setError(null);
  }

  function handleBack() {
    if (step === 'verify') {
      setStep('form');
      setError(null);
      return;
    }
    // 딥링크로 /auth에 바로 들어오면 히스토리가 없어 back이 경고를 낸다 → 홈으로 대체.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScreenHeader
          title={step === 'verify' ? '회원가입' : ''}
          onBack={handleBack}
        />

        {step === 'verify' ? (
          <VerifyIdentityMock onComplete={handleVerified} submitting={submitting} />
        ) : (
          <View style={styles.body}>
            <AuthModeToggle mode={mode} onChange={selectMode} />

            <Animated.View
              style={{
                marginTop: theme.spacing.s8,
                opacity: swap,
                transform: [
                  { translateX: swap.interpolate({ inputRange: [0, 1], outputRange: [dir * 28, 0] }) },
                ],
              }}
            >
              <ThemedText variant="h1" style={{ marginBottom: theme.spacing.s8 }}>
                {isSignup ? '나만의 정의를\n저장해 보세요' : '다시 만나서\n반가워요'}
              </ThemedText>

              {isSignup ? (
                // 도메인 드롭다운이 아래 필드 위로 겹쳐 내려오도록 relative + zIndex.
                <View style={{ marginBottom: theme.spacing.s3, position: 'relative', zIndex: 20 }}>
                  <View style={styles.emailRow}>
                    <TextField
                      value={emailLocal}
                      onChangeText={setEmailLocal}
                      onFocus={() => setDomainOpen(false)}
                      placeholder="아이디"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={styles.emailLocal}
                    />
                    <ThemedText variant="body" tone="secondary" style={styles.emailAt}>
                      @
                    </ThemedText>
                    <TextField
                      value={emailDomain}
                      onChangeText={setEmailDomain}
                      onFocus={() => setDomainOpen(false)}
                      placeholder="gmail.com"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={styles.emailDomain}
                    />
                    <PressableScale
                      onPress={() => setDomainOpen((v) => !v)}
                      hitSlop={8}
                      style={[
                        styles.domainChevron,
                        {
                          borderColor: theme.colors.line.base,
                          borderRadius: theme.radii.md,
                          backgroundColor: theme.colors.surface.nested,
                        },
                      ]}
                    >
                      <Icon name="chevronD" size={20} color={theme.colors.ink.secondary} />
                    </PressableScale>
                  </View>
                  <ThemedText variant="caption" tone="placeholder" style={{ marginTop: 6 }}>
                    ▾ 눌러 자주 쓰는 도메인 선택 · 직접 입력도 돼요
                  </ThemedText>
                  <EmailDomainDropdown
                    visible={domainOpen}
                    current={emailDomain}
                    onSelect={setEmailDomain}
                    onClose={() => setDomainOpen(false)}
                    style={styles.emailDropdown}
                  />
                </View>
              ) : (
                <TextField
                  value={email}
                  onChangeText={setEmail}
                  placeholder="이메일"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  style={{ marginBottom: theme.spacing.s3 }}
                />
              )}
              <TextField
                value={password}
                // 공백은 입력 즉시 제거 — 모바일 키보드 자동완성이 몰래 붙이는 공백 때문에
                // "가입은 됐는데 로그인이 안 되는" 사고를 원천 차단. (\s = 모든 공백 문자)
                onChangeText={(t) => setPassword(t.replace(/\s/g, ''))}
                onFocus={() => setDomainOpen(false)}
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
                label={isSignup ? '다음' : '로그인'}
                onPress={handleFormSubmit}
                loading={submitting}
                fullWidth
                style={{ marginTop: theme.spacing.s5 }}
              />
            </Animated.View>
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

const TRACK_PADDING = 4;
const MODES: { mode: Mode; label: string }[] = [
  { mode: 'login', label: '로그인' },
  { mode: 'signup', label: '회원가입' },
];

/**
 * 로그인 / 회원가입 2분할 세그먼트 — 현재 모드를 항상 명시.
 * 선택 하이라이트가 두 칸 사이를 부드럽게 슬라이드(ThemeModeToggle와 같은 패턴).
 */
function AuthModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const theme = useTheme();
  const activeIndex = MODES.findIndex((o) => o.mode === mode);

  const [trackWidth, setTrackWidth] = useState(0);
  const innerWidth = Math.max(0, trackWidth - TRACK_PADDING * 2);
  const segWidth = innerWidth / MODES.length;

  const slide = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: activeIndex,
      duration: motion.duration.base,
      easing: motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, MODES.length - 1],
    outputRange: [0, segWidth * (MODES.length - 1)],
  });

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surface.nested,
          borderColor: theme.colors.line.base,
          borderRadius: theme.radii.pill,
        },
      ]}
    >
      {segWidth > 0 ? (
        <Animated.View
          style={[
            styles.highlight,
            theme.shadows.sm,
            {
              width: segWidth,
              backgroundColor: theme.colors.surface.base,
              borderRadius: theme.radii.pill,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {MODES.map((opt) => {
        const selected = opt.mode === mode;
        return (
          <PressableScale
            key={opt.mode}
            onPress={() => onChange(opt.mode)}
            style={styles.segment}
            hitSlop={4}
          >
            <ThemedText
              variant="bodyMd"
              style={{
                // 비선택 라벨 placeholder는 다크에서 판독이 어려워 secondary로
                color: selected ? theme.colors.point.p600 : theme.colors.ink.secondary,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {opt.label}
            </ThemedText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  emailRow: { flexDirection: 'row', alignItems: 'center' },
  // minWidth:0 — 웹 <input>이 min-content 밑으로 안 줄어들어 행이 오버플로우하는 것 방지(네이티브 무해).
  emailLocal: { flex: 1, minWidth: 0 },
  emailAt: { marginHorizontal: 6 },
  emailDomain: { flex: 1.3, minWidth: 0 },
  domainChevron: {
    width: 46,
    marginLeft: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  // 도메인 박스 아래로 붙어 내려오는 드롭다운 — 행(≈52) 바로 밑, 힌트/비번 위로 겹침.
  emailDropdown: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: TRACK_PADDING,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
});
