/**
 * define 디자인 토큰 — 통합 진입점.
 *
 * 이 모듈 하나로 색·타입·스페이싱·라운드·섀도우를 모두 접근한다.
 *
 * 사용:
 *   import { useTheme } from '@/theme';
 *
 *   function MyComponent() {
 *     const theme = useTheme();
 *     return (
 *       <View style={{ backgroundColor: theme.colors.paper.base, padding: theme.spacing.s4 }}>
 *         <Text style={[theme.typography.display, { color: theme.colors.ink.primary }]}>
 *           오늘의 단어
 *         </Text>
 *       </View>
 *     );
 *   }
 *
 * 시스템 라이트/다크 변경을 자동 감지(useColorScheme)하여 적절한 테마를 반환.
 * 추후 사용자 수동 토글이 필요해지면 ThemeProvider(React Context)를 여기에 도입.
 */
// 라이트 강제 모드 — useColorScheme import 임시 보류.
// 추후 마이페이지에서 "라이트 / 다크 / 시스템" 토글 도입 시 useColorScheme 다시 사용 예정.
// import { useColorScheme } from '@/hooks/use-color-scheme';

import { darkColors, lightColors, type Colors } from './colors';
import { radii } from './radii';
import { darkShadows, lightShadows, type Shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export type Theme = {
  mode: 'light' | 'dark';
  colors: Colors;
  shadows: Shadows;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
};

const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  shadows: lightShadows,
  typography,
  spacing,
  radii,
};

const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  shadows: darkShadows,
  typography,
  spacing,
  radii,
};

/**
 * 현재 테마 반환.
 *
 * 지금은 **라이트 강제** — 시스템이 다크여도 라이트 톤(warm paper · ink) 유지.
 * 사유: 사용자가 디자인 의도(따뜻한 페이퍼 톤)를 일관되게 보고자 함.
 *
 * 추후 마이페이지에서 사용자 토글이 들어오면 store 또는 Context로 mode를 받아
 * `mode === 'dark' ? darkTheme : lightTheme` 분기로 복원.
 */
export function useTheme(): Theme {
  return lightTheme;
}

// 개별 토큰 모듈을 직접 import 하고 싶을 때 (드물지만 유틸성 코드에서)
export { lightColors, darkColors, lightShadows, darkShadows, typography, spacing, radii };
export type { Colors, Shadows };
export type { TypographyVariant } from './typography';
