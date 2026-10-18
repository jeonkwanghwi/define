/**
 * 과거의 나 (tab3 회상 홈) — 잠금(단어 20개) → 동의 1회 → 시절 필터 → 채팅 진입.
 * 가입 필요 탭(AuthGate). 채팅은 별도 풀스크린 라우트 /recall-chat.
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/domain/app-header';
import { AuthGate } from '@/components/domain/auth-gate';
import { ChoiceChip } from '@/components/domain/choice-chip';
import { RecallConsentSheet } from '@/components/domain/recall-consent-sheet';
import { WatchAdButton } from '@/components/domain/watch-ad-button';
import { Button, Card, SegmentedControl, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECALL_COST } from '@/constants/recall';
import { Icon } from '@/icons';
import { hapticSuccess } from '@/lib/haptics';
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
import { motion, useTheme } from '@/theme';

const UNLOCK_WORDS = 20;

export default function PastScreen() {
  // 가입만으로 열리는 게 아니다 — 진짜 조건(단어 20개)과 지금 위치를 먼저 말한다. 로컬 기록이라 오프라인에서도 센다.
  const { uniqueWords } = useJournalStats();
  return (
    <AuthGate
      icon="past"
      title="회상"
      description={`단어 ${UNLOCK_WORDS}개를 모으면\n그때의 나와 이야기할 수 있어요.\n지금 ${Math.min(uniqueWords, UNLOCK_WORDS)}/${UNLOCK_WORDS}`}
    >
      <RecallHome />
    </AuthGate>
  );
}

/**
 * 잠금 화면 — 관문은 포인트 색(다른 게이트와 같은 말). 숫자만 있으면 "얼마나 남았나"가 안 읽혀
 * 진행 막대로 보여주고, 할 일(단어 정의)로 바로 가는 버튼을 둔다(막다른 길 금지).
 */
