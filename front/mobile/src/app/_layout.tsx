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
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from '@/components/primitives';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { runAttendanceClaim } from '@/lib/attendance';
import { startAutoSync } from '@/lib/auto-sync';
import { startForegroundSync } from '@/lib/foreground-sync';
import { claimLocalOwner, getLocalOwner } from '@/lib/sync-journal';
import { useAuthStore } from '@/store/auth-store';

// 폰트 로드 완료까지 스플래시 화면 자동 해제 막기 (깜빡임 방지)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // require의 상대 경로: src/app/_layout.tsx → ../../assets/fonts/...
  const [loaded, error] = useFonts({
    PretendardVariable: require('../../assets/fonts/PretendardVariable.ttf'),
    // 나눔명조 — 제목·본문용. 정적 폰트라 두께마다 별도 파일(각 ~3MB)이다.
    NanumMyeongjo_400Regular: require('@expo-google-fonts/nanum-myeongjo/400Regular/NanumMyeongjo_400Regular.ttf'),
    NanumMyeongjo_700Bold: require('@expo-google-fonts/nanum-myeongjo/700Bold/NanumMyeongjo_700Bold.ttf'),
  });

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
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
        </View>
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
