/**
 * ChoiceChip — 값 하나를 고르는 알약 칩(회상의 나이·연도, 프로필의 성별·관심사).
 *
 * 왜 한 컴포넌트인가:
 *   화면마다 "선택됨" 모양이 달랐다(꽉 찬 보라 / 옅은 보라+테두리 / 네모 상자).
 *   같은 행동은 같은 모양이어야 배운 걸 다른 화면에서도 쓴다.
 *   선택 = 옅은 포인트 바탕(p050) + 포인트 테두리(p600). 방식 고르기(둘 중 하나)는 SegmentedControl,
 *   값 고르기는 이 칩 — 역할이 다르니 모양도 나눈다.
 *
 * 색이 툭 바뀌지 않고 motion 토큰으로 스르륵 넘어간다(색 보간이라 JS 드라이버).
 *
 * 사용:
 *   <ChoiceChip label="2024년" selected={y === sel} onPress={() => setSel(y)} />
 *   <ChoiceChip label="남성" selected={on} onPress={...} grow />   // 가로를 나눠 채움
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { motion, radii, useTheme } from '@/theme';

export type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** true면 행의 남은 폭을 나눠 채운다(성별처럼 선택지가 둘뿐일 때). 기본은 글자 크기만큼. */
  grow?: boolean;
};

export function ChoiceChip({ label, selected, onPress, grow }: ChoiceChipProps) {
  const theme = useTheme();
  const p = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: selected ? 1 : 0,
      duration: motion.duration.base,
      easing: motion.easing.standard,
      useNativeDriver: false, // 색 보간은 네이티브 드라이버 미지원
    }).start();
  }, [selected, p]);

  const backgroundColor = p.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.surface.base, theme.colors.point.p050],
  });
  const borderColor = p.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.line.base, theme.colors.point.p600],
  });
  const color = p.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.ink.primary, theme.colors.point.p700],
  });

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={grow ? styles.grow : undefined}
    >
      <Animated.View style={[styles.chip, { backgroundColor, borderColor }]}>
        {/* 고르는 글이라 산세리프(typography.ts의 역할 구분). 선택되면 굵게 — 색만으론 약하다. */}
        <Animated.Text
          style={[theme.typography.sm, { color, fontWeight: selected ? '700' : '500', textAlign: 'center' }]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radii.pill, borderWidth: 1 },
});
