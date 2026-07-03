/**
 * TimelineNode — 단어 상세의 타임라인 한 항목.
 *
 * 디자인:
 *   왼쪽   ─ 원(노드) + 아래로 이어지는 세로선
 *   오른쪽 ─ 상대 라벨(point 색) + 절대 날짜 + 정의 본문 카드
 *
 * 모드:
 *   - 일반     — 카드에 정의 텍스트. 길게 누르면 onLongPress 트리거.
 *   - editing  — 카드가 TextField로 바뀌고 저장/취소 버튼 등장. autoFocus.
 *
 * isNow=true(최신) → 노드 강조 + 카드 섀도우.
 * isLast=true     → 세로선 미표시.
 */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, type TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Button, Card, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';
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
}: TimelineNodeProps) {
  const theme = useTheme();
  const dotBorderColor = isNow ? theme.colors.point.p600 : theme.colors.point.p300;

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
    if (!trimmed) return;
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
      <ThemedText variant="body" tone="strong" style={{ lineHeight: 26 }}>
        {entry.text}
      </ThemedText>
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
            <Card padded={false} radius="md" elevation="sm">
              <TextField
                ref={inputRef}
                multiline
                value={draft}
                onChangeText={setDraft}
                placeholder="정의를 수정해보세요"
                style={{
                  borderWidth: 0,
                  backgroundColor: 'transparent',
                  minHeight: 120,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  lineHeight: 26,
                }}
              />
            </Card>
            <View style={[styles.editActions, { marginTop: theme.spacing.s3 }]}>
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
                disabled={!draft.trim() || draft.trim() === entry.text}
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
            </View>
            <Card padded={false} radius="md" elevation="sm">
              <TextField
                ref={noteInputRef}
                multiline
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="예전과 무엇이 달라졌나요? (비우면 삭제)"
                maxLength={80}
                style={{
                  borderWidth: 0,
                  backgroundColor: 'transparent',
                  minHeight: 64,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  fontSize: 15,
                  lineHeight: 24,
                }}
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
          <Pressable
            onLongPress={onLongPress}
            delayLongPress={350}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
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
          </Pressable>
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
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
