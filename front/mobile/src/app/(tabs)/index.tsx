/**
 * 메인 — 오늘의 단어 기록하기 (서비스의 핵심 화면).
 *
 * 화면 구성 (PLANNING.md 5-1 / design-source/app/screens-main.jsx 참조):
 *   1. 날짜 칩      — calendar 아이콘 + 한글 날짜 + (오늘이면 '오늘' 뱃지) + chevronD
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
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { CustomWordSheet } from '@/components/domain/custom-word-sheet';
import { DateSheet } from '@/components/domain/date-sheet';
import { SaveConfirmation } from '@/components/domain/save-confirmation';
import { Button, Card } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RECOMMENDED_WORDS } from '@/data/recommended-words';
import { Icon } from '@/icons';
import { formatKoreanDate, isSameDay } from '@/lib/format-date';
import { useEntryCountForWord, useJournalStore } from '@/store/journal-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function RecordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const addEntry = useJournalStore((s) => s.addEntry);
  const nickname = useSettingsStore((s) => s.nickname);

  // 단어 풀과 현재 인덱스. 진입 시 랜덤 1개 선택.
  // 사용자가 커스텀 단어를 추가할 수 있으므로 mutable.
  const [pool, setPool] = useState<string[]>(() => [...RECOMMENDED_WORDS]);
  const [wordIdx, setWordIdx] = useState(() => Math.floor(Math.random() * RECOMMENDED_WORDS.length));

  const [definition, setDefinition] = useState('');
  // 재정의(과거 기록 있는 단어)일 때만 쓰는 "이전과 달라진 점" 선택 메모.
  const [changeNote, setChangeNote] = useState('');
  // 기본은 오늘. 사용자가 칩 탭하면 DateSheet에서 변경 가능 (미래는 불가).
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dateSheetVisible, setDateSheetVisible] = useState(false);
  const [customSheetVisible, setCustomSheetVisible] = useState(false);

  // 저장 완료 마이크로 인터랙션 상태
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmedWord, setConfirmedWord] = useState('');

  // ─── Hero 단어 swap 트랜지션 (UX: 즉시 변경 X — 짧은 fade + translateY) ───
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const heroTranslateY = useRef(new Animated.Value(0)).current;

  /**
   * 단어를 부드럽게 바꾸는 공통 함수.
   * fade-out + 살짝 아래로 → 인덱스/풀 갱신 → fade-in.
   * @param nextIdx 새 단어 인덱스
   * @param poolUpdate 풀을 동시에 변경해야 할 때(addCustomWord)
   */
  const swapTo = useCallback(
    (nextIdx: number, poolUpdate?: (prev: string[]) => string[]) => {
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(heroTranslateY, { toValue: 8, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        if (poolUpdate) setPool(poolUpdate);
        setWordIdx(nextIdx);
        // 단어가 바뀌면 이전 단어용 변화 메모는 의미 없으므로 초기화
        setChangeNote('');
        Animated.parallel([
          Animated.timing(heroOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(heroTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      });
    },
    [heroOpacity, heroTranslateY],
  );

  const word = pool[wordIdx];
  // 이 단어를 전에도 정의했는가 → 그렇다면 "생각의 변화" 메모를 받는다.
  const isRedefinition = useEntryCountForWord(word) > 0;
  const today = useMemo(() => new Date(), []);
  const isTodaySelected = isSameDay(selectedDate, today);
  const canSubmit = definition.trim().length > 0;

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
    // 오늘이면 정확한 현재 시각으로 저장 (정렬에 의미 있음).
    // 과거 날짜를 골랐다면 그 Date(시각 0:00)를 그대로 → 표시상은 그 날.
    const savedAt = isTodaySelected ? new Date() : selectedDate;
    // 재정의일 때만 메모 전달. 빈 값은 store에서 undefined로 정규화됨.
    addEntry(word, definition.trim(), savedAt, isRedefinition ? changeNote : undefined);
    setConfirmedWord(word);
    setConfirmVisible(true);
    setDefinition('');
    setChangeNote('');
  }

  function handleConfirmDismiss() {
    setConfirmVisible(false);
    // 다음 단어 자연스럽게 이어가기 — design-source의 complete 흐름과 동일
    drawNewWord();
  }

  function openDatePicker() {
    setDateSheetVisible(true);
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
          {/* ─── 0. 앱 헤더 — 워드마크 + 마이페이지 진입 (IA: 헤더 우상단) ─── */}
          <View style={styles.appHeader}>
            <ThemedText style={styles.wordmark}>define</ThemedText>
            <Pressable
              onPress={() => router.push('/mypage')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.avatarBtn,
                {
                  backgroundColor: pressed
                    ? theme.colors.surface.nested
                    : theme.colors.surface.base,
                  borderColor: theme.colors.line.base,
                },
              ]}
            >
              {nickname.length > 0 ? (
                <ThemedText
                  variant="bodyMd"
                  style={{ color: theme.colors.point.p600, fontWeight: '700' }}
                >
                  {nickname[0]}
                </ThemedText>
              ) : (
                <Icon name="user" size={19} color={theme.colors.ink.secondary} />
              )}
            </Pressable>
          </View>

          {/* ─── 1. 날짜 칩 ─── */}
          <Pressable onPress={openDatePicker} style={styles.dateChipWrap}>
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
                {formatKoreanDate(selectedDate)}
              </ThemedText>
              {isTodaySelected ? (
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
              ) : null}
              <Icon name="chevronD" size={14} color={theme.colors.ink.placeholder} />
            </View>
          </Pressable>

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
                { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] },
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
                이란
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
                placeholder={`나에게 ${word}이란…`}
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
                  마음 가는 대로 적어보세요
                </ThemedText>
                <ThemedText variant="caption" tone="placeholder">
                  {definition.length}자
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* ─── 3-1. 변화 노트 (재정의일 때만) ─── */}
          {/* 같은 단어를 다시 정의하는 순간에만 "이전과 달라진 점"을 선택 입력받는다.
              첫 정의에는 비교 대상이 없으므로 노출하지 않음 — 첫 기록 흐름은 그대로 가볍게. */}
          {isRedefinition ? (
            <Card
              style={{ marginTop: theme.spacing.s4 }}
              radius="lg"
              elevation="sm"
              padded={false}
            >
              <View style={{ padding: theme.spacing.s5 }}>
                <View style={styles.changeNoteHead}>
                  <Icon name="arrowUp" size={15} color={theme.colors.point.p600} />
                  <ThemedText
                    variant="caption"
                    style={{ color: theme.colors.point.p600, letterSpacing: 0.3 }}
                  >
                    생각의 변화 · 선택
                  </ThemedText>
                </View>
                <TextInput
                  multiline
                  value={changeNote}
                  onChangeText={setChangeNote}
                  placeholder="예전과 무엇이 달라졌나요?"
                  placeholderTextColor={theme.colors.ink.placeholder}
                  style={[
                    styles.changeNoteInput,
                    {
                      color: theme.colors.ink.primary,
                      fontFamily: 'PretendardVariable',
                    },
                  ]}
                />
              </View>
            </Card>
          ) : null}

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

      {/* 저장 완료 — 포인트 원 + 체크 + 메시지. 1.6초 후 자동 사라지고 새 단어로 이어짐. */}
      <SaveConfirmation
        visible={confirmVisible}
        word={confirmedWord}
        onDismiss={handleConfirmDismiss}
      />

      {/* 날짜 선택 시트 — 칩 탭으로 열림. 선택 시 자동 닫힘. */}
      <DateSheet
        visible={dateSheetVisible}
        selected={selectedDate}
        onPick={setSelectedDate}
        onClose={() => setDateSheetVisible(false)}
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

  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateChipWrap: { alignItems: 'center' },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  todayBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },

  hero: { alignItems: 'center' },
  heroWordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  definitionInput: {
    minHeight: 140,
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

  changeNoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  changeNoteInput: {
    minHeight: 54,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top', // Android 상단 정렬
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fillerButton: { flex: 1 }, // 기록 완료 버튼이 행의 남은 공간을 채우게
});
