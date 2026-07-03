/**
 * SaveConfirmation — 정의를 "잉크로 새기는" 완료 순간.
 *
 * warm paper 위에 사용자의 단어가 잉크처럼 번져 들어오고(opacity + 살짝 안착),
 * 그 아래로 펜 획(밑줄)이 왼→오로 그어진다. define의 핵심 행위(정의를 새김)에
 * 무게를 주는 시그니처 마이크로 인터랙션. ~1.8초 후 자동 dismiss.
 *
 * 접근성: reduced-motion이면 연출을 건너뛰고 최종 상태로 즉시 표시.
 *
 * 사용:
 *   <SaveConfirmation visible={done} word={word} onDismiss={() => setDone(false)} />
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type SaveConfirmationProps = {
  visible: boolean;
  word: string;
  onDismiss: () => void;
  /** 자동 dismiss까지 시간 (ms). 기본 1800. */
  autoDismissMs?: number;
};

const EASE = Easing.out(Easing.cubic);

export function SaveConfirmation({
  visible,
  word,
  onDismiss,
  autoDismissMs = 1800,
}: SaveConfirmationProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // 연출 단계별 진행값 — 깃펜 → 단어(잉크) → 밑줄(획) → 문구.
  const feather = useRef(new Animated.Value(0)).current;
  const ink = useRef(new Animated.Value(0)).current;
  const stroke = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      feather.setValue(0);
      ink.setValue(0);
      stroke.setValue(0);
      caption.setValue(0);
      return;
    }

    if (reduceMotion) {
      // 연출 생략 — 최종 상태로 즉시.
      feather.setValue(1);
      ink.setValue(1);
      stroke.setValue(1);
      caption.setValue(1);
    } else {
      // 겹쳐 흐르는 시퀀스(총 ~0.9초): 깃펜 → 단어가 번짐 → 획 → 문구.
      Animated.parallel([
        Animated.timing(feather, { toValue: 1, duration: 240, delay: 0, easing: EASE, useNativeDriver: true }),
        Animated.timing(ink, { toValue: 1, duration: 380, delay: 140, easing: EASE, useNativeDriver: true }),
        Animated.timing(stroke, { toValue: 1, duration: 440, delay: 320, easing: EASE, useNativeDriver: true }),
        Animated.timing(caption, { toValue: 1, duration: 300, delay: 560, easing: EASE, useNativeDriver: true }),
      ]).start();
    }

    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, autoDismissMs, onDismiss, feather, ink, stroke, caption]);

  // 단어: 잉크가 번지듯 살짝 크게 들어와 제자리에 안착.
  const inkScale = ink.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={[styles.scrim, { backgroundColor: theme.colors.paper.base + 'F2' }]}>
        <View style={styles.card}>
          {/* 깃펜 — "이 단어를 썼다"는 표식 */}
          <Animated.View style={{ opacity: feather }}>
            <Icon name="feather" size={26} color={theme.colors.point.p600} />
          </Animated.View>

          {/* 단어 — 잉크처럼 번져 들어옴 */}
          <Animated.Text
            numberOfLines={1}
            style={[
              theme.typography.display,
              styles.word,
              { color: theme.colors.point.p600, opacity: ink, transform: [{ scale: inkScale }] },
            ]}
          >
            {word}
          </Animated.Text>

          {/* 펜 획 — 왼→오로 그어지는 밑줄 */}
          <Animated.View
            style={[
              styles.stroke,
              { backgroundColor: theme.colors.point.p500, transform: [{ scaleX: stroke }] },
            ]}
          />

          {/* 문구 */}
          <Animated.View style={{ opacity: caption, alignItems: 'center' }}>
            <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
              마음에 새겼어요
            </ThemedText>
            <ThemedText
              variant="sm"
              tone="secondary"
              style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
            >
              오늘의 나를 한 조각 남겼어요
            </ThemedText>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: { alignItems: 'center' },
  word: {
    fontSize: 46,
    letterSpacing: -1,
    marginTop: 14,
    textAlign: 'center',
  },
  stroke: {
    width: 72,
    height: 3,
    borderRadius: 2,
    marginTop: 12,
    transformOrigin: 'left',
  },
});
