/**
 * 메인 — 오늘의 단어 기록하기 (서비스의 핵심 화면).
 *
 * 화면 구성 (PLANNING.md 5-1 / design-source/app/screens-main.jsx 참조):
 *   1. 날짜 표시    — calendar 아이콘 + 오늘 날짜 + '오늘' 뱃지 (항상 오늘 고정 —
 *                     과거 날짜 기록은 "현재를 기록한다" 의미가 퇴색되어 제거, 2026-07-09 팀 결정)
 *   2. Hero 단어    — "오늘의 단어" 캡션 + 큰 디스플레이 단어 + "이란" suffix + 다시 뽑기 버튼
 *   3. 입력 스테이지 — 카드 안의 multiline 입력창 + 안내 문구 + 글자 수
 *   4. 액션         — "단어 추가" (soft) + "기록 완료" (primary, 입력 비면 disabled)
 *
 * Task #7 범위에서는 핵심 루프(단어→입력→저장)만 작동.
 * 다음 단계로 별도 진행 예정:
 *   - 날짜 선택 캘린더 바텀시트 (현재는 안내 alert)
 *   - 커스텀 단어 입력 바텀시트 (현재는 안내 alert)
 *   - 저장 완료 마이크로 인터랙션 + 루비 적립 (현재는 단순 alert)
 *   - 실제 단어장 저장 (현재는 mock — 상태 초기화만)
 */
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { AppHeader } from '@/components/domain/app-header';
import { CustomWordSheet } from '@/components/domain/custom-word-sheet';
import { SaveConfirmation } from '@/components/domain/save-confirmation';
import { Button, Card } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECOMMENDED_WORDS } from '@/data/recommended-words';
import { Icon } from '@/icons';
import { MIN_DEFINITION_LENGTH } from '@/lib/definition';
import { formatKoreanDate } from '@/lib/format-date';
import { topicSuffix } from '@/lib/korean';
import { useEntryCountForWord, useJournalStore } from '@/store/journal-store';
import { controlPresets, useTheme } from '@/theme';

// 입력창 고정 높이(px). 처음부터 이 크기로 고정 — 타이핑에 따라 박스가 커지지 않아
// 화면이 출렁이지 않는다. 내용이 넘치면 입력창 내부에서 스크롤(캐럿=마지막 줄 따라감).
// 이 값이 탭바 위에 머물러 "기록 완료" 버튼이 밀려나지 않는 상한이기도 하다(뷰포트 664 기준).
const INPUT_HEIGHT = 200;

