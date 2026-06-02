/**
 * 앱 설정 글로벌 상태 — Zustand store + AsyncStorage 영속.
 *
 * journal-store와 동일한 패턴(익명 + 로컬 영속). 회원가입 없이 폰에 설정 유지.
 *
 * 담는 것:
 *   - themeMode: 'light' | 'dark' | 'system'
 *       · 제품 결정상 기본값은 'light' (따뜻한 페이퍼 톤을 일관되게 보여주기 위함).
 *       · 'system'은 사용자가 명시적으로 고를 때만 OS 설정을 따름.
 *       · 다크 토큰(darkColors/darkShadows)은 이미 theme에 1급 시민으로 존재 → 토글로 즉시 복원.
 *   - nickname: 사용자 표시 이름. 익명 모델이라 기본은 빈 문자열(미설정).
 *
 * 사용:
 *   const mode = useSettingsStore((s) => s.themeMode);
 *   const setThemeMode = useSettingsStore((s) => s.setThemeMode);
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  /** 'light' 기본 — 제품 결정(라이트 강제). 사용자가 토글로 바꾸면 영속. */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  /** 표시 이름. 빈 문자열이면 '미설정'으로 간주. */
  nickname: string;
  setNickname: (name: string) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      nickname: '',
      setNickname: (name) => set({ nickname: name.trim() }),
    }),
    {
      name: 'define-settings-v1', // 모델 깨는 변경 시 v2로 마이그레이션
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