function RecallLocked({ count }: { count: number }) {
  const theme = useTheme();
  const router = useRouter();
  const ratio = Math.min(count, UNLOCK_WORDS) / UNLOCK_WORDS;
  // 막대는 0에서 지금 위치까지 스르륵 차오른다 — 너비는 네이티브 드라이버 불가라 JS 구동.
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, {
      toValue: ratio,
      duration: motion.duration.slow * 2,
      easing: motion.easing.standard,
      useNativeDriver: false,
    }).start();
  }, [fill, ratio]);

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      <View style={styles.headerWrap}>
        <AppHeader />
      </View>
      <View style={styles.center}>
        <Icon name="lock" size={48} color={theme.colors.point.p600} />
        <ThemedText variant="h3" style={{ marginTop: theme.spacing.s4 }}>
          회상을 시작하려면
        </ThemedText>
        {/* 한 줄로 두면 좁은 폭에서 낱말 중간이 끊긴다 → 뜻 단위로 직접 줄을 나눈다. */}
        <ThemedText
          variant="body"
          tone="secondary"
          style={{ marginTop: theme.spacing.s2, textAlign: 'center' }}
        >
          {`서로 다른 단어 ${UNLOCK_WORDS}개를 모으면\n그 시절의 나와 대화할 수 있어요.`}
        </ThemedText>
        <ThemedText
          variant="h2"
          style={{ marginTop: theme.spacing.s5, color: theme.colors.point.p600 }}
        >
          {count} / {UNLOCK_WORDS}
        </ThemedText>
        <View
          style={[styles.track, { backgroundColor: theme.colors.point.p100, marginTop: theme.spacing.s3 }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: UNLOCK_WORDS, now: count }}
        >
          <Animated.View
            style={[
              styles.trackFill,
              {
                backgroundColor: theme.colors.point.p600,
                width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <Button
          label="단어 정의하러 가기"
          onPress={() => router.push('/')}
          style={{ marginTop: theme.spacing.s6 }}
        />
      </View>
    </ThemedView>
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
  const balance = useAuthStore((s) => s.user?.balance ?? 0);
  const setRecallConsented = useAuthStore((s) => s.setRecallConsented);
  const { show } = useToast();

  const [consentOpen, setConsentOpen] = useState(false);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [convoMode, setConvoMode] = useState<'free' | 'question'>('free');
  // null = 아직 안 골랐다. 그동안은 아래에서 기본값(가장 최근 시절)을 대신 쓴다.
  const [pickedMode, setMode] = useState<'age' | 'year' | null>(null);
  const [pickedAge, setSelAge] = useState<number | null>(null);
  const [pickedYear, setSelYear] = useState<number | null>(null);

  const ages = useMemo(() => availableAges(entries, birthYear), [entries, birthYear]);
  const years = useMemo(() => availableYears(entries), [entries]);

  /**
   * 들어오자마자 시작할 수 있게 **가장 최근 시절을 미리 골라 둔다.**
   * 전엔 아무것도 안 골라진 채 시작 버튼이 회색이라, 왜 못 누르는지 알 수 없었다.
   * 출생연도가 없어 나이 목록이 비면 처음부터 '연도로'를 보여준다(막다른 길을 첫 화면으로 두지 않는다).
   */
  const mode = pickedMode ?? (ages.length > 0 ? 'age' : 'year');
  const selAge = pickedAge ?? ages[ages.length - 1] ?? null; // 오름차순 → 마지막이 최근
  const selYear = pickedYear ?? years[0] ?? null; // 내림차순 → 첫 번째가 최근

  // ── 잠금: 서로 다른 단어 20개 미만 ──
  if (uniqueWords < UNLOCK_WORDS) {
    return <RecallLocked count={uniqueWords} />;
  }

  const handleConsent = async () => {
    if (!token || consentSubmitting) return;
    // 시트를 **먼저 닫지 않는다.** 닫고 나서 서버를 부르면, 실패했을 때
    // 사용자에겐 "눌렀는데 아무 일도 안 일어난" 화면만 남는다.
    setConsentSubmitting(true);
    setConsentError(null);
    try {
      await recallConsent(token);
      setRecallConsented();
      setConsentOpen(false);
      // 한 번만 하는 동의라 "됐다"를 분명히 알린다(실패는 위 catch가 인라인으로 맡는다).
      hapticSuccess();
      show('이제 과거의 나와 이야기할 수 있어요');
      // 동의는 "시작하기"를 누른 흐름의 중간 관문 — 기록됐으면 원래 의도(대화 시작)로 이어간다.
      // (기존엔 시트만 닫혀 시작 버튼을 한 번 더 눌러야 했음.)
      if (convoMode === 'question') startQuestion();
      else startChat();
    } catch (e) {
      console.warn('[recall] 동의 기록 실패:', e);
      setConsentError('잠시 후 다시 시도해 주세요.');
    } finally {
      setConsentSubmitting(false);
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
  // 잔액은 서버가 마지막으로 알려준 값. 모자라면 대화 화면에 들어가서야 알게 하지 않고 여기서 말한다.
  const inkShort = balance < RECALL_COST;

  return (
    <ThemedView bg="paper" style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppHeader />
        {/* 제목 모양은 광장·단어장과 같게(h1 + 본문 부제). AI 안내는 부제에 녹인다. */}
        <ThemedText variant="h1">회상</ThemedText>
        <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s2 }}>
          생성형 AI로 그 시절의 나와 이야기해요
        </ThemedText>

        {/* 대화 방식 — 둘 중 하나를 고르는 자리라 SegmentedControl(테마 토글과 같은 모양) */}
        <SectionLabel text="대화 방식" />
        <SegmentedControl
          options={[
            { value: 'free', label: '자유롭게 대화' },
            { value: 'question', label: '질문 받기' },
          ]}
          value={convoMode}
          onChange={setConvoMode}
        />

        {convoMode === 'question' && (
          <ThemedText variant="body" tone="secondary" style={{ marginTop: theme.spacing.s4 }}>
            랜덤한 시기의 내가 그때 적은 단어 하나로 먼저 물어봐요. 시기는 고르지 않아요.
          </ThemedText>
        )}

        {convoMode === 'free' && (
          <>
            {/* 시절 선택 */}
            <SectionLabel text="어느 시절의 나" />
            <SegmentedControl
              options={[
                { value: 'age', label: '나이로' },
                { value: 'year', label: '연도로' },
              ]}
              value={mode}
              onChange={setMode}
            />

            {/* 칩 목록 */}
            <View style={[styles.chips, { marginTop: theme.spacing.s4 }]}>
              {mode === 'age'
                ? ages.length === 0
                  ? (
                    // 막다른 길로 두지 않는다 — 갈 수 있는 길(연도)을 버튼으로 바로 건넨다.
                    <View style={{ gap: theme.spacing.s3, alignItems: 'flex-start' }}>
                      <ThemedText variant="body" tone="placeholder">
                        {birthYear == null
                          ? '출생연도가 없어 나이로는 고를 수 없어요.'
                          : '나이로 고를 기록이 없어요.'}
                      </ThemedText>
                      <Button
                        label="연도로 고르기"
                        variant="ghost"
                        size="sm"
                        onPress={() => setMode('year')}
                      />
                    </View>
                  )
                  : ages.map((a) => (
                      <ChoiceChip
                        key={a}
                        label={`${a}살`}
                        selected={selAge === a}
                        onPress={() => setSelAge(a)}
                      />
                    ))
                : years.map((y) => (
                    <ChoiceChip
                      key={y}
                      label={`${y}년`}
                      selected={selYear === y}
                      onPress={() => setSelYear(y)}
                    />
                  ))}
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
            걸어보세요. 대화 한 번에 잉크 {RECALL_COST}개가 쓰여요.
          </ThemedText>
        </Card>
      </ScrollView>

      {/* CTA — 비용 명시 */}
      <View style={[styles.cta, { borderTopColor: theme.colors.line.base }]}>
        {/* 회색 버튼만 두면 왜 못 누르는지 모른다 — 이유를 바로 위에 한 줄로. */}
        {!inkShort && convoMode === 'free' && !canStart ? (
          <ThemedText
            variant="caption"
            tone="secondary"
            style={{ textAlign: 'center', marginBottom: theme.spacing.s2 }}
          >
            위에서 시절을 골라주세요
          </ThemedText>
        ) : null}
        <Button
          label={
            inkShort
              ? `잉크가 부족해요 · 잉크 ${RECALL_COST}개 필요`
              : convoMode === 'question'
                ? `질문 받기 · 잉크 ${RECALL_COST}개`
                : `회상 시작하기 · 잉크 ${RECALL_COST}개`
          }
          // 잉크 부족은 안내만 하고 막지 않는다 — 기기의 잔액은 늦게 반영될 수 있어서(광고 보상 지연·다른 기기)
          // 실제로는 충분한데 버튼이 잠길 수 있다. 진짜 판정은 서버가 한다(부족하면 402 → 대화 화면이 안내).
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
        {/* 모자라면 바로 채울 길을 같은 자리에 — 가장 필요한 순간이다. */}
        {inkShort ? <WatchAdButton style={{ marginTop: theme.spacing.s3 }} /> : null}
      </View>

      <RecallConsentSheet
        visible={consentOpen}
        onConsent={handleConsent}
        submitting={consentSubmitting}
        error={consentError}
        onClose={() => {
          if (consentSubmitting) return; // 전송 중엔 닫히지 않게
          setConsentError(null);
          setConsentOpen(false);
        }}
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
      // 누를 수 없는 제목이라 포인트색을 쓰지 않는다 — 바로 아래 선택된 세그먼트(포인트)와 겹쳐 보였다.
      style={{
        color: theme.colors.ink.secondary,
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

const styles = StyleSheet.create({
  headerWrap: { paddingHorizontal: 24, paddingTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  track: { width: '100%', maxWidth: 240, height: 6, borderRadius: 3, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 3 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cta: { padding: 16, borderTopWidth: 1 },
});
