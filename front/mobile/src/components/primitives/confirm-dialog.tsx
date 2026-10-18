/**
 * ConfirmDialog — 우리 톤의 확인 다이얼로그 (시스템 Alert 대체).
 *
 * 가운데 카드가 spring으로 등장 + fade-in.
 * 위험 액션(destructive)은 Button variant="dangerSolid"(꽉 찬 루비).
 *
 * 사용:
 *   <ConfirmDialog
 *     visible={open}
 *     title="이 기록을 삭제할까요?"
 *     message="이 정의는 단어장에서 사라져요."
 *     confirmLabel="삭제"
 *     destructive
 *     onConfirm={doDelete}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/button';
import { FadeIn } from '@/components/primitives/fade-in';
import { useAfterDismiss } from '@/components/primitives/use-after-dismiss';
import { ThemedText } from '@/components/themed-text';
import { motion, spacing, useTheme } from '@/theme';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /**
   * true면 확인을 눌러도 닫지 않고 onConfirm을 바로 부른다. 내용이 단계별로 바뀌는 확인창
   * (탈퇴 2단계)이나 창 안에서 "…하는 중"을 보여줄 때. 닫기는 호출부가 visible로 정한다.
   * 창을 닫았다 새로 여는 대신 쓰는 이유: iOS는 닫히는 중인 창 위에 새 창을 못 띄운다.
   */
  keepOpen?: boolean;
  /**
   * 취소 버튼만의 동작(기본 = onClose). 바깥 탭·뒤로가기는 언제나 onClose —
   * 취소 버튼이 "그래도 로그아웃" 같은 실제 행동일 때 실수로 바깥을 눌러 실행되지 않게.
   */
  onCancel?: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive,
  onConfirm,
  onClose,
  keepOpen,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const after = useAfterDismiss();

  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 7,
          tension: 90,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.duration.base,
          easing: motion.easing.standard,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.92);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  function handleConfirm() {
    if (keepOpen) {
      onConfirm();
      return;
    }
    // 모달이 다 닫힌 뒤 실행 — 다음 화면(또 다른 Modal)이 iOS에서 무시되지 않게(use-after-dismiss 참고).
    after.schedule(onConfirm);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={after.onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface.base,
                borderRadius: theme.radii.lg,
                opacity,
                transform: [{ scale }],
              },
              theme.shadows.lg,
            ]}
          >
            {/* 글이 바뀌면(단계 전환) 글만 스르륵 다시 나타난다 — 창이 깜빡이지 않게. */}
            <FadeIn key={`${title}|${message ?? ''}`} offset={0}>
              <ThemedText variant="h3" style={{ textAlign: 'center' }}>
                {title}
              </ThemedText>
              {message ? (
                <ThemedText
                  variant="sm"
                  tone="secondary"
                  style={{
                    textAlign: 'center',
                    marginTop: theme.spacing.s2,
                    lineHeight: 22,
                  }}
                >
                  {message}
                </ThemedText>
              ) : null}
            </FadeIn>

            <View style={[styles.actions, { marginTop: theme.spacing.s5 }]}>
              <View style={styles.flex1}>
                <Button
                  label={cancelLabel}
                  variant="ghost"
                  onPress={onCancel ?? onClose}
                  fullWidth
                  style={styles.actionBtn}
                />
              </View>
              <View style={styles.flex1}>
                <Button
                  label={confirmLabel}
                  variant={destructive ? 'dangerSolid' : 'primary'}
                  onPress={handleConfirm}
                  fullWidth
                  style={styles.actionBtn}
                />
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s8,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    padding: spacing.s6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: { flex: 1 },
  // 반반 나눈 좁은 칸에서 "계속 대화" 같은 라벨이 줄바꿈되지 않게 —
  // 내용이 가운데 정렬이라 좌우 패딩을 줄여도 시각 변화 없이 텍스트 공간만 넓어진다.
  actionBtn: { paddingHorizontal: spacing.s2 },
});
