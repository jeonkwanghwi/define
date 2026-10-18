/**
 * TimelineNode — 단어 상세의 타임라인 한 항목.
 *
 * 디자인:
 *   왼쪽   ─ 원(노드) + 아래로 이어지는 세로선
 *   오른쪽 ─ 상대 라벨(point 색) + 절대 날짜 + 정의 본문 카드
 *
 * 모드:
 *   - 일반     — 카드에 정의 텍스트. 길게 누르면 onLongPress 트리거(눌리는 동안 살짝 줄어든다).
 *                첫 정의가 아니고 노트가 없으면 카드 아래 "+ 변화 노트" 버튼(onAddNote).
 *   - editing  — 카드가 TextField로 바뀌고 저장/취소 버튼 등장. autoFocus.
 *   - justSaved — 방금 고친 카드 테두리가 잠깐 포인트 색으로 물들었다 돌아온다.
 *
 * isNow=true(최신) → 노드 강조 + 카드 섀도우.
 * isLast=true     → 세로선 미표시.
 */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, type TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button, Card, PressableScale, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { MIN_DEFINITION_LENGTH } from '@/lib/definition';
import { ENTRY_LIMITS } from '@/lib/sync-journal';
import { spacing, useTheme } from '@/theme';
import type { WordEntry } from '@/types/word';

export type TimelineNodeProps = {
  entry: WordEntry;
  isNow?: boolean;
  isLast?: boolean;
  /** 편집 모드 켜진 entry 여부 — 부모가 editingId 상태로 제어 */
  editing?: boolean;
  /** 변화 노트 편집 모드 — 부모가 editingNoteId 상태로 제어 (editing과 상호배타) */
  editingNote?: boolean;
  /** 진입 리빌 지연(ms) — 세로선 그리기·변화지점 dot 펄스를 노드 등장과 맞춤. 없으면 연출 생략. */
  revealDelay?: number;
  /** 길게 누름 — 부모가 ActionSheet 띄움 */
  onLongPress?: () => void;
  /** 편집 저장 — 부모가 store.updateEntry */
  onSaveEdit?: (newText: string) => void;
  /** 편집 취소 */
  onCancelEdit?: () => void;
  /** 변화 노트 저장 — 부모가 store.updateChangeNote. 빈 문자열이면 노트 제거. */
  onSaveNote?: (note: string) => void;
  /** 변화 노트 편집 취소 */
  onCancelNote?: () => void;
  /** "+ 변화 노트" 버튼 — 길게 누르기를 몰라도 노트를 남길 수 있게 바로 편집기로. */
  onAddNote?: () => void;
  /** 방금 수정 저장됨 — 테두리를 잠깐 물들여 "바뀐 곳"을 짚어 준다. 부모가 잠시 뒤 끈다. */
  justSaved?: boolean;
  /**
   * 본문을 이 줄 수로 접어 둔다(+ "더 보기"). 리빌에서 막 쓴 긴 정의가 화면을 다 덮어
   * 비교할 옛 카드가 밀려나지 않게 — 부모가 필요할 때만 준다.
   */
  clampLines?: number;
};

