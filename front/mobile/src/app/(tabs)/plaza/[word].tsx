/**
 * 광장 단어 상세 — 한 단어에 대한 여러 사람의 정의 카드.
 *
 * 동적 라우트: /plaza/{word}. useLocalSearchParams로 word 받음(journal [word] 패턴).
 * 서버에서 정의 목록을 받아 표시. 내 정의(isMine)는 맨 위 + 포인트 강조 + "내 정의" 배지.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { formatRelativeLabel } from '@/lib/format-date';
import { getPlazaWord, type PlazaWordDetail } from '@/services/plaza-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function PlazaWordDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
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

  return (
    <ThemedView bg="paper" style={styles.root}>
      {/* 헤더 */}
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
          <Icon name="back" size={22} color={theme.colors.ink.strong} />
        </Pressable>
        <ThemedText variant="h3" style={{ flex: 1, textAlign: 'center' }}>
          {word}
        </ThemedText>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {failed ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            정의를 불러오지 못했어요.
          </ThemedText>
        ) : data === null ? (
          <ThemedText variant="body" tone="secondary" style={styles.centerText}>
            불러오는 중…
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
              <ThemedText variant="body" style={{ marginTop: theme.spacing.s2, lineHeight: 24 }}>
                {d.text}
              </ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 12 },
  centerText: { textAlign: 'center', marginTop: 80 },
  card: { borderWidth: 1, paddingVertical: 16, paddingHorizontal: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999 },
});
