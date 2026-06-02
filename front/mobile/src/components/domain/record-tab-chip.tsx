/**
 * RecordTabChip — 중앙 "기록" 탭의 강조 아이콘 컨테이너.
 *
 * design-source의 .tab-record .tab-ico 패턴을 RN으로 옮긴 것.
 * 다른 4개 탭은 평이한 아이콘만 있는데, 핵심 행동(기록)을 시각적으로 도드라지게.
 *
 * 상태별:
 *   - inactive(focused=false): 옅은 포인트 배경(p100) + 진한 포인트 아이콘
 *   - active(focused=true):    진한 포인트 배경(p600) + 흰 아이콘 + 포인트 글로우
 *
 * UX: focused 전환 시 배경색을 짧게 부드럽게 보간(Animated.timing 180ms).
 *     섀도우는 RN에서 보간이 까다로워 즉시 적용(시각적으로 거의 안 느껴짐).
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type RecordTabChipProps = {
  focused: boolean;
};

export function RecordTabChip({ focused }: RecordTabChipProps) {
  const theme = useTheme();

  // 0(inactive) ↔ 1(active) 보간. 배경색·아이콘 색을 매끄럽게 전환.
  const t = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver: false, // 색 보간은 native driver 미지원
    }).start();
  }, [focused, t]);

  const backgroundColor = t.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.point.p100, theme.colors.point.p600],
  });

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor },
        // 활성일 때만 포인트 글로우 — design-source의 box-shadow: var(--shadow-point)
        focused && theme.shadows.point,
      ]}
    >
      {/* 아이콘 색도 focused에 따라 분기 (Icon 컴포넌트의 color는 즉시 값) */}
      <Icon
        name="feather"
        size={20}
        color={focused ? '#FFFFFF' : theme.colors.point.p600}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 46,
    height: 30,
    borderRadius: 999, // pill — design-source와 동일
    alignItems: 'center',
    justifyContent: 'center',
  },
});
