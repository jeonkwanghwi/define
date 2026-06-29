/**
 * 과거의 나 (tab3 회상 홈) — 잠금(단어 20개) → 동의 1회 → 시절 필터 → 채팅 진입.
 * 가입 필요 탭(AuthGate). 채팅은 별도 풀스크린 라우트 /recall-chat.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AuthGate } from '@/components/domain/auth-gate';
import { RecallConsentSheet } from '@/components/domain/recall-consent-sheet';
import { Button } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import {
  availableAges,
  availableYears,
  countForAge,
  countForYear,
} from '@/lib/recall-range';
import { recallConsent } from '@/services/recall-api';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStats, useJournalStore } from '@/store/journal-store';
import { useTheme } from '@/theme';

const UNLOCK_WORDS = 20;

export default function PastScreen() {
  return (
    <AuthGate
      icon="past"
      title="과거의 나"
      description="과거의 정의로 '그때의 나'와 대화해요. 가입하면 만날 수 있어요."
    >
      <RecallHome />
    </AuthGate>
  );
}

function RecallHome() {
  const theme = useTheme();
  const router = useRouter();
  const { uniqueWords } = useJournalStats();
  const entries = useJournalStore((s) => s.entries);
  const token = useAuthStore((s) => s.token);
  const birthYear = useAuthStore((s) => s.user?.birthYear ?? null);
  const recallConsented = useAuthStore((s) => s.user?.recallConsented ?? false);
  const setRecallConsented = useAuthStore((s) => s.setRecallConsented);

  const [consentOpen, setConsentOpen] = useState(false);
  const [mode, setMode] = useState<'age' | 'year'>('age');
  const [selAge, setSelAge] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);

  const ages = useMemo(() => availableAges(entries, birthYear), [entries, birthYear]);
  const years = useMemo(() => availableYears(entries), [entries]);

  // ── 잠금: 서로 다른 단어 20개 미만 ──
  if (uniqueWords < UNLOCK_WORDS) {
    return (
      <ThemedView bg="paper" style={styles.center}>
        <Icon name="lock" size={48} color={theme.colors.ink.placeholder} />
        <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
          과거의 나를 만나려면
        </ThemedText>
        <ThemedText
          variant="body"
          tone="secondary"
          style={{ marginTop: theme.spacing.s2, textAlign: 'center', lineHeight: 24 }}
        >
          서로 다른 단어 {UNLOCK_WORDS}개를 모으면 그 시절의 나와 대화할 수 있어요.
        </ThemedText>
        <ThemedText
          variant="h2"
          style={{ marginTop: theme.spacing.s5, color: theme.colors.point.p600 }}
        >
          {uniqueWords} / {UNLOCK_WORDS}
        </ThemedText>
      </ThemedView>
    );
  }

  const handleConsent = async () => {
    setConsentOpen(false);
    if (!token) return;
    try {
      await recallConsent(token);
      setRecallConsented();
    } catch (e) {
      console.warn('[recall] 동의 기록 실패:', e);
    }
  };

  const startChat = () => {
    if (mode === 'age' && selAge != null) {
      router.push({
        pathname: '/recall-chat',
        params: { label: `${selAge}살의 나`, age: String(selAge) },
      });
    } else if (mode === 'year' && selYear != null) {
      router.push({
        pathname: '/recall-chat',
        params: {
          label: `${selYear}년의 나`,
          periodStart: `${selYear}-01-01`,
          periodEnd: `${selYear}-12-31`,
        },
      });
    }
  };

  const sliceCount =
    mode === 'age'
      ? selAge != null
        ? countForAge(entries, birthYear, selAge)
        : 0
      : selYear != null
        ? countForYear(entries, selYear)
        : 0;
  const canStart = sliceCount > 0;

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText variant="h2">과거의 나</ThemedText>
        <ThemedText variant="caption" tone="placeholder" style={{ marginTop: 4 }}>
          이 기능은 생성형 AI를 활용해요
        </ThemedText>

        {/* 시절 선택 세그먼트 */}
        <View style={[styles.segment, { marginTop: theme.spacing.s5 }]}>
          {(['age', 'year'] as const).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.segItem,
                  {
                    backgroundColor: active ? theme.colors.point.p600 : theme.colors.surface.base,
                    borderColor: theme.colors.line.base,
                  },
                ]}
              >
                <ThemedText
                  variant="bodyMd"
                  style={{ color: active ? theme.colors.paper.base : theme.colors.ink.secondary }}
                >
                  {m === 'age' ? '나이로' : '연도로'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* 칩 목록 */}
        <View style={[styles.chips, { marginTop: theme.spacing.s4 }]}>
          {mode === 'age'
            ? ages.length === 0
              ? <ThemedText variant="body" tone="placeholder">출생연도가 없거나 기록이 없어요.</ThemedText>
              : ages.map((a) => {
                  const active = selAge === a;
                  return (
                    <Pressable
                      key={a}
                      onPress={() => setSelAge(a)}
                      style={[styles.chip, { borderColor: active ? theme.colors.point.p600 : theme.colors.line.base, backgroundColor: active ? theme.colors.point.p050 : theme.colors.surface.base }]}
                    >
                      <ThemedText variant="bodyMd" style={{ color: active ? theme.colors.point.p700 : theme.colors.ink.primary }}>
                        {a}살
                      </ThemedText>
                    </Pressable>
                  );
                })
            : years.map((y) => {
                const active = selYear === y;
                return (
                  <Pressable
                    key={y}
                    onPress={() => setSelYear(y)}
                    style={[styles.chip, { borderColor: active ? theme.colors.point.p600 : theme.colors.line.base, backgroundColor: active ? theme.colors.point.p050 : theme.colors.surface.base }]}
                  >
                    <ThemedText variant="bodyMd" style={{ color: active ? theme.colors.point.p700 : theme.colors.ink.primary }}>
                      {y}년
                    </ThemedText>
                  </Pressable>
                );
              })}
        </View>

        {sliceCount > 0 && (
          <ThemedText variant="caption" tone="placeholder" style={{ marginTop: theme.spacing.s3 }}>
            그 시절 기록 {sliceCount}개
          </ThemedText>
        )}
      </ScrollView>

      {/* CTA — 비용 명시 */}
      <View style={[styles.cta, { borderTopColor: theme.colors.line.base }]}>
        <Button
          label={`과거의 나 만나기 · ${RECALL_COST}잉크`}
          disabled={!canStart}
          onPress={() => {
            if (!recallConsented) setConsentOpen(true);
            else startChat();
          }}
        />
      </View>

      <RecallConsentSheet
        visible={consentOpen}
        onConsent={handleConsent}
        onClose={() => setConsentOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  segment: { flexDirection: 'row', gap: 8 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  cta: { padding: 16, borderTopWidth: 1 },
});
