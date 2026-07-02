/**
 * InkBalanceChip — 헤더 잉크 잔액 칩.
 *
 * 잔액이 "늘어나면"(출석/기록 보너스) 칩이 살짝 부풀었다 돌아오는 펄스 1회 +
 * 숫자가 이전값→새값으로 카운트업. 토스트 없이 조용하게 적립을 알린다(§9 톤 가드).
 * 잔액이 "줄어들면"(회상 소비) 연출 없이 즉시 반영.
 *
 * 사용: <InkBalanceChip balance={inkBalance} />
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export function InkBalanceChip({ balance }: { balance: number }) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const prevRef = useRef(balance);
  const [display, setDisplay] = useState(balance);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = balance;
    if (balance === prev) return;
    if (balance < prev) {
      setDisplay(balance); // 차감은 조용히 즉시
      return;
    }
    // 증가: 펄스 1회 (180+220ms) + 카운트업 (~500ms)
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.12, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const counter = new Animated.Value(prev);
    const sub = counter.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(counter, { toValue: balance, duration: 500, useNativeDriver: false }).start(
      ({ finished }) => {
        counter.removeListener(sub);
        if (finished) setDisplay(balance);
      },
    );
    return () => {
      counter.stopAnimation();
      counter.removeAllListeners();
    };
  }, [balance, scale]);

  return (
    <Animated.View style={[styles.chip, { transform: [{ scale }] }]}>
      <Icon name="ink" size={14} color={theme.colors.ruby.base} />
      <ThemedText variant="sm" style={{ color: theme.colors.ink.secondary, fontWeight: '700' }}>
        {display}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // 헤더 밀도상 controlPresets.pill(6/12)보다 한 단계 작게 유지 (기존 헤더 칩 룩 보존)
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
});
