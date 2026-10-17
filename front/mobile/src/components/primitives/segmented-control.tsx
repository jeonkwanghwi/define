/**
 * SegmentedControl — 여럿 중 하나를 고르는 알약 트랙 + 미끄러지는 선택 표시(thumb).
 *
 * 왜 이 모양인가:
 *   선택이 바뀌었는데 글자 굵기·색만 살짝 바뀌면 사용자는 바뀐 줄 모른다.
 *   그래서 선택 칸은 **꽉 찬 포인트(p600) + ink.onPoint 글자** — 탭바의 선택 알약과 같은 언어다.
 *   thumb은 칸 사이를 미끄러지고(motion 토큰), 글자색도 thumb 위치에 맞춰 같이 바뀐다
 *   (thumb이 도착하기 전에 글자만 먼저 흰색이 되면 트랙 위에서 글자가 사라져 보인다).
 *
 * 사용:
 *   <SegmentedControl
 *     options={[{ value: 'light', label: '라이트', icon: 'sun' }, …]}
 *     value={mode}
 *     onChange={setMode}
 *   />
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/icons';
import { hapticTap } from '@/lib/haptics';
import { motion, spacing, useTheme } from '@/theme';

import { PressableScale } from './pressable-scale';

const TRACK_PADDING = spacing.s1;

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

export type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** md(기본, 14px 라벨) | sm(12px 라벨, 낮은 높이) */
  size?: 'md' | 'sm';
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const theme = useTheme();
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // 트랙 안쪽 폭을 재서 칸 폭을 정한다 — 칸은 flex:1로 같은 폭을 나눠 가진다.
  const [trackWidth, setTrackWidth] = useState(0);
  const segWidth = Math.max(0, trackWidth - TRACK_PADDING * 2) / options.length;

  // slide = "지금 thumb이 몇 번째 칸 위에 있나"(소수 포함). 위치와 글자색이 이 값 하나를 따른다.
  const slide = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: activeIndex,
      duration: motion.duration.base,
      easing: motion.easing.standard,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, slide]);

  // interpolate는 inputRange가 2개 이상이어야 해서, 옵션이 하나뿐일 때를 대비해 [0, 1]로 깐다.
  const last = Math.max(1, options.length - 1);
  const translateX = slide.interpolate({
    inputRange: [0, last],
    outputRange: [0, segWidth * last],
  });

  const labelVariant = size === 'sm' ? 'caption' : 'sm';
  const iconSize = size === 'sm' ? 14 : 16;
  const paddingVertical = size === 'sm' ? 6 : 9;

  function select(next: T) {
    if (next === value) return;
    hapticTap();
    onChange(next);
  }

  return (
    <View
      accessibilityRole="radiogroup"
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
      {/* thumb — 폭을 잰 뒤에만 그린다(0폭으로 한 번 번쩍이지 않게) */}
      {segWidth > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            {
              width: segWidth,
              backgroundColor: theme.colors.point.p600,
              borderRadius: theme.radii.pill,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}

      {options.map((opt, i) => {
        const selected = i === activeIndex;
        // 이 칸 위에 thumb이 얼마나 올라와 있나(0~1) — 선택 글자 레이어의 불투명도.
        const on = slide.interpolate({
          inputRange: [i - 1, i, i + 1],
          outputRange: [0, 1, 0],
          extrapolate: 'clamp',
        });
        const off = on.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
        const content = (color: string) => (
          <>
            {opt.icon ? <Icon name={opt.icon} size={iconSize} color={color} /> : null}
            <ThemedText
              variant={labelVariant}
              numberOfLines={1}
              style={{ color, fontWeight: '600' }}
            >
              {opt.label}
            </ThemedText>
          </>
        );
        return (
          <PressableScale
            key={opt.value}
            onPress={() => select(opt.value)}
            hitSlop={TRACK_PADDING}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={styles.segment}
          >
            {/* 두 겹을 겹쳐 thumb 위치에 맞춰 크로스페이드 — 탭바 아이콘과 같은 방식 */}
            <Animated.View style={[styles.layer, { paddingVertical, opacity: off }]}>
              {content(theme.colors.ink.secondary)}
            </Animated.View>
            <Animated.View style={[styles.layer, styles.overlay, { opacity: on }]}>
              {content(theme.colors.ink.onPoint)}
            </Animated.View>
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
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
  },
  segment: { flex: 1 },
  layer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.s1,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
