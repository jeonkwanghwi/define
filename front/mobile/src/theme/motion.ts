/**
 * define 모션 토큰 — 전 상호작용 "부드러움"의 단일 출처.
 * 라이트/다크와 무관(정적). 지속시간·이징을 여기서만 관리해 일관성 유지.
 *
 * 사용: Animated.timing(v, { duration: motion.duration.base, easing: motion.easing.standard, useNativeDriver: true })
 */
import { Easing, type EasingFunction } from 'react-native';

export const motion = {
  /** 지속시간(ms). 일반 전환은 200–250(브랜드 표준 대역), 눌림 등 빠른 반응은 150. */
  duration: { fast: 150, base: 200, slow: 250 },
  /** 이징. 감속형(ease-out) — 자연스럽게 멈춤. 오버슛 없음(톤 가드). */
  easing: { standard: Easing.out(Easing.cubic) as EasingFunction },
} as const;
