/**
 * 폰트 패밀리 — Pretendard Variable (한글/영문 통일).
 *
 * 실제 폰트 파일(`assets/fonts/PretendardVariable.ttf`)은 _layout.tsx에서
 * expo-font의 useFonts 훅으로 로드한다 (앱 시작 시 1회).
 * 로드 전에는 SplashScreen이 떠 있어 시각적 미스매치 없음.
 *
 * Variable font이므로 fontWeight 100~900 모두 한 파일로 커버.
 */
export const fontFamily = {
  sans: 'PretendardVariable',
} as const;
