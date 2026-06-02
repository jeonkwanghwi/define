/**
 * ActionSheet — 우리 톤의 하단 액션 시트.
 *
 * 시스템 ActionSheet(iOS) / Alert 대신 디자인 톤을 유지하는 커스텀.
 * 슬라이드업 + scrim 탭 닫기 + 각 액션 누름 시 자동 닫힘.
 *
 * 사용:
 *   <ActionSheet
 *     visible={open}
 *     title="이 기록을 어떻게 할까요?"
 *     items={[
 *       { label: '수정', onPress: startEdit },
 *       { label: '삭제', destructive: true, onPress: confirmDelete },
 *     ]}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

export type ActionSheetItem = {
  label: string;
  onPress: () => void;
  /** true면 ruby 색으로 위험 액션 강조 (삭제 등). */
  destructive?: boolean;
  /** true면 disabled 처리. */
  disabled?: boolean;
};

export type ActionSheetProps = {
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
  /** 취소 버튼 라벨. 기본 "취소". */
  cancelLabel?: string;
};

export function ActionSheet({
  visible,
  title,
  items,
  onClose,
  cancelLabel = '취소',
}: ActionSheetProps) {
  const theme = useTheme();

  function handleItemPress(item: ActionSheetItem) {
    if (item.disabled) return;
    // 누른 직후 닫고 → 액션 실행. 시각적 흐름이 자연스러움(시트 사라진 다음 결과).
    onClose();
    // 시트 닫힘 애니메이션과 액션의 후속 UI(예: confirm) 충돌 방지 — 약간 늦춤.
    setTimeout(item.onPress, 200);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(20,18,15,0.42)' }]}
        onPress={onClose}
      >
        {/* 내용 영역 — 시트와 취소 버튼이 같이 들어감. 내부 탭은 차단. */}
        <Pressable onPress={() => {}} style={styles.wrap}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.surface.base,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            {title ? (
              <View
                style={[
                  styles.titleWrap,
                  { borderBottomColor: theme.colors.line.base },
                ]}
              >
                <ThemedText variant="caption" tone="secondary">
                  {title}
                </ThemedText>
              </View>
            ) : null}
            {items.map((item, i) => (
              <Pressable
                key={i}
                disabled={item.disabled}
                onPress={() => handleItemPress(item)}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.line.base,
                  },
                  pressed && !item.disabled && {
                    backgroundColor: theme.colors.surface.nested,
                  },
                  item.disabled && { opacity: 0.4 },
                ]}
              >
                <ThemedText
                  variant="bodyMd"
                  style={{
                    color: item.destructive
                      ? theme.colors.ruby.base
                      : theme.colors.ink.primary,
                  }}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* 취소는 시트와 분리된 별도 카드 — iOS 액션시트의 전통적 형태 */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancel,
              {
                backgroundColor: pressed
                  ? theme.colors.surface.nested
                  : theme.colors.surface.base,
                borderRadius: theme.radii.lg,
                marginTop: 8,
              },
            ]}
          >
            <ThemedText variant="bodyMd" tone="strong">
              {cancelLabel}
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end' },
  wrap: { paddingHorizontal: 12, paddingBottom: 24 },
  sheet: { overflow: 'hidden' },
  titleWrap: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  item: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  cancel: {
    paddingVertical: 18,
    alignItems: 'center',
  },
});
