/**
 * 단어 상세 — 한 단어의 시간 흐름에 따른 정의 타임라인 + entry 관리.
 *
 * 동적 라우트: /journal/{word}. useLocalSearchParams로 word 파라미터 받음.
 * 데이터는 store(useJournalWord)에서. 못 찾으면 폴백 안내.
 *
 * entry 관리 (Task #14):
 *   - 카드 길게 누름 → ActionSheet (수정 / 삭제)
 *   - 수정 → 인라인 편집 (TimelineNode가 TextField로 전환)
 *   - 삭제 → ConfirmDialog → store.removeEntry
 *   - 모든 entries가 사라지면 자동 router.back() (단어장 리스트로 복귀)
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/domain/screen-header';
import { TimelineNode } from '@/components/domain/timeline-node';
import { ActionSheet, ConfirmDialog } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useJournalStore, useJournalWord } from '@/store/journal-store';
import { useTheme } from '@/theme';

export default function WordDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const wordKey = typeof rawWord === 'string' ? rawWord : '';

  const item = useJournalWord(wordKey);
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const updateChangeNote = useJournalStore((s) => s.updateChangeNote);
  const removeEntry = useJournalStore((s) => s.removeEntry);

  // 진행 중인 액션 — 한 entry에만 동시에 가능
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // 액션시트가 가리키는 entry — 변화 노트 항목 라벨/노출 판정용.
  // entries는 시간 역순(0=최신)이라 마지막 인덱스가 첫 정의(=비교 대상 없음).
  const actionIndex = item ? item.entries.findIndex((e) => e.id === actionEntryId) : -1;
  const actionEntry = actionIndex >= 0 ? item!.entries[actionIndex] : null;
  const isFirstDefinition = actionIndex === (item ? item.entries.length - 1 : -1);

  // 마지막 entry가 삭제돼서 item이 사라지면 단어장으로 복귀.
  // useEffect로 처리해 render 중 setState/navigate 부작용 방지.
  useEffect(() => {
    if (!item && wordKey) {
      // 빈 wordKey가 아닌데 못 찾으면(=모든 entries 삭제됨) 자동 뒤로
      const t = setTimeout(() => router.back(), 50);
      return () => clearTimeout(t);
    }
  }, [item, wordKey, router]);

  if (!item) {
    // 폴백 — 자동 뒤로 가기 전 잠깐 비는 화면. 디자인 톤은 유지.
    return <ThemedView bg="paper" style={styles.root} />;
  }

  function startEdit(id: string) {
    setEditingNoteId(null); // 텍스트/노트 편집은 상호배타
    setEditingId(id);
  }

  function saveEdit(id: string, newText: string) {
    updateEntry(id, newText);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function startEditNote(id: string) {
    setEditingId(null);
    setEditingNoteId(id);
  }

  function saveNote(id: string, note: string) {
    updateChangeNote(id, note); // 빈 값이면 store가 노트 제거. savedAt 불변 → 정렬 영향 없음
    setEditingNoteId(null);
  }

  function cancelEditNote() {
    setEditingNoteId(null);
  }

  function requestDelete(id: string) {
    setConfirmDeleteId(id);
  }

  function performDelete() {
    if (!confirmDeleteId) return;
    removeEntry(confirmDeleteId);
    setConfirmDeleteId(null);
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title={item.word} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── 카운트 ─── */}
        <ThemedText
          variant="caption"
          tone="placeholder"
          style={{ marginBottom: theme.spacing.s4 }}
        >
          {item.entries.length}번의 정의 · 시간순 · 길게 눌러 수정/삭제
        </ThemedText>

        {/* ─── 타임라인 ─── */}
        <View>
          {item.entries.map((entry, i) => (
            <TimelineNode
              key={entry.id}
              entry={entry}
              isNow={i === 0}
              isLast={i === item.entries.length - 1}
              editing={editingId === entry.id}
              editingNote={editingNoteId === entry.id}
              onLongPress={() => setActionEntryId(entry.id)}
              onSaveEdit={(t) => saveEdit(entry.id, t)}
              onCancelEdit={cancelEdit}
              onSaveNote={(n) => saveNote(entry.id, n)}
              onCancelNote={cancelEditNote}
            />
          ))}
        </View>
      </ScrollView>

      {/* ─── 액션 시트 ─── */}
      <ActionSheet
        visible={!!actionEntryId}
        title="이 기록을 어떻게 할까요?"
        items={[
          {
            label: '수정',
            onPress: () => actionEntryId && startEdit(actionEntryId),
          },
          // 변화 노트는 "이전과 달라진 점"이라 첫 정의(비교 대상 없음)에는 제외.
          ...(!isFirstDefinition
            ? [
                {
                  label: actionEntry?.changeNote ? '변화 노트 수정' : '변화 노트 추가',
                  onPress: () => actionEntryId && startEditNote(actionEntryId),
                },
              ]
            : []),
          {
            label: '삭제',
            destructive: true,
            onPress: () => actionEntryId && requestDelete(actionEntryId),
          },
        ]}
        onClose={() => setActionEntryId(null)}
      />

      {/* ─── 삭제 확인 ─── */}
      <ConfirmDialog
        visible={!!confirmDeleteId}
        title="이 기록을 삭제할까요?"
        message="단어장에서 이 정의가 사라져요. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        destructive
        onConfirm={performDelete}
        onClose={() => setConfirmDeleteId(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
});
