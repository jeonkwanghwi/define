/**
 * ThemeModeToggle — 라이트 / 다크 / 시스템 3분할 세그먼트 컨트롤.
 *
 * settings-store의 themeMode를 직접 읽고/쓴다. 선택 시 useTheme를 쓰는
 * 모든 화면이 자동으로 새 테마로 리렌더 (다크 모드 즉시 복원).
 *
 * UX: 선택 하이라이트가 세그먼트 사이를 부드럽게 슬라이드(200ms).
 *   - 컨테이너 너비를 onLayout으로 측정 → 세그먼트 폭 = 너비/3
 *   - 하이라이트는 절대배치 + translateX 보간
 *
 * 사용:
 *   <ThemeModeToggle />
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/icons';
import { useSettingsStore, type ThemeMode } from '@/store/settings-store';
import { useTheme } from '@/theme';

const TRACK_PADDING = 4;

const OPTIONS: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'light', label: '라이트', icon: 'sun' },
  { mode: 'dark', label: '다크', icon: 'moon' },
  { mode: 'system', label: '시스템', icon: 'settings' },
];

export function ThemeModeToggle() {
  const theme = useTheme();
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const activeIndex = OPTIONS.findIndex((o) => o.mode === themeMode);

  // 컨테이너 내부 폭(좌우 패딩 4+4 제외)을 측정해 세그먼트 폭 계산.
  // 세그먼트는 flex:1로 이 내부 폭을 3등분하므로 하이라이트 폭/이동도 같은 기준.
  const [trackWidth, setTrackWidth] = useState(0);
  const innerWidth = Math.max(0, trackWidth - TRACK_PADDING * 2);
  const segWidth = innerWidth / OPTIONS.length;

  // 하이라이트 위치 — 선택 인덱스로 보간
  const slide = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: activeIndex,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, OPTIONS.length - 1],
    outputRange: [0, segWidth * (OPTIONS.length - 1)],
  });

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.surface.nested,
          borderColor: theme.colors.line.base,
          borderRadius: theme.radii.pill,
        },
      ]}
    >
      {/* 슬라이딩 하이라이트 — 측정 완료(segWidth>0) 후에만 렌더 */}
      {segWidth > 0 ? (
        <Animated.View
          style={[
            styles.highlight,
            theme.shadows.sm,
            {
              width: segWidth,
              backgroundColor: theme.colors.surface.base,
              borderRadius: theme.radii.pill,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {OPTIONS.map((opt) => {
        const selected = opt.mode === themeMode;
        const color = selected ? theme.colors.point.p600 : theme.colors.ink.placeholder;
        return (
          <PressableScale
            key={opt.mode}
            onPress={() => setThemeMode(opt.mode)}
            style={styles.segment}
            hitSlop={4}
          >
            <Icon name={opt.icon} size={16} color={color} />
            <ThemedText
              variant="caption"
              style={{ color, fontWeight: selected ? '700' : '500' }}
            >
              {opt.label}
            </ThemedText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: TRACK_PADDING,
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
});
