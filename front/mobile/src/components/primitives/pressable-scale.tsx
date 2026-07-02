/**
 * PressableScale — 누르면 살짝 눌리는(scale) 피드백을 주는 Pressable 드롭인.
 *
 * 브랜드 "부드러움" 원칙: 모든 탭 대상은 즉각·부드럽게 반응해야 한다.
 * 눌림 = scale 0.97로 timing(ease-out), 뗌 = 1로 복귀. 오버슛 없는 절제된 연출.
 * transform만 애니메이트 → useNativeDriver로 60fps.
 *
 * Pressable과 거의 동일하게 사용(onPress·disabled·hitSlop 등 그대로 전달):
 *   <PressableScale onPress={...} style={styles.card}>{children}</PressableScale>
 *
 * 주의: style은 정적(StyleProp<ViewStyle>)만 받는다. 눌림 피드백은 scale이 담당하므로
 *       Pressable의 style-as-function(pressed) 패턴은 여기선 쓰지 않는다.
 */
import { type ReactNode, useRef } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 눌렀을 때 축소 비율(기본 0.97 — 절제된 눌림). */
  scaleTo?: number;
};

export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number, duration: number) =>
    Animated.timing(scale, {
      toValue,
      duration,
      easing: motion.easing.standard,
      useNativeDriver: true,
    }).start();

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!disabled) animateTo(scaleTo, motion.duration.fast);
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    animateTo(1, motion.duration.base);
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, { transform: [{ scale }] }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