export default function RecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const addEntry = useJournalStore((s) => s.addEntry);

  // 단어 풀과 현재 인덱스. 진입 시 랜덤 1개 선택.
  // 사용자가 커스텀 단어를 추가할 수 있으므로 mutable.
  const [pool, setPool] = useState<string[]>(() => RECOMMENDED_WORDS.map((w) => w.word));
  const [wordIdx, setWordIdx] = useState(() => Math.floor(Math.random() * RECOMMENDED_WORDS.length));

  const [definition, setDefinition] = useState('');
  const [customSheetVisible, setCustomSheetVisible] = useState(false);

  // 저장 완료 마이크로 인터랙션 상태
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmedWord, setConfirmedWord] = useState('');
  // 방금 저장으로 이 단어가 몇 번째 정의가 됐는지 — 2 이상이면 완료 화면에서 리빌.
  const [confirmedCount, setConfirmedCount] = useState(1);

  // ─── Hero 단어 swap 트랜지션 — "차분히 떠오름": 이전 단어는 가라앉고, 새 단어가 아래에서 무게감 있게 안착 ───
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const heroTranslateY = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  /**
   * 단어를 부드럽게 바꾸는 공통 함수.
   * fade-out + 살짝 아래로 → 인덱스/풀 갱신 → fade-in.
   * @param nextIdx 새 단어 인덱스
   * @param poolUpdate 풀을 동시에 변경해야 할 때(addCustomWord)
   */
  const swapTo = useCallback(
    (nextIdx: number, poolUpdate?: (prev: string[]) => string[]) => {
      const applyChange = () => {
        if (poolUpdate) setPool(poolUpdate);
        setWordIdx(nextIdx);
      };

      if (reduceMotion) {
        applyChange();
        heroOpacity.setValue(1);
        heroTranslateY.setValue(0);
        heroScale.setValue(1);
        return;
      }

      // 이전 단어: 아래로 가라앉으며 사라짐.
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: 12, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        applyChange();
        // 새 단어: 아래에서 무게감 있게 떠올라 spring으로 안착(차분한 착지, 오버슛 최소).
        heroTranslateY.setValue(22);
        heroScale.setValue(0.96);
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.spring(heroTranslateY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
          Animated.spring(heroScale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
        ]).start();
      });
    },
    [heroOpacity, heroTranslateY, heroScale, reduceMotion],
  );

  const word = pool[wordIdx];
  // 이 단어의 기존 기록 수. 쓰는 동안엔 어떤 힌트도 노출하지 않는다(블라인드 쓰기 —
  // 재정의임을 알면 일부러 다르게/같게 쓰게 되므로). 저장 후 리빌에만 사용.
  const entryCount = useEntryCountForWord(word);
  const today = useMemo(() => new Date(), []);
  // 최소 20자 — 미달 시 "기록 완료" disabled + 카운터가 n/20자로 목표를 보여줌.
  const canSubmit = definition.trim().length >= MIN_DEFINITION_LENGTH;

  // 현재 단어와 다른 인덱스를 랜덤 선택 (풀에 단어 1개뿐일 경우 무동작).
  // swapTo로 부드러운 트랜지션과 함께 전환.
  function drawNewWord() {
    if (pool.length < 2) return;
    let next = wordIdx;
    while (next === wordIdx) {
      next = Math.floor(Math.random() * pool.length);
    }
    swapTo(next);
  }

  // 사용자 커스텀 단어 추가 — 풀 맨 앞에 넣고 그 단어로 즉시 swap.
  function addCustomWord(newWord: string) {
    swapTo(0, (prev) => [newWord, ...prev]);
  }

  function handleSave() {
    if (!canSubmit) return;
    Keyboard.dismiss();
    // 항상 현재 시각으로 저장 (과거 날짜 기록 제거 — 현재를 기록한다).
    const savedAt = new Date();
    // 변화 노트는 쓰기 시점에 받지 않는다 — 타임라인에서 길게 눌러 사후 기록.
    addEntry(word, definition.trim(), savedAt);
    setConfirmedWord(word);
    setConfirmedCount(entryCount + 1);
    setConfirmVisible(true);
    setDefinition('');
  }

  function handleConfirmDismiss() {
    setConfirmVisible(false);
    // 다음 단어 자연스럽게 이어가기 — design-source의 complete 흐름과 동일
    drawNewWord();
  }

  function openCustomWord() {
    setCustomSheetVisible(true);
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 0. 앱 헤더 (탭 공통) ─── */}
          <AppHeader />

          {/* ─── 1. 날짜 표시 (항상 오늘 — 선택 불가) ─── */}
          <View style={styles.dateChipWrap}>
            <View
              style={[
                styles.dateChip,
                {
                  backgroundColor: theme.colors.surface.base,
                  borderColor: theme.colors.line.base,
                },
                theme.shadows.sm,
              ]}
            >
              <Icon name="calendar" size={16} color={theme.colors.ink.secondary} />
              <ThemedText variant="sm" tone="strong">
                {formatKoreanDate(today)}
              </ThemedText>
              <View
                style={[
                  styles.todayBadge,
                  { backgroundColor: theme.colors.point.p050 },
                ]}
              >
                <ThemedText
                  variant="caption"
                  style={{ color: theme.colors.point.p600 }}
                >
                  오늘
                </ThemedText>
              </View>
            </View>
          </View>

          {/* ─── 2. Hero 단어 ─── */}
          <View style={[styles.hero, { marginTop: theme.spacing.s6 }]}>
            <ThemedText
              variant="caption"
              style={{
                color: theme.colors.point.p600,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              오늘의 단어
            </ThemedText>
            {/* 단어 자체만 swap 애니메이션 적용. 캡션과 버튼은 고정 위치 유지. */}
            <Animated.View
              style={[
                styles.heroWordRow,
                { marginTop: theme.spacing.s3 },
                {
                  opacity: heroOpacity,
                  transform: [{ translateY: heroTranslateY }, { scale: heroScale }],
                },
              ]}
            >
              {/* 단어 자체 — 가장 큰 폰트로 강조. display 토큰을 약간 키워 사용 */}
              <ThemedText
                style={{
                  ...theme.typography.display,
                  fontSize: 52,
                  letterSpacing: -1.5,
                }}
              >
                {word}
              </ThemedText>
              {/* "이란" suffix — 흐린 톤 + 살짝 가벼운 weight */}
              <ThemedText
                style={{
                  ...theme.typography.display,
                  fontSize: 52,
                  color: theme.colors.ink.placeholder,
                  fontWeight: '600',
                }}
              >
                {topicSuffix(word)}
              </ThemedText>
            </Animated.View>
            <Button
              label="새로운 단어 뽑기"
              variant="ghost"
              size="sm"
              leftIcon={<Icon name="shuffle" size={15} color={theme.colors.point.p600} />}
              onPress={drawNewWord}
              style={{ marginTop: theme.spacing.s5 }}
            />
          </View>

          {/* ─── 3. 입력 스테이지 ─── */}
          {/* Card 보더가 이미 있으므로 안쪽 TextInput은 borderless로. */}
          <Card
            style={{ marginTop: theme.spacing.s8 }}
            radius="lg"
            elevation="sm"
            padded={false}
          >
            <View style={{ padding: theme.spacing.s5 }}>
              <TextInput
                multiline
                value={definition}
                onChangeText={setDefinition}
                placeholder={`나에게 ${word}${topicSuffix(word)}…`}
                placeholderTextColor={theme.colors.ink.placeholder}
                style={[
                  styles.definitionInput,
                  {
                    color: theme.colors.ink.primary,
                    fontFamily: 'PretendardVariable',
                  },
                ]}
              />
              <View
                style={[
                  styles.inputFoot,
                  {
                    borderTopColor: theme.colors.line.base,
                    marginTop: theme.spacing.s3,
                    paddingTop: theme.spacing.s3,
                  },
                ]}
              >
                <ThemedText variant="caption" tone="placeholder">
                  나만의 정의를 찬찬히 적어보세요 · {MIN_DEFINITION_LENGTH}자 이상
                </ThemedText>
                <ThemedText variant="caption" tone="placeholder">
                  {canSubmit
                    ? `${definition.length}자`
                    : `${definition.trim().length}/${MIN_DEFINITION_LENGTH}자`}
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* 변화 노트 입력은 제거됨 — 재정의 여부를 쓰는 동안 알려주는 유일한 신호였고,
              인지하는 순간 기록이 오염된다(블라인드 쓰기, 2026-07-17 결정). 사후 기록은
              단어 상세 타임라인의 "변화 노트 추가"로. */}

          {/* ─── 4. 액션 ─── */}
          <View style={[styles.actions, { marginTop: theme.spacing.s4 }]}>
            <Button
              label="단어 추가"
              variant="soft"
              leftIcon={<Icon name="plus" size={16} color={theme.colors.point.p700} />}
              onPress={openCustomWord}
            />
            {/* 기록 완료 — 가용 너비를 채우는 강조 액션. 입력 비면 disabled */}
            <View style={styles.fillerButton}>
              <Button
                label="기록 완료"
                onPress={handleSave}
                disabled={!canSubmit}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 저장 완료 연출. 재정의였다면 여기서 처음으로 공개(N번째 정의) — 탭하면 타임라인으로. */}
      <SaveConfirmation
        visible={confirmVisible}
        word={confirmedWord}
        count={confirmedCount}
        onDismiss={handleConfirmDismiss}
        onViewTimeline={() => {
          setConfirmVisible(false);
          drawNewWord();
          router.push({ pathname: '/journal/[word]', params: { word: confirmedWord } });
        }}
      />

      {/* 커스텀 단어 추가 시트 — "단어 추가" 액션으로 열림. 완료 시 풀 추가 + 그 단어로 swap. */}
      <CustomWordSheet
        visible={customSheetVisible}
        onAdd={addCustomWord}
        onClose={() => setCustomSheetVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },

  dateChipWrap: { alignItems: 'center' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    ...controlPresets.chip,
  },
  todayBadge: {
    ...controlPresets.badge,
    borderRadius: 999,
  },

  hero: { alignItems: 'center' },
  heroWordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  definitionInput: {
    height: INPUT_HEIGHT, // 고정 — 넘치면 내부 스크롤(auto-grow 안 함)
    fontSize: 18,
    lineHeight: 30,
    textAlignVertical: 'top', // Android 상단 정렬
  },
  inputFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fillerButton: { flex: 1 }, // 기록 완료 버튼이 행의 남은 공간을 채우게
});
