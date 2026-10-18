/**
 * Wordmark — 헤더의 "define." 로고. 글자(Text)가 아니라 SVG 윤곽으로 그린다.
 *
 * 왜 SVG인가: 시작 인트로(LaunchIntro)가 마지막에 이 로고 자리로 내려앉는데, 둘이 같은
 * 데이터(src/data/logo.ts)·같은 viewBox로 그려야 착지 순간 겹쳐도 어긋남 없이 하나로 보인다.
 *
 * 인트로가 착지할 곳을 알 수 있게, 마운트된 Wordmark를 모듈에 기억해 두고
 * measureWordmark()로 화면상 위치를 재게 해 준다(탭마다 헤더가 있지만 위치는 모두 같다).
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { LOGO } from '@/data/logo';
import { LOGO_VIEWBOX } from '@/data/logo-strokes.generated';
import { useTheme } from '@/theme';

export const LOGO_VIEWBOX_STR = `${LOGO_VIEWBOX.x} ${LOGO_VIEWBOX.y} ${LOGO_VIEWBOX.w} ${LOGO_VIEWBOX.h}`;

export type WindowRect = { x: number; y: number; width: number; height: number };

// 가장 최근에 마운트된 헤더 로고. 인트로가 착지 직전에 위치를 잰다.
let current: View | null = null;

/** 헤더 로고의 화면(창) 기준 위치. 아직 없거나 크기가 0이면 null. */
export function measureWordmark(cb: (rect: WindowRect | null) => void) {
  if (!current) return cb(null);
  current.measureInWindow((x, y, width, height) => cb(width > 0 ? { x, y, width, height } : null));
}

export function Wordmark({ height }: { height: number }) {
  const theme = useTheme();
  const ref = useRef<View>(null);
  const width = (height * LOGO_VIEWBOX.w) / LOGO_VIEWBOX.h;

  useEffect(() => {
    // 마운트 때의 노드를 붙잡아 둔다 — 정리(cleanup) 시점엔 ref.current가 이미 null이라
    // 그걸로 비교하면 "내 것인가"가 늘 거짓이 돼, 사라진 로고가 current에 남았다.
    const node = ref.current;
    current = node;
    return () => {
      if (current === node) current = null;
    };
  }, []);

  return (
    <View ref={ref} style={{ width, height }} accessible accessibilityRole="header" accessibilityLabel="define">
      <Svg width={width} height={height} viewBox={LOGO_VIEWBOX_STR}>
        {LOGO.letters.map((l, i) => (
          <Path key={i} d={l.d} fill={theme.colors.ink.primary} />
        ))}
        {/* 마침표도 글자와 같은 먹색 — 포인트색이면 따로 떨어진 얼룩처럼 보였다 */}
        <Circle cx={LOGO.dot.cx} cy={LOGO.dot.cy} r={LOGO.dot.r} fill={theme.colors.ink.primary} />
      </Svg>
    </View>
  );
}
