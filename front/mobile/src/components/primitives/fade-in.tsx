/**
 * FadeIn — 마운트 시 스르륵 나타나는 래퍼(투명도 0→1 + 살짝 아래→제자리).
 *
 * 브랜드 "부드러움": 콘텐츠(카드·리스트·대화 답변)는 툭 뜨지 않고 fade-in.
 * mount 시 1회만 재생(안정 key면 기존 항목은 재생 안 됨). opacity+translateY만 → useNativeDriver.
 * 리스트 stagger는 delay를 index에 비례해 넘긴다: <FadeIn delay={Math.min(i, 8) * 40}>.
 *
 * 사용:
 *   <FadeIn>{child}</FadeIn>
 *   <FadeIn delay={80}>{child}</FadeIn>
 */
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { motion } from '@/theme';

export type FadeInProps = {
  children?: ReactNode;
  /** 시작 지연(ms) — 리스트 stagger용. 기본 0. */
  delay?: number;
  /** 아래에서 올라오는 거리(px). 기본 8(절제). */
  offset?: number;
  style?: StyleProp<ViewStyle>;
};

export function FadeIn({ children, delay = 0, offset = 8, style }: FadeInProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.base,
      delay,
      easing: motion.easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
