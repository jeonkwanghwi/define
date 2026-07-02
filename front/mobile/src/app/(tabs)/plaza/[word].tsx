/**
 * 광장 단어 상세 — 한 단어에 대한 여러 사람의 정의 카드.
 *
 * 동적 라우트: /plaza/{word}. useLocalSearchParams로 word 받음(journal [word] 패턴).
 * 서버에서 정의 목록을 받아 표시. 내 정의(isMine)는 맨 위 + 포인트 강조 + "내 정의" 배지.
 */
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/domain/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { formatRelativeLabel } from '@/lib/format-date';
import { getPlazaWord, toggleEntryLike, type PlazaWordDetail } from '@/services/plaza-api';
import { useAuthStore } from '@/store/auth-store';
import { controlPresets, useTheme } from '@/theme';

export default function PlazaWordDetailScreen() {
  const theme = useTheme();
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const word = typeof rawWord === 'string' ? rawWord : '';
  const token = useAuthStore((s) => s.token);

  const [data, setData] = useState<PlazaWordDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token || !word) return;
    let alive = true;
    setFailed(false);
    getPlazaWord(token, word)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [token, word]);

  function handleToggleLike(entryId: string) {
    if (!token) return;
    // optimistic: 즉시 반영(정렬은 재정렬 안 함 — 손가락 밑에서 카드가 튀지 않게)
    setData((prev) =>
      prev
        ? {
            ...prev,
            definitions: prev.definitions.map((d) =>
              d.id === entryId
                ? { ...d, isLiked: !d.isLiked, likeCount: d.likeCount + (d.isLiked ? -1 : 1) }
                : d,
            ),
          }
        : prev,
    );
    toggleEntryLike(token, entryId)
      .then((res) => {
        // 서버 값으로 확정
        setData((prev) =>
          prev
            ? {
                ...prev,
                definitions: prev.definitions.map((d) =>
                  d.id === entryId ? { ...d, isLiked: res.liked, likeCount: res.likeCount } : d,
                ),
              }
            : prev,
        );
      })
      .catch(() => {
        // 실패 시 optimistic 되돌림(조용히)
        setData((prev) =>
          prev
            ? {
                ...prev,
                definitions: prev.definitions.map((d) =>
                  d.id === entryId
                    ? { ...d, isLiked: !d.isLiked, likeCount: d.likeCount + (d.isLiked ? -1 : 1) }
                    : d,
                ),
              }
            : prev,
        );
      });
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title={word} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {failed ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            정의를 불러오지 못했어요.
          </ThemedText>
        ) : data === null ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            불러오는 중…
          </ThemedText>
        ) : data.definitions.length === 0 ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            아직 정의가 없어요.
          </ThemedText>
        ) : (
          data.definitions.map((d) => (
            <View
              key={d.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface.base,
                  borderColor: d.isMine ? theme.colors.point.p500 : theme.colors.line.base,
                  borderRadius: theme.radii.lg,
                },
                theme.shadows.sm,
              ]}
            >
              <View style={styles.cardHead}>
                <ThemedText variant="bodyMd" tone="strong">
                  {d.nickname}
                </ThemedText>
                {d.isMine ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.point.p100 }]}>
                    <ThemedText variant="caption" style={{ color: theme.colors.point.p700 }}>
                      내 정의
                    </ThemedText>
                  </View>
                ) : null}
                <View style={{ flex: 1 }} />
                <ThemedText variant="caption" tone="placeholder">
                  {formatRelativeLabel(new Date(d.savedAt), new Date())}
                </ThemedText>
              </View>
              <ThemedText variant="body" style={{ marginTop: theme.spacing.s2 }}>
                {d.text}
              </ThemedText>
              {!d.isMine ? (
                <Pressable
                  onPress={() => handleToggleLike(d.id)}
                  hitSlop={8}
                  style={[
                    styles.likeBtn,
                    {
                      borderColor: d.isLiked ? theme.colors.point.p300 : theme.colors.line.base,
                      backgroundColor: d.isLiked ? theme.colors.point.p100 : 'transparent',
                    },
                  ]}
                >
                  <Icon
                    name="heart"
                    size={16}
                    color={d.isLiked ? theme.colors.point.p600 : theme.colors.ink.placeholder}
                  />
                  {d.likeCount > 0 ? (
                    <ThemedText
                      variant="caption"
                      style={{
                        color: d.isLiked ? theme.colors.point.p700 : theme.colors.ink.secondary,
                      }}
                    >
                      {d.likeCount}
                    </ThemedText>
                  ) : null}
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 12 },
  centerText: { textAlign: 'center', marginTop: 80 },
  card: { borderWidth: 1, paddingVertical: 16, paddingHorizontal: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { ...controlPresets.badge, borderRadius: 999 },
  likeBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...controlPresets.pill,
    borderWidth: 1,
    borderRadius: 999,
  },
});
