/**
 * NeighborSheet — 집에 들어갔을 때 뜨는, 그 이웃의 정의 목록 시트.
 *
 * 렌더러(2D/3D)와 무관하게 재사용되는 "콘텐츠" 층. 광장 [word] 화면의
 * 정의 카드 스타일을 그대로 따라 톤 일관성 유지.
 * 시트 패턴(Modal slide + scrim 탭 닫기)도 앱의 기존 시트 규칙과 동일.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Neighbor } from '@/data/village-mock';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

type Props = {
  neighbor: Neighbor | null; // null이면 닫힘
  onClose: () => void;
};

export function NeighborSheet({ neighbor, onClose }: Props) {
  const theme = useTheme();
  const visible = neighbor !== null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 바깥 어둡게 + 탭하면 닫힘 */}
      <Pressable style={styles.scrim} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.colors.paper.base, borderTopLeftRadius: theme.radii.xl, borderTopRightRadius: theme.radii.xl },
        ]}
        // 시트 내부 탭이 scrim까지 전달돼 닫히는 것 방지
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.handle} />

        <View style={styles.head}>
          <ThemedText variant="h3">{neighbor?.name}</ThemedText>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Icon name="close" size={20} color={theme.colors.ink.secondary} />
          </Pressable>
        </View>
        <ThemedText variant="caption" tone="placeholder" style={{ marginBottom: theme.spacing.s3 }}>
          이 집 사람이 정의한 단어들
        </ThemedText>

        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
          {neighbor?.words.map((w, i) => (
            <View
              key={`${w.word}-${i}`}
              style={[
                styles.card,
                { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, borderRadius: theme.radii.lg },
                theme.shadows.sm,
              ]}
            >
              <ThemedText variant="bodyMd" tone="strong">
                {w.word}
              </ThemedText>
              <ThemedText variant="body" style={{ marginTop: theme.spacing.s1, lineHeight: 24 }}>
                {w.text}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#00000022', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, paddingVertical: 14, paddingHorizontal: 16 },
});
