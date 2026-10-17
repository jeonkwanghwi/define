/**
 * InkBalanceChip — 헤더 잉크 잔액 칩.
 *
 * 잔액이 바뀌면 숫자가 이전값→새값으로 굴러간다(카운트). 토스트 없이 조용하게(§9 톤 가드).
 *   - 늘어날 때(출석/기록 보너스): 칩이 살짝 부풀었다 돌아오는 펄스 1회.
 *   - 줄어들 때(회상 소비): 부풀지 않고 숫자만 잠깐 루비색으로 물들었다 돌아온다.
 *     전에는 숫자만 즉시 바뀌어 "방금 잉크를 썼다"는 걸 알아채기 어려웠다.
 *
 * 사용: <InkBalanceChip balance={inkBalance} />
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { controlPresets, motion, radii, useTheme } from '@/theme';

/** 숫자가 굴러가는 시간(ms). 한 번에 바뀌면 놓치고, 길면 기다리게 된다. */
const COUNT_MS = 500;

export function InkBalanceChip({ balance }: { balance: number }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  // 0~1: 루비색 숫자 레이어의 불투명도(차감 표시).
  const tint = useRef(new Animated.Value(0)).current;
  const prevRef = useRef(balance);
  const [display, setDisplay] = useState(balance);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = balance;
    if (balance === prev) return;

    const timing = (v: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(v, { toValue, duration, easing: motion.easing.standard, useNativeDriver: true });

    if (balance > prev) {
      Animated.sequence([timing(scale, 1.12, motion.duration.fast), timing(scale, 1, motion.duration.base)]).start();
    } else {
      // 카운트가 도는 동안 루비로 머물렀다가 천천히 돌아온다.
      Animated.sequence([
        timing(tint, 1, motion.duration.fast),
        Animated.delay(COUNT_MS),
        timing(tint, 0, motion.duration.slow),
      ]).start();
    }

    const counter = new Animated.Value(prev);
    const sub = counter.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(counter, { toValue: balance, duration: COUNT_MS, useNativeDriver: false }).start(
      ({ finished }) => {
        counter.removeListener(sub);
        if (finished) setDisplay(balance);
      },
    );
    return () => {
      counter.stopAnimation();
      counter.removeAllListeners();
    };
  }, [balance, scale, tint]);

  const numberStyle = { fontWeight: '700' } as const;

  return (
    <Animated.View
      style={[
        styles.chip,
        { backgroundColor: theme.colors.surface.nested, transform: [{ scale }] },
      ]}
    >
      <Icon name="ink" size={14} color={theme.colors.ruby.base} />
      {/* 같은 숫자를 두 겹 — 위의 루비 겹을 opacity로 켜고 끈다(색 보간은 네이티브 드라이버 불가). */}
      <View>
        <ThemedText variant="sm" style={[numberStyle, { color: theme.colors.ink.secondary }]}>
          {display}
        </ThemedText>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: tint }]}>
          <ThemedText variant="sm" style={[numberStyle, { color: theme.colors.ruby.base }]}>
            {display}
          </ThemedText>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    ...controlPresets.pill,
    borderRadius: radii.pill,
  },
});
