/**
 * ConfirmDialog — 우리 톤의 확인 다이얼로그 (시스템 Alert 대체).
 *
 * 가운데 카드가 spring으로 등장 + fade-in.
 * 위험 액션(destructive)은 ruby 색 강조.
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
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
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
}: ConfirmDialogProps) {
  const theme = useTheme();

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
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.92);
      opacity.setValue(0);
    }
  }, [visible, scale, opacity]);

  function handleConfirm() {
    onClose();
    setTimeout(onConfirm, 180);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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

            <View style={[styles.actions, { marginTop: theme.spacing.s5 }]}>
              <View style={styles.flex1}>
                <Button
                  label={cancelLabel}
                  variant="ghost"
                  onPress={onClose}
                  fullWidth
                  style={styles.actionBtn}
                />
              </View>
              <View style={styles.flex1}>
                {/* 위험 액션은 ruby 색 primary 느낌 — 표준 Button.variant에 없어 inline 처리 */}
                {destructive ? (
                  <Pressable
                    onPress={handleConfirm}
                    style={({ pressed }) => [
                      styles.destructive,
                      {
                        backgroundColor: theme.colors.ruby.base,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <ThemedText
                      variant="bodyMd"
                      style={{ color: '#FFFFFF' }}
                    >
                      {confirmLabel}
                    </ThemedText>
                  </Pressable>
                ) : (
                  <Button
                    label={confirmLabel}
                    onPress={handleConfirm}
                    fullWidth
                    style={styles.actionBtn}
                  />
                )}
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
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: { flex: 1 },
  // 반반 나눈 좁은 칸에서 "계속 대화" 같은 라벨이 줄바꿈되지 않게 —
  // 내용이 가운데 정렬이라 좌우 패딩을 줄여도 시각 변화 없이 텍스트 공간만 넓어진다.
  actionBtn: { paddingHorizontal: 8 },
  destructive: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
