/**
 * 루트 레이아웃 — 모든 라우트의 최상위 컨테이너.
 *
 * 책임:
 *  1) Pretendard 폰트 로드 (expo-font) — 로드 완료 전까지 스플래시 유지
 *  2) Stack 네비게이션
 *  3) 앱 세션당 1회 출석 적립 + 단어장 자동 동기화 시작
 *
 * 적립 연출은 둘이 나눠 맡는다: 잔액 변화는 메인 헤더의 InkBalanceChip(펄스+카운트업),
 * "쌓였다"는 한 줄은 하단 토스트(아래 AttendanceClaim). 옛 토스트를 걷어낸 이유는
 * 화면 위에서 날짜 칩을 가렸기 때문이고, 지금 토스트는 탭바 위 하단이라 가리는 것이 없다.
 */
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LaunchIntro } from '@/components/domain/launch-intro';
import { ToastProvider, useToast } from '@/components/primitives';
import * as SplashScreen from 'expo-splash-screen';

import { FONT_FILES } from '@/theme/fonts';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { runAttendanceClaim } from '@/lib/attendance';
import { startAutoSync } from '@/lib/auto-sync';
import { startForegroundSync } from '@/lib/foreground-sync';
import { claimLocalOwner, getLocalOwner } from '@/lib/sync-journal';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

// 폰트 로드 완료까지 스플래시 화면 자동 해제 막기 (깜빡임 방지)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const theme = useTheme();
  // 글꼴 파일 목록은 theme/fonts.ts 한 곳에 — 세트를 추가하면 여기서 같이 불러온다.
  const [loaded, error] = useFonts(FONT_FILES);

  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const pulledRef = useRef(false);

  // 마이그레이션·안전망: 이미 로그인된 상태인데 로컬 단어장 주인이 미지정(null)이면
  // 현재 계정으로 클레임. 업그레이드 전부터 로그인해 있던 유저가 계정 전환 시 오염되지
  // 않게 한다(신규 로그인은 reconcileForUser가 이미 주인을 지정하므로 여긴 안전망).
  useEffect(() => {
    if (token && user && getLocalOwner() === null) {
      claimLocalOwner(user.id);
    }
  }, [token, user]);

  // 앱 시작 시(토큰 하이드레이션 후) 1회 서버 단어장 당겨오기.
  // 이미 로그인된 기기가 다른 기기의 새 단어를 받도록(로그인 순간에만 하던 다운로드를 시작에도).
  // 포그라운드 복귀 시 추가 다운로드는 아래 startForegroundSync가 담당.
  useEffect(() => {
    if (token && !pulledRef.current) {
      pulledRef.current = true;
      useAuthStore.getState().pullRemoteJournal();
    }
  }, [token]);

  // 로드 성공/실패 시 둘 다 스플래시 해제 (실패해도 시스템 폰트로 폴백되어 앱은 동작)
  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // 단어장 변경 → 서버 자동 동기화(로그인 상태에서만). 언마운트 시 해제.
  useEffect(() => {
    const stop = startAutoSync();
    return stop;
  }, []);

  // 포그라운드 복귀(웹 탭 focus/visible, 네이티브 active) 시 서버 변경 당겨오기. 언마운트 시 해제.
  useEffect(() => {
    const stop = startForegroundSync();
    return stop;
  }, []);

  // 로드 중에는 아무것도 렌더하지 않음 → 스플래시 유지
  if (!loaded && !error) {
    return null;
  }

  // 모든 화면이 자체 헤더(또는 탭바)를 렌더하므로 네이티브 Stack 헤더는 끔.
  return (
    // SafeAreaProvider: 노치·홈 인디케이터 인셋의 공급자. 이게 없으면 useSafeAreaInsets가
    // 0을 돌려줘, 시뮬레이터·웹에서는 멀쩡해 보이고 실기기에서만 헤더가 상태표시줄에 깔린다.
    <SafeAreaProvider>
      {/* ToastProvider는 SafeAreaProvider 안쪽 — 토스트가 하단 인셋을 읽어 탭바 위에 떠야 한다. */}
      <ToastProvider>
        {/* 출석 적립은 Provider 안쪽에서 — 이 컴포넌트가 ToastProvider를 렌더하므로
            여기서는 자기 Context를 읽을 수 없다(useToast가 터진다). 자식으로 내린다. */}
        <AttendanceClaim />
        <RecordBonusToast />
        {/* 네비게이터가 화면 뒤에 칠하는 바탕색을 우리 종이색으로 바꾼다.
            기본값은 React Navigation의 중립 회색(rgb(242,242,242))이라, 화면이 아직
            안 그려졌거나 틈이 생기는 순간 **따뜻한 종이 톤이 아닌 회색**이 드러난다
            (탭 백지 버그 영상에서 실제로 드러난 색이 이것이었다).
            background만 바꾸고 나머지(card·text·border·primary)는 기본값을 쓴다 —
            헤더는 끄고 탭 색은 직접 지정하므로 쓰이는 곳이 없다. */}
        <ThemeProvider
          value={{
            ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
            colors: {
              ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme).colors,
              background: theme.colors.paper.base,
            },
          }}
        >
          <View style={{ flex: 1, backgroundColor: theme.colors.paper.base }}>
            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
            {/* 시작 인트로 — 스플래시가 걷히는 순간부터 화면 위를 덮고, 아래에선 앱이 그대로 준비된다. */}
            <LaunchIntro />
          </View>
        </ThemeProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

/**
 * 앱 세션당 1회 출석 적립. 화면을 그리지 않고 결과만 알린다.
 *
 * 왜 별도 컴포넌트인가: 토스트를 띄우려면 useToast()가 필요하고, 그건 ToastProvider
 * **안쪽**에서만 쓸 수 있다. RootLayout은 Provider를 렌더하는 쪽이라 자기 Context를
 * 읽지 못한다. 진동은 적립 여부를 아는 lib/attendance.ts가 직접 담당한다.
 */
function AttendanceClaim() {
  const token = useAuthStore((s) => s.token);
  const { show } = useToast();
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!token || claimedRef.current) return;
    claimedRef.current = true;
    // 잔액 갱신은 runAttendanceClaim 내부의 setBalance가 담당 → 칩이 반응.
    runAttendanceClaim().then((res) => {
      if (res?.claimed) show(`잉크 ${res.amount}개가 쌓였어요`);
    });
  }, [token, show]);

  return null;
}

/**
 * 연속 기록 보상 알림 — 출석과 같은 말투의 토스트. 보상은 기록 동기화 응답에 실려 와서
 * auth-store.applyRecordBonus가 recordBonus에 남긴다. 새 객체가 올 때마다 한 번 띄운다.
 * (AttendanceClaim과 같은 이유로 ToastProvider 안쪽의 별도 컴포넌트.)
 */
function RecordBonusToast() {
  const bonus = useAuthStore((s) => s.recordBonus);
  const { show } = useToast();

  useEffect(() => {
    if (bonus) show(`${bonus.milestone}일 연속 기록 · 잉크 ${bonus.amount}개가 쌓였어요`);
  }, [bonus, show]);

  return null;
}
