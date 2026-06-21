/**
 * 루트 레이아웃 — 모든 라우트의 최상위 컨테이너.
 *
 * 책임:
 *  1) Pretendard 폰트 로드 (expo-font) — 로드 완료 전까지 스플래시 유지
 *  2) Stack 네비게이션 (Task #6에서 (tabs) 그룹 추가 예정)
 *
 * 다음 단계 예정:
 *  - Task #6: (tabs)/_layout.tsx로 5탭 추가
 */
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { startAutoSync } from '@/lib/auto-sync';

// 폰트 로드 완료까지 스플래시 화면 자동 해제 막기 (깜빡임 방지)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // require의 상대 경로: src/app/_layout.tsx → ../../assets/fonts/...
  const [loaded, error] = useFonts({
    PretendardVariable: require('../../assets/fonts/PretendardVariable.ttf'),
  });

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
  // (tabs) 그룹과 /mypage 모두 headerShown:false로 일관 처리.
  return <Stack screenOptions={{ headerShown: false }} />;
}
