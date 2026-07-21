/**
 * 과거의 나 (tab3 회상 홈) — 잠금(단어 20개) → 동의 1회 → 시절 필터 → 채팅 진입.
 * 가입 필요 탭(AuthGate). 채팅은 별도 풀스크린 라우트 /recall-chat.
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { RecallConsentSheet } from '@/components/domain/recall-consent-sheet';
import { Button, Card, PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import {
  availableAges,
  availableYears,
  countForAge,
  countForYear,
  pickRandomQuestionTarget,
} from '@/lib/recall-range';
import { recallConsent } from '@/services/recall-api';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStats, useJournalStore } from '@/store/journal-store';
import { motion, typography, useTheme, type Theme } from '@/theme';

const UNLOCK_WORDS = 20;

export default function PastScreen() {
  return (
    <AuthGate
      icon="past"
      title="회상"
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
  const [convoMode, setConvoMode] = useState<'free' | 'question'>('free');
  const [mode, setMode] = useState<'age' | 'year'>('age');
  const [selAge, setSelAge] = useState<number | null>(null);
  const [selYear, setSelYear] = useState<number | null>(null);

  const ages = useMemo(() => availableAges(entries, birthYear), [entries, birthYear]);
  const years = useMemo(() => availableYears(entries), [entries]);

  // ── 잠금: 서로 다른 단어 20개 미만 ──
  if (uniqueWords < UNLOCK_WORDS) {
    return (
      <ThemedView bg="paper" style={{ flex: 1 }}>
        <View style={styles.headerWrap}>
          <AppHeader />
        </View>
        <View style={styles.center}>
          <Icon name="lock" size={48} color={theme.colors.ink.placeholder} />
          <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
            회상을 시작하려면
          </ThemedText>
          <ThemedText
            variant="body"
            tone="secondary"
            style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
          >
            서로 다른 단어 {UNLOCK_WORDS}개를 모으면 그 시절의 나와 대화할 수 있어요.
          </ThemedText>
          <ThemedText
            variant="h2"
            style={{ marginTop: theme.spacing.s5, color: theme.colors.point.p600 }}
          >
            {uniqueWords} / {UNLOCK_WORDS}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const handleConsent = async () => {
    setConsentOpen(false);
    if (!token) return;
    try {
      await recallConsent(token);
      setRecallConsented();
      // 동의는 "시작하기"를 누른 흐름의 중간 관문 — 기록됐으면 원래 의도(대화 시작)로 이어간다.
      // (기존엔 시트만 닫혀 시작 버튼을 한 번 더 눌러야 했음.)
      if (convoMode === 'question') startQuestion();
      else startChat();
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

  const startQuestion = () => {
    const target = pickRandomQuestionTarget(entries);
    if (!target) return;
    router.push({
      pathname: '/recall-chat',
      params: {
        label: target.label,
        periodStart: target.periodStart,
        periodEnd: target.periodEnd,
        mode: 'question',
        focusWord: target.focusWord,
      },
    });
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
        <AppHeader />
        <ThemedText variant="h2">회상</ThemedText>
        <ThemedText variant="caption" tone="placeholder" style={{ marginTop: 4 }}>
          이 기능은 생성형 AI를 활용해요
        </ThemedText>

        {/* 대화 방식 */}
        <SectionLabel text="대화 방식" />
        <View style={styles.segment}>
          {(['free', 'question'] as const).map((cm) => {
            const active = convoMode === cm;
            return (
              <AnimatedPill
                key={cm}
                grow
                active={active}
                onPress={() => setConvoMode(cm)}
                style={styles.segItem}
                colors={{
                  bgOff: theme.colors.surface.base,
                  bgOn: theme.colors.point.p600,
                  borderOff: theme.colors.line.base,
                  borderOn: theme.colors.line.base,
                  textOff: theme.colors.ink.secondary,
                  textOn: theme.colors.paper.base,
                }}
              >
                {cm === 'free' ? '자유롭게 대화' : '질문 받기'}
              </AnimatedPill>
            );
          })}
        </View>

        {convoMode === 'question' && (
          <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s4 }}>
            랜덤한 시기의 내가 그때 적은 단어 하나로 먼저 물어봐요. 시기는 고르지 않아요.
          </ThemedText>
        )}

        {convoMode === 'free' && (
          <>
            {/* 시절 선택 */}
            <SectionLabel text="어느 시절의 나" />
            <View style={styles.segment}>
              {(['age', 'year'] as const).map((m) => {
                const active = mode === m;
                return (
                  <AnimatedPill
                    key={m}
                    grow
                    active={active}
                    onPress={() => setMode(m)}
                    style={styles.segItem}
                    colors={{
                      bgOff: theme.colors.surface.base,
                      bgOn: theme.colors.point.p600,
                      borderOff: theme.colors.line.base,
                      borderOn: theme.colors.line.base,
                      textOff: theme.colors.ink.secondary,
                      textOn: theme.colors.paper.base,
                    }}
                  >
                    {m === 'age' ? '나이로' : '연도로'}
                  </AnimatedPill>
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
                        <AnimatedPill
                          key={a}
                          active={active}
                          onPress={() => setSelAge(a)}
                          style={styles.chip}
                          colors={chipColors(theme)}
                        >
                          {`${a}살`}
                        </AnimatedPill>
                      );
                    })
                : years.map((y) => {
                    const active = selYear === y;
                    return (
                      <AnimatedPill
                        key={y}
                        active={active}
                        onPress={() => setSelYear(y)}
                        style={styles.chip}
                        colors={chipColors(theme)}
                      >
                        {`${y}년`}
                      </AnimatedPill>
                    );
                  })}
            </View>

            {sliceCount > 0 && (
              <ThemedText variant="caption" tone="placeholder" style={{ marginTop: theme.spacing.s3 }}>
                그 시절 기록 {sliceCount}개
              </ThemedText>
            )}
          </>
        )}

        {/* 안내 카드 — 빈 중앙 공간을 조용한 설명으로. */}
        <Card style={{ marginTop: theme.spacing.s8 }} radius="lg" elevation="sm">
          <View style={styles.infoHead}>
            <Icon name="sparkle" size={16} color={theme.colors.point.p600} />
            <ThemedText variant="bodyMd" style={{ color: theme.colors.point.p600 }}>
              회상은 이렇게 만들어져요
            </ThemedText>
          </View>
          <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
            그 시절에 남긴 단어와 정의로 그때의 나를 되살려요. 시절을 고르고 말을
            걸어보세요. 대화 한 번에 {RECALL_COST}잉크가 쓰여요.
          </ThemedText>
        </Card>
      </ScrollView>

      {/* CTA — 비용 명시 */}
      <View style={[styles.cta, { borderTopColor: theme.colors.line.base }]}>
        <Button
          label={
            convoMode === 'question'
              ? `질문 받기 · ${RECALL_COST}잉크`
              : `회상 시작하기 · ${RECALL_COST}잉크`
          }
          disabled={convoMode === 'free' && !canStart}
          onPress={() => {
            if (!recallConsented) {
              setConsentOpen(true);
            } else if (convoMode === 'question') {
              startQuestion();
            } else {
              startChat();
            }
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

/** 섹션 라벨 — 마이페이지와 동일한 소문자 캡션 스타일. 선택지 그룹의 역할 구분용. */
function SectionLabel({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <ThemedText
      variant="caption"
      style={{
        color: theme.colors.point.p600,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginTop: theme.spacing.s6,
        marginBottom: theme.spacing.s3,
      }}
    >
      {text}
    </ThemedText>
  );
}

/**
 * 선택 상태(active)가 바뀔 때 배경·테두리·글자색이 툭 바뀌지 않고 부드럽게 전환되는 알약.
 * PressableScale로 눌림 피드백은 유지하고, 색 전환만 Animated로 보간(fast, ease-out).
 * grow=true면 세그먼트처럼 가로를 꽉 채우고, 기본은 칩처럼 내용 크기.
 */
type PillColors = {
  bgOff: string;
  bgOn: string;
  borderOff: string;
  borderOn: string;
  textOff: string;
  textOn: string;
};

/** 나이/연도 칩 색 세트 — 선택 시 옅은 point 배경 + point 테두리. */
function chipColors(theme: Theme): PillColors {
  return {
    bgOff: theme.colors.surface.base,
    bgOn: theme.colors.point.p050,
    borderOff: theme.colors.line.base,
    borderOn: theme.colors.point.p600,
    textOff: theme.colors.ink.primary,
    textOn: theme.colors.point.p700,
  };
}

function AnimatedPill({
  active,
  onPress,
  style,
  colors,
  grow,
  children,
}: {
  active: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  colors: PillColors;
  grow?: boolean;
  children: string;
}) {
  const p = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: active ? 1 : 0,
      duration: motion.duration.fast,
      easing: motion.easing.standard,
      useNativeDriver: false, // 색 보간은 네이티브 드라이버 미지원
    }).start();
  }, [active, p]);

  const backgroundColor = p.interpolate({ inputRange: [0, 1], outputRange: [colors.bgOff, colors.bgOn] });
  const borderColor = p.interpolate({ inputRange: [0, 1], outputRange: [colors.borderOff, colors.borderOn] });
  const color = p.interpolate({ inputRange: [0, 1], outputRange: [colors.textOff, colors.textOn] });

  return (
    <PressableScale onPress={onPress} style={grow ? styles.grow : undefined}>
      <Animated.View style={[style, { backgroundColor, borderColor }]}>
        <Animated.Text style={[typography.bodyMd, { color, textAlign: 'center' }]}>
          {children}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 24, paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  segment: { flexDirection: 'row', gap: 8 },
  grow: { flex: 1 },
  segItem: { alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cta: { padding: 16, borderTopWidth: 1 },
});
