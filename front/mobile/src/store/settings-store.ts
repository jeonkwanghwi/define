/**
 * 앱 설정 글로벌 상태 — Zustand store + AsyncStorage 영속.
 *
 * journal-store와 동일한 패턴(익명 + 로컬 영속). 회원가입 없이 폰에 설정 유지.
 *
 * 담는 것:
 *   - themeMode: 'light' | 'dark' | 'system'
 *       · 제품 결정상 기본값은 'light' (따뜻한 페이퍼 톤을 일관되게 보여주기 위함).
 *       · 'system'은 사용자가 명시적으로 고를 때만 OS 설정을 따름.
 *       · 다크 토큰(darkShadows·palettes.ts의 다크 색)은 이미 theme에 1급 시민으로 존재 → 토글로 즉시 복원.
 *   - palette: 포인트 색 계열(호박·와인·쪽빛…). 마이페이지 "테마"에서 고른다.
 *
 * 사용:
 *   const mode = useSettingsStore((s) => s.themeMode);
 *   const setThemeMode = useSettingsStore((s) => s.setThemeMode);
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_FONT_SET, FONT_SET_IDS, type FontSetId } from '@/theme/fonts';
import { DEFAULT_PALETTE, PALETTE_IDS, type PaletteId } from '@/theme/palettes';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  /** 'light' 기본 — 제품 결정(라이트 강제). 사용자가 토글로 바꾸면 영속. */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  /** 진동 피드백. 기본 켬 — 끄고 싶은 사람이 끌 수 있어야 한다(진동에 민감한 사람, 접근성). */
  haptics: boolean;
  setHaptics: (on: boolean) => void;
  /** 포인트 색 계열. 바꾸면 useTheme를 쓰는 화면 전체가 바로 새 색으로 칠해진다. */
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
  /** 본문 글꼴 세트(theme/fonts.ts). 지금은 하나뿐 — 세트가 늘면 마이페이지에서 고르게 한다. */
  fontSet: FontSetId;
  setFontSet: (id: FontSetId) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      haptics: true,
      setHaptics: (on) => set({ haptics: on }),
      palette: DEFAULT_PALETTE,
      setPalette: (id) => set({ palette: id }),
      fontSet: DEFAULT_FONT_SET,
      setFontSet: (id) => set({ fontSet: id }),
    }),
    {
      name: 'define-settings-v1', // 모델 깨는 변경 시 v2로 마이그레이션
      storage: createJSONStorage(() => AsyncStorage),
      // v0 → v1: 예전 익명 닉네임이 여기 저장됐다가 auth-store(계정)로 이전됨.
      // persist에 남은 옛 nickname 필드가 죽은 데이터로 떠돌아 혼란을 줌 → 정리한다.
      // v1 → v2: haptics 추가. 예전 저장값엔 이 키가 없다 → 기본값(켬)을 채운다.
      // 두 단계를 if로 나눠 쌓는 이유: themeMode처럼 이미 저장된 값을 그대로 들고 가야 한다.
      // early return으로 끊으면 v0 사용자가 v2 보정을 못 받고, 반대로 덮어쓰면 고른 테마가 날아간다.
      // v2 → v3: palette 추가. 예전 저장값엔 없다 → 기본 팔레트를 채운다.
      // 모르는 id(없어진 팔레트 등)가 들어 있어도 기본값으로 — 없는 색으로 앱을 칠할 수는 없다.
      // v3 → v4: fontSet 추가. palette와 같은 규칙(없거나 모르는 id면 기본 세트).
      version: 4,
      migrate: (persisted, version) => {
        let state = persisted as Record<string, unknown>;
        if (version === 0 && state && typeof state === 'object' && 'nickname' in state) {
          const { nickname: _legacy, ...rest } = state;
          state = rest;
        }
        if (version < 2) {
          state = { haptics: true, ...state }; // 기존 키가 뒤에 와서 덮어쓴다
        }
        if (version < 3) {
          const known = PALETTE_IDS.includes(state.palette as PaletteId);
          state = { ...state, palette: known ? state.palette : DEFAULT_PALETTE };
        }
        if (version < 4) {
          const known = FONT_SET_IDS.includes(state.fontSet as FontSetId);
          state = { ...state, fontSet: known ? state.fontSet : DEFAULT_FONT_SET };
        }
        return state as SettingsState;
      },
    },
  ),
);
