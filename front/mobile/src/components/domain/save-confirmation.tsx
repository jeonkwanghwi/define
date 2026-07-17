/**
 * SaveConfirmation — 정의를 "잉크로 새기는" 완료 순간.
 *
 * warm paper 위에 사용자의 단어가 잉크처럼 번져 들어오고(opacity + 살짝 안착),
 * 그 아래로 펜 획(밑줄)이 왼→오로 그어진다. define의 핵심 행위(정의를 새김)에
 * 무게를 주는 시그니처 마이크로 인터랙션. ~1.8초 후 자동 dismiss.
 *
 * 재정의 리빌: count ≥ 2면 마지막 단계에서 "N번째 정의"를 처음으로 공개한다.
 * (쓰는 동안엔 재정의임을 숨기는 블라인드 쓰기 설계의 짝 — 놀람은 저장 후에.)
 * 리빌 칩을 탭하면 onViewTimeline으로 지난 생각과 비교하러 이동.
 * 리빌이 있을 땐 자동 닫힘 없음 — 이 순간이 핵심이라 타이머로 끊지 않는다.
 * (화면 아무 데나 탭하면 닫힘. 일반 저장은 기존대로 1.8초 자동 닫힘.)
 *
 * 접근성: reduced-motion이면 연출을 건너뛰고 최종 상태로 즉시 표시.
 *
 * 사용:
 *   <SaveConfirmation visible={done} word={word} count={n} onDismiss={...} onViewTimeline={...} />
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export type SaveConfirmationProps = {
  visible: boolean;
  word: string;
  onDismiss: () => void;
  /** 방금 저장으로 이 단어가 몇 번째 정의가 됐는지. 2 이상이면 리빌 노출. */
  count?: number;
  /** 리빌 칩 탭 → 단어 타임라인으로. 없으면 리빌은 문구만 표시. */
  onViewTimeline?: () => void;
  /** 자동 dismiss까지 시간 (ms). 기본 1800. 리빌이 있으면 무시(탭으로만 닫힘). */
  autoDismissMs?: number;
};

const EASE = Easing.out(Easing.cubic);

export function SaveConfirmation({
  visible,
  word,
  onDismiss,
  count,
  onViewTimeline,
  autoDismissMs,
}: SaveConfirmationProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  // 재정의 리빌 — 이 단어가 처음이 아니었음을 저장 후에야 공개.
  const isReveal = (count ?? 1) >= 2;

  // 연출 단계별 진행값 — 깃펜 → 단어(잉크) → 밑줄(획) → 문구 → (리빌).
  const feather = useRef(new Animated.Value(0)).current;
  const ink = useRef(new Animated.Value(0)).current;
  const stroke = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      feather.setValue(0);
      ink.setValue(0);
      stroke.setValue(0);
      caption.setValue(0);
      reveal.setValue(0);
      return;
    }

    if (reduceMotion) {
      // 연출 생략 — 최종 상태로 즉시.
      feather.setValue(1);
      ink.setValue(1);
      stroke.setValue(1);
      caption.setValue(1);
      reveal.setValue(1);
    } else {
      // 겹쳐 흐르는 시퀀스(총 ~0.9초): 깃펜 → 단어가 번짐 → 획 → 문구.
      // 리빌은 한 박자 쉬고(~1.1초) 등장 — "새겼다"의 여운 뒤에 오는 반전.
      Animated.parallel([
        Animated.timing(feather, { toValue: 1, duration: 240, delay: 0, easing: EASE, useNativeDriver: true }),
        Animated.timing(ink, { toValue: 1, duration: 380, delay: 140, easing: EASE, useNativeDriver: true }),
        Animated.timing(stroke, { toValue: 1, duration: 440, delay: 320, easing: EASE, useNativeDriver: true }),
        Animated.timing(caption, { toValue: 1, duration: 300, delay: 560, easing: EASE, useNativeDriver: true }),
        Animated.timing(reveal, { toValue: 1, duration: 320, delay: 1100, easing: EASE, useNativeDriver: true }),
      ]).start();
    }

    // 리빌이 있으면 자동 닫힘 없음 — 사용자가 탭할 때까지 기다린다.
    if (isReveal) return;
    const timer = setTimeout(onDismiss, autoDismissMs ?? 1800);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion, isReveal, autoDismissMs, onDismiss, feather, ink, stroke, caption, reveal]);

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
      {/* 스크림 탭 → 닫기. 리빌일 땐 이게 유일한 닫힘 경로(자동 닫힘 없음). */}
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.paper.base + 'F2' }]}
        onPress={onDismiss}
      >
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

          {/* 재정의 리빌 — 여기서 처음 공개. 좌: 닫기(보조) / 우: 비교하러 가기(주 액션). */}
          {isReveal ? (
            <Animated.View
              style={[styles.reveal, { opacity: reveal, marginTop: theme.spacing.s5 }]}
            >
              <ThemedText variant="sm" style={{ color: theme.colors.point.p600, fontWeight: '700' }}>
                이 단어, {count}번째 정의예요
              </ThemedText>
              <View style={styles.revealActions}>
                <View style={styles.revealBtn}>
                  <Button
                    label="다음에 보기"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onPress={onDismiss}
                    style={styles.btnTight}
                  />
                </View>
                <View style={styles.revealBtn}>
                  <Button
                    label="보러 가기"
                    size="sm"
                    fullWidth
                    onPress={onViewTimeline}
                    disabled={!onViewTimeline}
                    style={styles.btnTight}
                  />
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
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
  reveal: { alignSelf: 'stretch', alignItems: 'center' },
  revealActions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
    marginTop: 14,
  },
  revealBtn: { flex: 1 }, // 두 버튼 반반 — ConfirmDialog 액션 행과 동일 규약
  // 반반 칸에서 라벨 공간 확보 — 가운데 정렬이라 좌우 패딩 줄여도 시각 무변화(ConfirmDialog와 동일 처방)
  btnTight: { paddingHorizontal: 8 },
});