export function TimelineNode({
  entry,
  isNow,
  isLast,
  editing,
  editingNote,
  revealDelay,
  onLongPress,
  onSaveEdit,
  onCancelEdit,
  onSaveNote,
  onCancelNote,
  onAddNote,
  justSaved,
  clampLines,
}: TimelineNodeProps) {
  const theme = useTheme();
  // 지난 점은 회색 — p300은 바탕과 2:1이라 다크에서 사라졌다. '지금'만 포인트로 남겨 구분한다.
  const dotBorderColor = isNow ? theme.colors.point.p600 : theme.colors.ink.placeholder;

  // ─── 진입 연출: 세로선이 시간 타고 위→아래로 그려지고, 변화 지점 dot이 살짝 펄스 ───
  // 기본값은 "완성 상태"(선 scaleY=1, dot scale=1)라 reduced-motion이거나 연출이 실패해도 정상 표시.
  const reduceMotion = useReducedMotion();
  const animateReveal = !reduceMotion && revealDelay != null;
  const lineGrow = useSharedValue(animateReveal && !isLast ? 0 : 1);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    if (!animateReveal) return;
    const d = revealDelay ?? 0;
    if (!isLast) {
      lineGrow.value = withDelay(d + 120, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
    }
    if (entry.changeNote) {
      dotScale.value = withDelay(
        d + 220,
        withSequence(
          withTiming(1.35, { duration: 160, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }
    // 마운트 시 1회만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineAnimStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lineGrow.value }] }));
  const dotAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: dotScale.value }] }));

  // ─── 수정 직후 테두리 물들임 — 글자만 바뀌면 어디가 바뀌었는지 놓친다 ───
  // 카드 위에 포인트 테두리 한 겹을 얹고 투명도만 움직인다(네이티브 드라이버로 부드럽게).
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!justSaved) return;
    flash.value = reduceMotion
      ? withSequence(withTiming(1, { duration: 0 }), withDelay(900, withTiming(0, { duration: 0 })))
      : withSequence(
          withTiming(1, { duration: theme.motion.duration.fast, easing: Easing.out(Easing.cubic) }),
          withDelay(700, withTiming(0, { duration: theme.motion.duration.slow, easing: Easing.out(Easing.cubic) })),
        );
  }, [justSaved, reduceMotion, flash, theme.motion]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const [expanded, setExpanded] = useState(false);

  // ─── 텍스트 편집 상태 ───
  const [draft, setDraft] = useState(entry.text);
  const inputRef = useRef<TextInput>(null);

  // 편집 모드 진입 시 텍스트 동기화 + 자동 포커스 (자연스러운 등장)
  useEffect(() => {
    if (editing) {
      setDraft(entry.text);
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [editing, entry.text]);

  // ─── 변화 노트 편집 상태 ───
  const [noteDraft, setNoteDraft] = useState(entry.changeNote ?? '');
  const noteInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editingNote) {
      setNoteDraft(entry.changeNote ?? '');
      const t = setTimeout(() => noteInputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [editingNote, entry.changeNote]);

  function handleSave() {
    const trimmed = draft.trim();
    if (trimmed.length < MIN_DEFINITION_LENGTH) return;
    Keyboard.dismiss();
    onSaveEdit?.(trimmed);
  }

  function handleCancel() {
    Keyboard.dismiss();
    setDraft(entry.text);
    onCancelEdit?.();
  }

  // 빈 값 허용 — 비우고 저장하면 노트 삭제(소급 제거)
  function handleSaveNote() {
    Keyboard.dismiss();
    onSaveNote?.(noteDraft.trim());
  }

  function handleCancelNote() {
    Keyboard.dismiss();
    setNoteDraft(entry.changeNote ?? '');
    onCancelNote?.();
  }

  // 정의 본문 카드 — 읽기/노트편집 모드에서 공유 (중복 방지)
  const definitionCard = (
    <Card
      style={{ marginTop: theme.spacing.s2 }}
      radius="md"
      elevation={isNow ? 'sm' : 'none'}
    >
      <ThemedText
        variant="body"
        tone="strong"
        style={{ lineHeight: 26 }}
        numberOfLines={clampLines && !expanded ? clampLines : undefined}
      >
        {entry.text}
      </ThemedText>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          { borderColor: theme.colors.point.p300, borderRadius: theme.radii.md },
          flashStyle,
        ]}
      />
    </Card>
  );

  return (
    <View style={styles.row}>
      {/* ── 왼쪽: 노드 + 세로선 ── */}
      <View style={styles.left}>
        <Animated.View
          style={[
            styles.dot,
            {
              backgroundColor: theme.colors.surface.base,
              borderColor: dotBorderColor,
            },
            isNow && {
              shadowColor: theme.colors.point.p600,
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 2,
            },
            dotAnimStyle,
          ]}
        />
        {!isLast ? (
          <Animated.View
            style={[styles.line, { backgroundColor: theme.colors.line.strong }, lineAnimStyle]}
          />
        ) : null}
      </View>

      {/* ── 오른쪽: 메타 + 본문 ── */}
      <View style={styles.content}>
        <View style={styles.meta}>
          <ThemedText
            variant="bodyMd"
            style={{ color: theme.colors.point.p600 }}
          >
            {entry.relativeLabel}
          </ThemedText>
          <ThemedText variant="caption" tone="placeholder">
            {entry.date}
          </ThemedText>
        </View>

        {editing ? (
          <View style={{ marginTop: theme.spacing.s2 }}>
            {/* 기록 화면 입력 카드와 같은 모서리(lg) — 글자 크기·줄높이는 TextField의 body 토큰 그대로. */}
            <Card padded={false} radius="lg" elevation="sm">
              <TextField
                ref={inputRef}
                multiline
                maxLength={ENTRY_LIMITS.text} // 서버 상한 — 넘기면 동기화가 거절된다
                value={draft}
                onChangeText={setDraft}
                placeholder="정의를 수정해보세요"
                style={[styles.bareField, { minHeight: 120 }]}
              />
            </Card>
            <View style={[styles.editActions, { marginTop: theme.spacing.s3 }]}>
              {/* 최소 글자 수 미만이면 저장이 왜 안 되는지 카운터로 목표를 보여줌 (marginRight:auto = 왼쪽 정렬) */}
              <ThemedText
                variant="caption"
                tone="placeholder"
                style={{ marginRight: 'auto', alignSelf: 'center' }}
              >
                {draft.trim().length >= MIN_DEFINITION_LENGTH
                  ? `${draft.length}자`
                  : `${draft.trim().length}/${MIN_DEFINITION_LENGTH}자`}
              </ThemedText>
              <Button
                label="취소"
                variant="ghost"
                size="sm"
                onPress={handleCancel}
              />
              <Button
                label="저장"
                size="sm"
                onPress={handleSave}
                disabled={draft.trim().length < MIN_DEFINITION_LENGTH || draft.trim() === entry.text}
              />
            </View>
          </View>
        ) : editingNote ? (
          // 변화 노트 소급 추가/수정 — 정의 카드 위 노트 슬롯이 입력 필드로 전환.
          <View style={{ marginTop: theme.spacing.s2 }}>
            <View style={styles.noteEditHead}>
              <Icon name="arrowUp" size={14} color={theme.colors.point.p600} />
              <ThemedText
                variant="caption"
                style={{ color: theme.colors.point.p600, letterSpacing: 0.3 }}
              >
                생각의 변화 · 선택
              </ThemedText>
              {/* 규칙을 미리 말해 둔다 — 비우고 저장했는데 노트가 사라지면 놀란다. */}
              <ThemedText variant="caption" tone="placeholder">
                · 비우고 저장하면 지워져요
              </ThemedText>
            </View>
            <Card padded={false} radius="lg" elevation="sm">
              <TextField
                ref={noteInputRef}
                multiline
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="예전과 무엇이 달라졌나요?"
                maxLength={80}
                style={[styles.bareField, { minHeight: 64 }]}
              />
            </Card>
            <View style={[styles.editActions, { marginTop: theme.spacing.s3 }]}>
              <Button label="취소" variant="ghost" size="sm" onPress={handleCancelNote} />
              <Button label="저장" size="sm" onPress={handleSaveNote} />
            </View>
            {definitionCard}
          </View>
        ) : (
          // 길게 눌러서 액션 시트 띄움. 일반 탭은 동작 없음(읽기 모드).
          // 눌리는 동안 살짝 줄어들어 "이 카드가 잡혔다"를 손끝 전에 눈으로 알린다.
          <View>
            <PressableScale onLongPress={onLongPress} delayLongPress={350}>
              {/* 변화 노트 — 이 정의를 적을 때 "이전과 달라진 점". 정의 카드 위에 point 톤 주석으로. */}
              {entry.changeNote ? (
                <View style={[styles.changeNote, { marginTop: theme.spacing.s2 }]}>
                  <Icon name="arrowUp" size={14} color={theme.colors.point.p600} />
                  <ThemedText
                    variant="sm"
                    style={{ flex: 1, color: theme.colors.point.p600 }}
                  >
                    {entry.changeNote}
                  </ThemedText>
                </View>
              ) : null}
              {definitionCard}
            </PressableScale>
            {clampLines ? (
              <Button
                label={expanded ? '접기' : '더 보기'}
                variant="ghost"
                size="sm"
                onPress={() => setExpanded((v) => !v)}
                style={[styles.addNote, { marginTop: theme.spacing.s1 }]}
              />
            ) : null}
            {/* 노트는 숨은 제스처로만 열면 아무도 모른다 — 남길 수 있는 자리엔 버튼을 보인다.
                첫 정의(isLast)는 비교 대상이 없어 노트가 없다. */}
            {!isLast && !entry.changeNote && onAddNote ? (
              <Button
                label="변화 노트"
                variant="ghost"
                size="sm"
                leftIcon={<Icon name="plus" size={13} color={theme.colors.point.p600} />}
                onPress={onAddNote}
                style={[styles.addNote, { marginTop: theme.spacing.s2 }]}
              />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  left: { alignItems: 'center', marginRight: 14, paddingTop: 4 },
  dot: { width: 13, height: 13, borderRadius: 6.5, borderWidth: 2.5 },
  line: { width: 2, flex: 1, marginTop: 4, marginBottom: 4, transformOrigin: 'top' },
  content: { flex: 1, paddingBottom: 24 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  changeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noteEditHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  // 카드가 테두리·바탕을 맡으므로 입력란은 맨몸. 여백은 spacing 토큰(s4/s3).
  bareField: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  // Card의 1px 테두리 위에 정확히 겹친다.
  flash: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderWidth: 1.5 },
  addNote: { alignSelf: 'flex-start' },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
