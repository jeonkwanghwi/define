/**
 * SaveConfirmation — 단어 기록 완료 마이크로 인터랙션.
 *
 * design-source의 .done-scrim 패턴을 옮긴 것:
 *   - 풀스크린 반투명 overlay (warm paper 베이스)
 *   - 가운데 포인트 색 원 + 흰 체크 (spring pop 애니메이션)
 *   - 단어 메시지 + 부제 (fade-in)
 *   - ~1.6초 후 자동 dismiss (caller가 onDismiss로 후속 처리)
 *
 * 의도적으로 시스템 Alert를 대체. 톤 일치 + 부드러운 만족감.
 *
 * 사용:
 *   <SaveConfirmation visible={done} word={word} onDismiss={() => setDone(false)} />
 */
import { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type SaveConfirmationProps = {
  visible: boolean;
  word: string;
  onDismiss: () => void;
  /** 자동 dismiss까지 시간 (ms). 기본 1600. */
  autoDismissMs?: number;
};

export function SaveConfirmation({
  visible,
  word,
  onDismiss,
  autoDismissMs = 1600,
}: SaveConfirmationProps) {
  const theme = useTheme();

  // 체크 원의 pop scale + 전체 fade-in
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // 등장: 빠른 fade-in + spring scale
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5, // 약간 통통 튀는 느낌
          tension: 80,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      // 자동 dismiss — caller가 후속(예: 새 단어 뽑기) 처리
      const timer = setTimeout(onDismiss, autoDismissMs);
      return () => clearTimeout(timer);
    } else {
      // 다음 호출 위해 값 리셋
      scale.setValue(0.3);
      opacity.setValue(0);
    }
  }, [visible, autoDismissMs, onDismiss, scale, opacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* warm paper 베이스의 반투명 scrim — 살짝 비치는 느낌 */}
      <View
        style={[
          styles.scrim,
          {
            backgroundColor: theme.colors.paper.base + 'CC', // ~80% opacity
          },
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          {/* 포인트 색 원 + 흰 체크 + point 글로우 */}
          <View
            style={[
              styles.checkCircle,
              { backgroundColor: theme.colors.point.p600 },
              theme.shadows.point,
            ]}
          >
            <Icon name="check" size={36} color="#FFFFFF" strokeWidth={2.6} />
          </View>

          <ThemedText
            variant="h2"
            style={{ marginTop: theme.spacing.s5, textAlign: 'center' }}
          >
            {word}을(를) 기록했어요
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
  card: {
    alignItems: 'center',
  },
  checkCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
