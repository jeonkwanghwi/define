/**
 * ThemeModeToggle — 라이트 / 다크 / 시스템 3분할 세그먼트 컨트롤.
 *
 * settings-store의 themeMode를 직접 읽고/쓴다. 선택 시 useTheme를 쓰는
 * 모든 화면이 자동으로 새 테마로 리렌더 (다크 모드 즉시 복원).
 * 모양·애니메이션은 SegmentedControl이 맡는다.
 *
 * 사용:
 *   <ThemeModeToggle />
 */
import { SegmentedControl, type SegmentedControlOption } from '@/components/primitives';
import { useSettingsStore, type ThemeMode } from '@/store/settings-store';

const OPTIONS: SegmentedControlOption<ThemeMode>[] = [
  { value: 'light', label: '라이트', icon: 'sun' },
  { value: 'dark', label: '다크', icon: 'moon' },
  // 'settings' 아이콘은 모양이 해라 라이트(sun)와 구분이 안 됐다 → 기기 모양.
  { value: 'system', label: '시스템', icon: 'device' },
];

export function ThemeModeToggle() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  return <SegmentedControl options={OPTIONS} value={themeMode} onChange={setThemeMode} />;
}
