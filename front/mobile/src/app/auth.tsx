/**
 * /auth — 로그인 ↔ 회원가입 토글 풀스크린. 마이페이지/AuthGate에서 진입.
 *
 * 가입은 step으로 진행: 'form'(이메일+비번) → 'verify'(메일로 받은 6자리) → 계정 생성.
 * 코드가 맞아야 계정이 생긴다 — 그래서 "미인증 계정"이라는 상태가 없다.
 * 인증 후 프로필 미완성이면 /profile-setup으로 replace(설계: 단일 프로필 게이트).
 * 시스템 다이얼로그 X — 검증/서버 에러는 인라인 메시지.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Button, FadeIn, PressableScale, TextField, useToast } from '@/components/primitives';
import { COMMON_EMAIL_DOMAINS, EmailDomainDropdown } from '@/components/domain/email-domain-dropdown';
import { EmailCodeForm } from '@/components/domain/email-code-form';
import { ScreenHeader } from '@/components/domain/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';

import { AppleCanceled, getAppleCredential, isAppleAuthAvailable } from '@/lib/apple-auth';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { KakaoCanceled, useKakaoAuth } from '@/lib/kakao-auth';
import { DOCS_ORIGIN, openDoc } from '@/lib/open-doc';
import { type ApiError, userFacingMessage } from '@/services/api-client';
import { requestEmailCode } from '@/services/auth-api';
import { useAuthStore } from '@/store/auth-store';
import { motion, useTheme } from '@/theme';

type Mode = 'login' | 'signup';
type Step = 'chooser' | 'form' | 'verify';

export default function AuthScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const appleBg = theme.mode === 'dark' ? '#FFFFFF' : '#000000';
  const appleFg = theme.mode === 'dark' ? '#000000' : '#FFFFFF';
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const login = useAuthStore((s) => s.login);
  const loginWithKakao = useAuthStore((s) => s.loginWithKakao);
  const loginWithApple = useAuthStore((s) => s.loginWithApple);
  const kakao = useKakaoAuth();
  const { show } = useToast();

  /**
   * 들어왔다/보냈다를 알린다 — 로그아웃은 토스트를 띄우는데 로그인·가입이 조용하면
   * 화면만 바뀌고 "됐다"는 말이 없다. 진동 + 토스트 한 줄로 같은 언어를 쓴다.
   */
  function notifySuccess(message: string) {
    hapticSuccess();
    show(message);
  }
  // Apple 로그인은 iOS 13+ 에서만 존재한다. 없는 기기에서 버튼이 살아 있으면
  // 눌러도 아무 일이 안 일어나 고장으로 보인다 → 가용 여부를 물어 잠근다.
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    isAppleAuthAvailable()
      .then((ok) => alive && setAppleAvailable(ok))
      .catch(() => alive && setAppleAvailable(false));
    return () => {
      alive = false;
    };
  }, []);

  // AuthGate의 "가입하고 시작하기"는 ?mode=signup으로 들어온다 — 가입하러 왔는데 "로그인"
  // 화면이 뜨면 잘못 눌렀나 싶다. 파라미터가 없으면(헤더·마이페이지 진입) 기존대로 로그인.
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'login');
  const [step, setStep] = useState<Step>('chooser');
  // 미구현 소셜(카카오/애플) 탭 시 우리 톤 인라인 안내.
  const [socialNotice, setSocialNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  // 가입 전용 — 아이디/도메인 분리 입력(오타 방지). 로그인은 위 email 단일 칸 사용.
  const [emailLocal, setEmailLocal] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [domainOpen, setDomainOpen] = useState(false);
  // 기본은 드롭다운 셀렉트, "직접 입력" 고르면 도메인 칸이 편집 가능해진다.
  const [domainCustom, setDomainCustom] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 인증번호를 마지막으로 보낸 시각 — EmailCodeForm의 60초 카운트다운을 재시작시키는 신호.
  const [cooldownFrom, setCooldownFrom] = useState(0);
  // 재전송 발송 중. submitting(코드 확인 중)과 섞으면 확인 버튼이 멋대로 스피너가 된다.
  const [resending, setResending] = useState(false);

  const isSignup = mode === 'signup';
  // 가입=아이디@도메인 조합, 로그인=단일 이메일 칸(자동완성 유지).
  // 아이디 칸에 이메일을 통째로 쳤다면(아직 칸을 떠나지 않아 나누기 전) 그 값을 그대로 쓴다.
  const effectiveEmail = isSignup
    ? emailLocal.includes('@')
      ? emailLocal.trim()
      : `${emailLocal.trim()}@${emailDomain.trim()}`
    : email.trim();

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

  // 아이디 칸에 이메일 전체(me@gmail.com)를 붙여넣는 경우가 흔하다 — 그대로 두면
  // "me@gmail.com@선택"이 돼 형식 에러가 난다. "@" 뒤를 도메인 칸으로 옮겨 준다.
  // 나누는 건 붙여넣기(한 번에 여러 글자)거나 칸을 떠날 때만 — 한 글자씩 칠 때 "@"에서 나누면
  // "@"가 사라지고 이어 친 "gmail.com"이 아이디에 붙어 "megmail.com"이 된다.
  function handleEmailLocalChange(t: string) {
    if (t.length - emailLocal.length > 1) splitEmail(t);
    else setEmailLocal(t);
  }

  function splitEmail(t: string) {
    const at = t.indexOf('@');
    const domain = at < 0 ? '' : t.slice(at + 1).trim();
    if (!domain) {
      setEmailLocal(t);
      return;
    }
    setEmailLocal(t.slice(0, at));
    if (!domain) return; // "@"만 친 상태 — 도메인은 드롭다운에서 고르게 둔다
    setEmailDomain(domain);
    // 목록에 없는 도메인은 직접 입력 칸으로 보여줘야 고칠 수 있다.
    setDomainCustom(!COMMON_EMAIL_DOMAINS.includes(domain));
    setDomainOpen(false);
  }

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) return '올바른 이메일 형식이 아니에요.';
    if (password.length < 8) return '비밀번호는 8자 이상이에요.';
    return null;
  }

  // 폼 제출: 로그인이면 바로 로그인, 가입이면 인증번호를 보내고 코드 step으로.
  async function handleFormSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    if (isSignup) {
      // 발송이 성공해야 단계를 넘긴다 — 먼저 넘어가면 실패(409·429·네트워크)를 보여줄 자리가 없다.
      setSubmitting(true);
      try {
        await requestEmailCode(effectiveEmail, 'signup');
        setCooldownFrom(Date.now());
        setStep('verify');
      } catch (e) {
        setError(mapAuthError(e));
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setSubmitting(true);
    try {
      await login(effectiveEmail, password);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      // 처음 온 사람(프로필 미완성 → 프로필 설정으로 감)에게 "로그인했어요"는 틀린 말이다.
      notifySuccess(completed ? '로그인했어요' : '환영해요 · 프로필만 정하면 끝나요');
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

  /**
   * 카카오 로그인 — 인가 코드를 받아 서버에 넘기면 로그인/가입이 한 번에 끝난다.
   * 도착지는 이메일 로그인과 동일(프로필 미완성이면 /profile-setup).
   * 취소는 에러가 아니므로 아무 메시지도 남기지 않는다.
   */
  async function handleKakao() {
    setSocialNotice(null);
    setError(null);
    // 웹에서는 끝까지 못 간다: 인증 후 앱으로 돌아오는 주소가 커스텀 스킴(define://)이라
    // 브라우저가 가로챌 수 없다. 팝업만 뜨고 아무 일도 안 일어나면 고장으로 보이므로 먼저 막는다.
    if (Platform.OS === 'web') {
      setSocialNotice('카카오 로그인은 앱에서만 돼요 (웹은 지원하지 않아요)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await kakao.getAuthCode();
      await loginWithKakao(result);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      // 처음 온 사람(프로필 미완성 → 프로필 설정으로 감)에게 "로그인했어요"는 틀린 말이다.
      notifySuccess(completed ? '로그인했어요' : '환영해요 · 프로필만 정하면 끝나요');
      router.replace(completed ? '/' : '/profile-setup');
    } catch (e) {
      if (e instanceof KakaoCanceled) return; // 사용자가 그만둔 것 — 조용히 돌아간다
      console.warn('[auth] 카카오 로그인 실패:', e);
      hapticError();
      setError(mapSocialError(e, '카카오'));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Apple 로그인 — 시트에서 받은 identityToken을 서버에 넘기면 로그인/가입이 끝난다.
   * 인가 코드도 같이 넘긴다 — 로그인이 아니라 탈퇴 때 연결을 끊는 데 쓰인다.
   */
  async function handleApple() {
    setSocialNotice(null);
    setError(null);
    setSubmitting(true);
    try {
      const { identityToken, authorizationCode } = await getAppleCredential();
      await loginWithApple(identityToken, authorizationCode);
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      // 처음 온 사람(프로필 미완성 → 프로필 설정으로 감)에게 "로그인했어요"는 틀린 말이다.
      notifySuccess(completed ? '로그인했어요' : '환영해요 · 프로필만 정하면 끝나요');
      router.replace(completed ? '/' : '/profile-setup');
    } catch (e) {
      if (e instanceof AppleCanceled) return; // 사용자가 그만둔 것 — 조용히 돌아간다
      console.warn('[auth] Apple 로그인 실패:', e);
      hapticError();
      setError(mapSocialError(e, 'Apple'));
    } finally {
      setSubmitting(false);
    }
  }

  // 인증번호 확인 → 계정 생성 → 프로필 화면.
  async function handleCodeSubmit(code: string) {
    setError(null);
    setSubmitting(true);
    try {
      await signup(effectiveEmail, password, code);
      notifySuccess('가입을 마쳤어요');
      const completed = useAuthStore.getState().user?.profileCompleted ?? false;
      router.replace(completed ? '/' : '/profile-setup');
    } catch (e) {
      // 코드 단계에 머문다 — EmailCodeForm이 error를 입력칸 아래에 그린다.
      // (폼으로 되돌리면 방금 틀린 번호를 고칠 자리가 사라진다.)
      hapticError();
      setError(mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  /** 인증번호 재전송. 성공하면 cooldownFrom을 갱신해 카운트다운을 60초로 되돌린다. */
  async function handleResend() {
    setError(null);
    setResending(true);
    try {
      await requestEmailCode(effectiveEmail, 'signup');
      setCooldownFrom(Date.now());
      // 카운트다운이 다시 도는 것만으론 "갔다"가 안 읽힌다.
      notifySuccess('인증번호를 다시 보냈어요');
    } catch (e) {
      setError(mapAuthError(e)); // 429 '잠시 후에 다시 시도해 주세요.'도 그대로 보여준다
    } finally {
      setResending(false);
    }
  }

  // 방법 선택 화면에서 이메일 폼으로 — 로그인/회원가입 모드를 정해 진입.
  function goEmail(next: Mode) {
    setSocialNotice(null);
    setError(null);
    setDir(next === 'signup' ? 1 : -1);
    setMode(next);
    setStep('form');
  }

  function handleBack() {
    if (step === 'verify') {
      setStep('form');
      setError(null);
      return;
    }
    if (step === 'form') {
      // 이메일 폼 → 방법 선택으로 되돌림.
      setStep('chooser');
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
        {/* 제목은 지금 하는 일(로그인/회원가입)을 단계와 무관하게 늘 말한다 —
            인증번호 단계에서만 제목이 생기면 헤더가 튀어 보였다. */}
        <ScreenHeader
          title={isSignup ? '회원가입' : '로그인'}
          onBack={handleBack}
        />

        {step === 'verify' ? (
          <EmailCodeForm
            email={effectiveEmail}
            onSubmit={handleCodeSubmit}
            onResend={handleResend}
            submitting={submitting}
            resending={resending}
            error={error}
            cooldownFrom={cooldownFrom}
          />
        ) : step === 'chooser' ? (
          <View style={styles.body}>
            {/* 헤딩은 상단 고정, 버튼 3개만 남은 공간에서 세로 중앙. */}
            {/* key=mode — 하단 링크로 로그인↔가입을 바꾸면 헤딩이 다시 스르륵 떠서 바뀐 걸 알린다. */}
            <FadeIn key={mode} style={{ marginTop: theme.spacing.s8 }}>
              <ThemedText variant="h1">
                {'나만의 단어를\n정의해보세요'}
              </ThemedText>
              {isSignup ? (
                // 가입 시 비로그인 때 쓴 정의가 광장에 올라간다(가져오기) — 모른 채 공개되지 않게 미리 말한다.
                <ThemedText variant="sm" tone="secondary" style={{ marginTop: theme.spacing.s3 }}>
                  {SIGNUP_PUBLISH_NOTE}
                </ThemedText>
              ) : null}
            </FadeIn>

            <View style={styles.chooserButtons}>
              <Button
                label={isSignup ? '이메일로 가입하기' : '이메일로 로그인'}
                fullWidth
                leftIcon={<Icon name="mail" size={18} color={theme.colors.ink.onPoint} />}
                onPress={() => goEmail(mode)}
                style={{ height: SOCIAL_BTN_HEIGHT }}
              />

              <PressableScale
                onPress={
                  kakao.configured
                    ? handleKakao
                    : () => setSocialNotice('카카오 로그인은 준비 중이에요 · 곧 만나요')
                }
                disabled={submitting}
                style={[
                  styles.socialBtn,
                  {
                    backgroundColor: '#FEE500',
                    borderRadius: theme.radii.pill,
                    marginTop: theme.spacing.s4,
                  },
                  submitting && { opacity: 0.6 },
                ]}
              >
                <View style={styles.socialRow}>
                  <KakaoBubble />
                  {/* 굵기는 이메일 버튼(Button label = 600)과 맞춘다 — 700이면 나란히 놓였을 때 글자가 더 커 보인다. */}
                  <ThemedText variant="label" style={{ color: KAKAO_INK }}>
                    {/* 카카오·Apple은 계정이 없으면 만들어 준다 — 가입 화면에선 "시작하기"가 정직하다. */}
                    {isSignup ? '카카오로 시작하기' : '카카오 로그인'}
                  </ThemedText>
                </View>
              </PressableScale>

              {/* Apple 버튼은 HIG의 "직접 만든 버튼" 규격으로 그린다 — 흑/백 바탕, Apple 로고, 공식 문구.
                  네이티브 버튼(AppleAuthenticationButton)은 글자 크기가 버튼 높이에 비례해(≈43%)
                  같은 높이의 이메일·카카오 버튼보다 글자가 훨씬 컸고, 앱이 한국어 현지화가 없어 영어로 나왔다.
                  쓸 수 없는 기기(Android·웹)에서는 같은 모양으로 안내만 띄운다. */}
              <PressableScale
                onPress={
                  appleAvailable
                    ? handleApple
                    : () => setSocialNotice('Apple 로그인은 아이폰에서만 돼요')
                }
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={isSignup ? 'Apple로 시작하기' : 'Apple로 로그인'}
                style={[
                  styles.socialBtn,
                  {
                    // 어두운 바탕에 검은 버튼은 구멍으로 보인다 — HIG도 다크에선 흰 버튼을 쓰라고 한다.
                    backgroundColor: appleBg,
                    borderRadius: theme.radii.pill,
                    marginTop: theme.spacing.s4,
                  },
                  submitting && { opacity: 0.6 },
                ]}
              >
                <View style={styles.socialRow}>
                  <AppleLogo color={appleFg} />
                  <ThemedText variant="label" style={{ color: appleFg }}>
                    {isSignup ? 'Apple로 시작하기' : 'Apple로 로그인'}
                  </ThemedText>
                </View>
              </PressableScale>

              {error ? (
                <FadeIn>
                  <ThemedText
                    variant="sm"
                    style={{
                      color: theme.colors.ruby.base,
                      marginTop: theme.spacing.s4,
                      textAlign: 'center',
                    }}
                  >
                    {error}
                  </ThemedText>
                </FadeIn>
              ) : null}

              {socialNotice ? (
                <FadeIn>
                  <ThemedText
                    variant="sm"
                    tone="secondary"
                    style={{ marginTop: theme.spacing.s4, textAlign: 'center' }}
                  >
                    {socialNotice}
                  </ThemedText>
                </FadeIn>
              ) : null}

              <TermsNote />
            </View>

            {/* 반대 모드로 가는 작은 링크 — 회원가입은 로그인 방법 고르기 전 결정 → 하단에.
                가입 화면에선 이미 계정 있는 사람이 로그인으로 넘어갈 길. */}
            <PressableScale
              onPress={() => {
                setSocialNotice(null);
                setError(null);
                if (isSignup) setMode('login');
                else goEmail('signup');
              }}
              hitSlop={8}
              // 화면 맨 아래 링크라 홈 인디케이터만큼 더 띄운다.
              style={[styles.signupLink, { paddingBottom: styles.signupLink.paddingBottom + insets.bottom }]}
            >
              <ThemedText variant="sm" tone="secondary">
                {isSignup ? '이미 계정이 있나요?' : '아직 회원이 아니신가요?'}{' '}
              </ThemedText>
              <ThemedText variant="sm" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
                {isSignup ? '로그인' : '회원가입'}
              </ThemedText>
            </PressableScale>
          </View>
        ) : (
          <View style={styles.body}>
            <Animated.View
              style={{
                marginTop: theme.spacing.s8,
                opacity: swap,
                transform: [
                  { translateX: swap.interpolate({ inputRange: [0, 1], outputRange: [dir * 28, 0] }) },
                ],
              }}
            >
              <ThemedText variant="h1" style={{ marginBottom: isSignup ? theme.spacing.s3 : theme.spacing.s8 }}>
                {isSignup ? '나만의 정의를\n저장해 보세요' : '다시 만나서\n반가워요'}
              </ThemedText>
              {isSignup ? (
                <ThemedText variant="sm" tone="secondary" style={{ marginBottom: theme.spacing.s8 }}>
                  {SIGNUP_PUBLISH_NOTE}
                </ThemedText>
              ) : null}

              {isSignup ? (
                // 도메인 드롭다운이 아래 필드 위로 겹쳐 내려오도록 relative + zIndex.
                <View style={{ marginBottom: theme.spacing.s3, position: 'relative', zIndex: 20 }}>
                  <View style={styles.emailRow}>
                    <TextField
                      value={emailLocal}
                      onChangeText={handleEmailLocalChange}
                      onBlur={() => splitEmail(emailLocal)}
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
                    {domainCustom ? (
                      // 직접 입력 모드 — 박스가 편집 가능. 안쪽 ▾로 언제든 목록 재오픈.
                      <View
                        style={[
                          styles.domainBox,
                          {
                            borderColor: theme.colors.line.base,
                            borderRadius: theme.radii.md,
                            backgroundColor: theme.colors.surface.nested,
                          },
                        ]}
                      >
                        <TextInput
                          value={emailDomain}
                          onChangeText={setEmailDomain}
                          onFocus={() => setDomainOpen(false)}
                          placeholder="도메인 입력"
                          placeholderTextColor={theme.colors.ink.placeholder}
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus
                          keyboardType="email-address"
                          // lineHeight는 뺀다 — 한 줄 입력에 주면 iOS가 글자 아래를 자른다(TextField와 같은 이유).
                          style={[styles.domainBoxInput, theme.typography.body, { color: theme.colors.ink.primary, lineHeight: undefined }]}
                        />
                        <PressableScale
                          onPress={() => setDomainOpen((v) => !v)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel="이메일 도메인 고르기"
                        >
                          <Icon name="chevronD" size={20} color={theme.colors.ink.secondary} />
                        </PressableScale>
                      </View>
                    ) : (
                      // 셀렉트 모드 — 박스 자체가 드롭다운 트리거.
                      <PressableScale
                        onPress={() => setDomainOpen((v) => !v)}
                        style={[
                          styles.domainBox,
                          {
                            borderColor: theme.colors.line.base,
                            borderRadius: theme.radii.md,
                            backgroundColor: theme.colors.surface.nested,
                          },
                        ]}
                      >
                        <ThemedText
                          variant="body"
                          numberOfLines={1}
                          style={[
                            styles.domainBoxText,
                            { color: emailDomain ? theme.colors.ink.primary : theme.colors.ink.placeholder },
                          ]}
                        >
                          {emailDomain || '선택'}
                        </ThemedText>
                        <Icon name="chevronD" size={20} color={theme.colors.ink.secondary} />
                      </PressableScale>
                    )}
                  </View>
                  <EmailDomainDropdown
                    visible={domainOpen}
                    current={emailDomain}
                    onSelect={(d) => {
                      setEmailDomain(d);
                      setDomainCustom(false);
                    }}
                    onCustom={() => {
                      setDomainCustom(true);
                      setEmailDomain('');
                    }}
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

              {/* 비밀번호 재설정 진입점 — 로그인 모드만. 가입에는 "잊은 비밀번호"가 없다.
                  에러 문구 아래에 둔다: 에러는 비밀번호 칸에 붙어 있어야 뭐가 틀렸는지 읽힌다. */}
              {!isSignup ? (
                <PressableScale
                  onPress={() => router.push('/password-reset')}
                  hitSlop={8}
                  style={{ marginTop: theme.spacing.s3, alignSelf: 'flex-end' }}
                >
                  <ThemedText variant="sm" tone="secondary">
                    비밀번호를 잊으셨나요?
                  </ThemedText>
                </PressableScale>
              ) : null}

              <Button
                label={isSignup ? '다음' : '로그인'}
                onPress={handleFormSubmit}
                loading={submitting}
                fullWidth
                style={{ marginTop: theme.spacing.s5 }}
              />

              {isSignup ? <TermsNote /> : null}

              {/* 로그인 폼에서 신규 유저용 회원가입 링크(가입 폼은 chooser 하단에서 진입). */}
              {!isSignup ? (
                <PressableScale
                  onPress={() => goEmail('signup')}
                  hitSlop={8}
                  style={{ marginTop: theme.spacing.s5, flexDirection: 'row', justifyContent: 'center' }}
                >
                  <ThemedText variant="sm" tone="secondary">
                    처음이신가요?{' '}
                  </ThemedText>
                  <ThemedText
                    variant="sm"
                    style={{ color: theme.colors.point.p600, fontWeight: '700' }}
                  >
                    회원가입
                  </ThemedText>
                </PressableScale>
              ) : null}
            </Animated.View>
          </View>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** 서버/네트워크 에러 → 우리 톤 인라인 문구. */
/** 소셜 경로 전용 — 401을 "비밀번호를 확인하세요"로 보여주면 안 된다(비밀번호가 없다). */
function mapSocialError(e: unknown, provider: '카카오' | 'Apple'): string {
  const err = e as Partial<ApiError>;
  if (err?.status === 503) return `${provider} 로그인은 조금 뒤에 다시 시도해 주세요.`;
  if (err?.status === 401) return `${provider} 로그인에 실패했어요. 다시 시도해 주세요.`;
  return userFacingMessage(e) ?? '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
}

function mapAuthError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.status === 409) return '이미 가입된 이메일이에요.';
  if (err?.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.';
  return userFacingMessage(e) ?? '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
}

/** 가입하면 비로그인 때 쓴 정의가 광장으로 가져와진다 — 가입 화면 두 곳(방법 선택·이메일 폼)에서 같은 말. */
const SIGNUP_PUBLISH_NOTE = '가입하면 지금까지 쓴 정의가 광장에 함께 올라가요';

/**
 * 가입 버튼 아래 약관 동의 한 줄 (Apple 심사 1.2 — 남이 쓴 글이 보이는 앱은 가입 때
 * 약관에 동의받고, 불쾌한 글을 용납하지 않는다는 걸 알려야 한다).
 * 체크박스 대신 "누르면 동의"로 — 가입 버튼을 누르는 행동이 곧 동의다(흔한 묵시적 동의 방식).
 * 차분하게 caption·secondary로 두되, 두 문서 이름은 눌러서 바로 열 수 있게.
 */
function TermsNote() {
  const theme = useTheme();
  // Text 안의 Text는 같은 줄에서 이어 흐르고, 따로 onPress를 받는다 — 문장 중간 링크에 딱 맞다.
  const link = { color: theme.colors.point.p600, fontWeight: '700' as const };
  return (
    <ThemedText
      variant="caption"
      tone="secondary"
      style={{ marginTop: theme.spacing.s5, textAlign: 'center' }}
    >
      가입하면{' '}
      <ThemedText
        variant="caption"
        style={link}
        onPress={() => openDoc(`${DOCS_ORIGIN}/terms.html`, theme)}
        accessibilityRole="link"
      >
        이용약관
      </ThemedText>
      과{' '}
      <ThemedText
        variant="caption"
        style={link}
        onPress={() => openDoc(`${DOCS_ORIGIN}/privacy.html`, theme)}
        accessibilityRole="link"
      >
        개인정보처리방침
      </ThemedText>
      에 동의하게 돼요.{'\n'}광장에 불쾌하거나 해로운 글은 올릴 수 없어요.
    </ThemedText>
  );
}

/** 카카오 브랜드 가이드가 정한 노란 배경 위 글자·로고 색. 배경은 #FEE500. */
const KAKAO_INK = '#191600';

/**
 * 로그인 버튼 셋의 공통 높이.
 *
 * 셋은 출처가 다르다 — 이메일은 우리 Button 프리미티브, 카카오는 직접 그린 Pressable,
 * Apple은 expo가 주는 네이티브 버튼. 각자 패딩으로 높이가 정해지면 58·60·56처럼
 * 어긋나고, 셋이 세로로 붙어 있으니 그 차이가 그대로 보인다. Apple 버튼은 높이를
 * 우리가 주는 수밖에 없으므로, 그 값을 셋의 기준으로 삼는다.
 * (bodyMd lineHeight 28 + 위아래 14 = 56 — 글자가 눌리지 않는 최소값이기도 하다.)
 */
const SOCIAL_BTN_HEIGHT = 56;

/**
 * 카카오 말풍선. 카카오 브랜드 가이드의 글자색(#191600)에 맞춘 채움 도형이라
 * 선 기반인 우리 아이콘 셋에 넣지 않고 여기 둔다 — 섞으면 아이콘 셋의 결이 깨진다.
 */
/** Apple 로고 — HIG가 직접 만든 Sign in with Apple 버튼에 허용하는 로고 모양. 글자색과 같은 색으로 채운다. */
function AppleLogo({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={color}
      />
    </Svg>
  );
}

function KakaoBubble() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
      <Path
        d="M12 3C6.9 3 2.8 6.3 2.8 10.3c0 2.6 1.7 4.8 4.3 6.1l-1.1 4c-.1.3.3.6.6.4l4.7-3.1c.2 0 .5 0 .7 0 5.1 0 9.2-3.3 9.2-7.4S17.1 3 12 3z"
        fill={KAKAO_INK}
      />
    </Svg>
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
  // 헤딩 아래 남은 공간에서 버튼 3개 세로 중앙(하단 회원가입 링크는 이 아래 별도).
  chooserButtons: {
    flex: 1,
    justifyContent: 'center',
  },
  // 방법 선택 화면 하단 회원가입 링크.
  signupLink: {
    paddingTop: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  // 소셜 로그인 버튼 — 브랜드색(카카오 노랑/애플 검정). 이메일 Button과 높이 맞춤.
  socialBtn: {
    height: SOCIAL_BTN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 로고와 글자를 한 줄로. gap은 아이콘이 글자에 붙지 않을 만큼만.
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // 네이티브 Apple 버튼은 높이를 직접 줘야 한다(내용에 맞춰 늘어나지 않는다).
  // 카카오 버튼(패딩 16 + 본문 24)과 같은 56으로 맞춘다.
  emailRow: { flexDirection: 'row', alignItems: 'center' },
  // minWidth:0 — 웹 <input>이 min-content 밑으로 안 줄어들어 행이 오버플로우하는 것 방지(네이티브 무해).
  emailLocal: { flex: 1, minWidth: 0 },
  emailAt: { marginHorizontal: 6 },
  // 도메인 셀렉트 박스 — 박스 자체가 드롭다운 트리거(안에 ▾ 내장). TextField와 같은 시각 언어.
  // 고정 폭(가장 긴 도메인 hanmail.net + ▾가 안 잘릴 만큼) → 아이디 칸(flex)이 나머지를 차지해 넓어짐.
  domainBox: {
    width: 148,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 14,
  },
  domainBoxText: { flex: 1 },
  // minWidth:0 — emailLocal과 같은 이유. 긴 직접 입력 도메인(붙여넣기)이 박스 밖으로 넘치던 것 방지.
  domainBoxInput: { flex: 1, minWidth: 0, padding: 0 },
  // 도메인 박스 아래로 붙어 내려오는 드롭다운 — 행(≈52) 바로 밑, 힌트/비번 위로 겹침.
  emailDropdown: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
  },
});
