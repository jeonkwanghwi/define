/**
 * ThinkingPages — 회상 "생각하는 중" 3D 로딩 인디케이터.
 *
 * 은유: 과거의 내가 옛 기록(책장)을 뒤적이는 중 — sepia 톤 페이지가 3D로 넘어간다.
 * 구현: WebGL 없이 RN transform의 perspective + rotateY만 사용 (네이티브·웹 공통 동작).
 *   - 바닥 페이지(정지) 위에서 윗 페이지가 왼쪽 모서리를 축으로 계속 넘어감.
 *   - transformOrigin: 'left center' = 회전축을 책등(왼쪽)에 고정.
 * reduce-motion이면 회전 없이 정적 표시(접근성).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

export function ThinkingPages({ size = 26 }: { size?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // 0→1이 "한 장 넘김". repeat로 무한 반복 (reverse 없음 — 항상 앞으로만 넘김).
  const flip = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    flip.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [reduceMotion, flip]);

  const pageStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 420 }, // 값이 작을수록 원근감(3D 느낌)이 강해짐
      { rotateY: `${interpolate(flip.value, [0, 1], [0, -168])}deg` },
    ],
    // 넘어가는 동안 살짝 어두워졌다 밝아짐 — 종이가 빛을 등지는 느낌
    opacity: interpolate(flip.value, [0, 0.5, 1], [1, 0.75, 1]),
  }));

  // 회상 말풍선과 같은 sepia 계열 (recall-chat의 빛바랜 종이 톤과 통일)
  const paper = theme.mode === 'dark' ? '#4A3F2E' : '#EFE4CF';
  const paperEdge = theme.mode === 'dark' ? '#5C4F3A' : '#E4D5BB';
  const spine = theme.colors.point.p600;

  const page = {
    width: size * 0.72,
    height: size,
    backgroundColor: paper,
    borderColor: paperEdge,
  };

  return (
    <View style={[styles.book, { width: size * 1.6, height: size }]}>
      {/* 책등 — 회전축 위치 표시(포인트 색 세로선) */}
      <View style={[styles.spine, { backgroundColor: spine, height: size }]} />
      {/* 바닥 페이지(오른쪽, 정지) */}
      <View style={[styles.page, styles.rightPage, page]} />
      {/* 넘어가는 페이지 — 책등(왼쪽 모서리)을 축으로 3D 회전 */}
      <Animated.View style={[styles.page, styles.flipPage, page, pageStyle]} />
      {/* 이미 넘어간 페이지(왼쪽, 정지·뒤집힌 상태) */}
      <View style={[styles.page, styles.leftPage, page, { opacity: 0.55 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spine: { width: 2, borderRadius: 1, zIndex: 2 },
  page: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 3,
  },
  // 오른쪽 절반에 붙는 페이지: 책등 기준 오른쪽
  rightPage: { left: '50%' },
  // 왼쪽에 이미 넘어간 페이지: 책등 기준 왼쪽
  leftPage: { right: '50%' },
  // 넘어가는 페이지: 오른쪽 위치에서 시작, 왼쪽 모서리(책등)를 축으로 회전
  flipPage: { left: '50%', transformOrigin: 'left center', zIndex: 1 },
});
