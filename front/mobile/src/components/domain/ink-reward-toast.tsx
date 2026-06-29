/**
 * InkRewardToast — 출석 적립 안내 토스트. 상단에서 부드럽게 내려와 ~1.8s 후 사라짐.
 * 시스템 Alert 대체(우리 톤). pointerEvents none — 화면 조작 방해 없음.
 */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export function InkRewardToast({
  amount,
  onDone,
  label = '오늘의 잉크',
}: {
  amount: number;
  onDone: () => void;
  label?: string;
}) {
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(onDone);
    }, 1800);
    return () => clearTimeout(t);
  }, [translateY, opacity]); // onDone은 마운트 시 1회 캡처(토스트는 호출 후 언마운트) — deps에 넣으면 부모 리렌더로 타이머 재시작

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface.base,
          borderColor: theme.colors.line.base,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Icon name="ruby" size={18} color={theme.colors.ruby.base} />
      <ThemedText variant="bodyMd" style={{ color: theme.colors.ink.primary, fontWeight: '700' }}>
        {label} +{amount}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 100,
  },
});
