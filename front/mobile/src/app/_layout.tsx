/**
 * 루트 레이아웃 — 모든 라우트의 최상위 컨테이너.
 *
 * 책임:
 *  1) Pretendard 폰트 로드 (expo-font) — 로드 완료 전까지 스플래시 유지
 *  2) Stack 네비게이션
 *  3) 앱 세션당 1회 출석 적립 + 단어장 자동 동기화 시작
 *
 * 적립 연출은 토스트가 아니라 메인 헤더의 InkBalanceChip이 담당
 * (잔액 변화를 구독해 펄스+카운트업 — 날짜 칩을 가리던 토스트 대체).
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { runAttendanceClaim } from '@/lib/attendance';
import { startAutoSync } from '@/lib/auto-sync';
import { useAuthStore } from '@/store/auth-store';

// 폰트 로드 완료까지 스플래시 화면 자동 해제 막기 (깜빡임 방지)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // require의 상대 경로: src/app/_layout.tsx → ../../assets/fonts/...
  const [loaded, error] = useFonts({
    PretendardVariable: require('../../assets/fonts/PretendardVariable.ttf'),
  });

  const token = useAuthStore((s) => s.token);
  const claimedRef = useRef(false);

  // 토큰이 (하이드레이션 후) 준비되면 앱 세션당 1회 출석 적립 시도.
  // 잔액 갱신은 runAttendanceClaim 내부의 setBalance가 담당 → 칩이 반응.
  useEffect(() => {
    if (token && !claimedRef.current) {
      claimedRef.current = true;
      runAttendanceClaim();
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

  // 로드 중에는 아무것도 렌더하지 않음 → 스플래시 유지
  if (!loaded && !error) {
    return null;
  }

  // 모든 화면이 자체 헤더(또는 탭바)를 렌더하므로 네이티브 Stack 헤더는 끔.
  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
