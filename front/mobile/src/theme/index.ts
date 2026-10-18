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
 * 테마 모드는 settings-store(themeMode)에서 받는다:
 *   - 'light' / 'dark' : 사용자 명시 선택을 그대로 사용
 *   - 'system'         : OS 설정(useColorScheme)을 따름
 * 기본값은 'light' (제품 결정 — 따뜻한 페이퍼 톤을 일관되게).
 *
 * 색은 settings-store(palette)의 팔레트에서 만든다(palettes.ts). colors.ts에는 모양(타입)만 있다.
 */
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/store/settings-store';

import type { Colors } from './colors';
import { fontFamily } from './fonts';
import { motion } from './motion';
import { getColors, type PaletteId } from './palettes';
import { radii } from './radii';
import { darkShadows, lightShadows, type Shadows } from './shadows';
import { controlPresets, spacing } from './spacing';
import { typography } from './typography';

export type Theme = {
  mode: 'light' | 'dark';
  colors: Colors;
  shadows: Shadows;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  presets: typeof controlPresets;
  motion: typeof motion;
};

// 팔레트 × 모드 = 12가지. 순수하게 만들어지니 한 번 만들고 같은 객체를 재사용한다.
const themeCache: Partial<Record<string, Theme>> = {};

function getTheme(palette: PaletteId, mode: 'light' | 'dark'): Theme {
  const key = `${palette}-${mode}`;
  const cached = themeCache[key];
  if (cached) return cached;

  const colors = getColors(palette, mode);
  const shadows =
    mode === 'light'
      ? // 라이트의 포인트 글로우는 포인트 색을 따른다(다크는 검정 그대로)
        { ...lightShadows, point: { ...lightShadows.point, shadowColor: colors.point.p600 } }
      : darkShadows;
  const theme: Theme = {
    mode,
    colors,
    shadows,
    typography,
    spacing,
    radii,
    presets: controlPresets,
    motion,
  };
  themeCache[key] = theme;
  return theme;
}

/**
 * 현재 테마 반환.
 *
 * settings-store의 themeMode + (system이면) OS 설정으로 라이트/다크 결정,
 * palette로 색 계열 결정.
 * 기본값 'light'이므로 토글을 건드리지 않은 사용자는 기존과 동일한 페이퍼 톤을 본다.
 *
 * 마이페이지의 ThemeModeToggle·테마 피커에서 themeMode·palette를 바꾸면 useTheme를 쓰는 모든
 * 컴포넌트가 자동 리렌더되어 즉시 테마가 바뀐다.
 */
export function useTheme(): Theme {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const palette = useSettingsStore((s) => s.palette);
  const resolved = themeMode === 'system' ? (systemScheme ?? 'light') : themeMode;
  return getTheme(palette, resolved === 'dark' ? 'dark' : 'light');
}

// 개별 토큰 모듈을 직접 import 하고 싶을 때 (드물지만 유틸성 코드에서)
export {
  fontFamily,
  lightShadows,
  darkShadows,
  typography,
  spacing,
  controlPresets,
  radii,
  motion,
};
export type { Colors, Shadows };
export type { TypographyVariant } from './typography';
export { getColors, PALETTES, PALETTE_IDS, type PaletteId } from './palettes';
