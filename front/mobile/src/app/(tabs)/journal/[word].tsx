/**
 * 단어 상세 — 한 단어의 시간 흐름에 따른 정의 타임라인 + entry 관리.
 *
 * 동적 라우트: /journal/{word}. useLocalSearchParams로 word 파라미터 받음.
 * 데이터는 store(useJournalWord)에서. 못 찾으면 폴백 안내.
 *
 * entry 관리 (Task #14):
 *   - 카드 길게 누름 → ActionSheet (수정 / 삭제) — 눌림 축소 + 가벼운 진동
 *   - 노트 없는 최신 재정의 카드 아래 "+ 변화 노트" → 노트 편집기 바로 열기
 *   - 수정 → 인라인 편집 (TimelineNode가 TextField로 전환)
 *   - 삭제 → ConfirmDialog → store.removeEntry
 *   - 모든 entries가 사라지면 자동 router.back() (단어장 리스트로 복귀)
 *   - 수정·노트·삭제 결과는 토스트로 말한다(루트 Provider라 뒤로 가도 남는다).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';

import { ChangeBanner } from '@/components/domain/change-banner';
import { ScreenHeader } from '@/components/domain/screen-header';
import { TimelineNode } from '@/components/domain/timeline-node';
import { ActionSheet, ConfirmDialog, useToast } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { hapticSuccess, hapticTap, hapticWarning } from '@/lib/haptics';
import { useJournalStore, useJournalWord } from '@/store/journal-store';
import { motion, useTheme } from '@/theme';

export default function WordDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { word: rawWord } = useLocalSearchParams<{ word: string }>();
  const wordKey = typeof rawWord === 'string' ? rawWord : '';

  const item = useJournalWord(wordKey);
  const updateEntry = useJournalStore((s) => s.updateEntry);
  const updateChangeNote = useJournalStore((s) => s.updateChangeNote);
  const removeEntry = useJournalStore((s) => s.removeEntry);
  const reduceMotion = useReducedMotion();
  const toast = useToast();

  // 진행 중인 액션 — 한 entry에만 동시에 가능
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  /** 방금 수정한 카드 — 테두리를 잠깐 물들인다(TimelineNode justSaved). */
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  // 물들임은 잠깐 — 다음 수정 때 다시 켜지도록 꺼 둔다.
  useEffect(() => {
    if (!justSavedId) return;
    const t = setTimeout(() => setJustSavedId(null), 1200);
    return () => clearTimeout(t);
  }, [justSavedId]);

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
    // 글자만 바뀌면 저장됐는지 모른다 — 진동 + 토스트 + 카드 테두리로 세 번 짚는다.
    hapticSuccess();
    toast.show('정의를 고쳤어요');
    setJustSavedId(id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function startEditNote(id: string) {
    setEditingId(null);
    setEditingNoteId(id);
  }

  function saveNote(id: string, note: string) {
    const had = !!item?.entries.find((e) => e.id === id)?.changeNote;
    updateChangeNote(id, note); // 빈 값이면 store가 노트 제거. savedAt 불변 → 정렬 영향 없음
    setEditingNoteId(null);
    // 비우고 저장 = 삭제. 조용히 사라지면 실수인지 모르므로 결과를 말한다.
    if (note) toast.show('변화 노트를 남겼어요');
    else if (had) toast.show('노트를 지웠어요');
  }

  function cancelEditNote() {
    setEditingNoteId(null);
  }

  function requestDelete(id: string) {
    hapticWarning(); // 되돌릴 수 없는 행동 직전
    setConfirmDeleteId(id);
  }

  function performDelete() {
    if (!confirmDeleteId) return;
    removeEntry(confirmDeleteId);
    setConfirmDeleteId(null);
    // 마지막 기록이면 화면이 곧 뒤로 가지만, 토스트는 루트에 있어 단어장 위에서 보인다.
    toast.show('기록을 지웠어요');
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <ScreenHeader title={item.word} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── "생각이 변했어요" 배너 — 변화가 있을 때만. 리빌의 마지막 결론처럼 등장 ─── */}
        {item.changed && item.changeNote ? (
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeIn.delay(Math.min(item.entries.length - 1, 6) * 55 + 100).duration(
                    motion.duration.base,
                  )
            }
            style={{ marginBottom: theme.spacing.s4 }}
          >
            <ChangeBanner note={item.changeNote} />
          </Animated.View>
        ) : null}

        {/* ─── 카운트 ─── */}
        <ThemedText variant="caption" tone="placeholder">
          {item.entries.length}번의 정의 · 최신순
        </ThemedText>
        {/* 길게 누르기는 보이지 않는 제스처라 따로 한 줄을 준다. */}
        <View style={[styles.hint, { marginTop: theme.spacing.s1, marginBottom: theme.spacing.s4 }]}>
          <Icon name="edit" size={12} color={theme.colors.ink.placeholder} />
          <ThemedText variant="caption" tone="placeholder">
            카드를 길게 누르면 고치거나 지울 수 있어요
          </ThemedText>
        </View>

        {/* ─── 타임라인 — 과거→현재(아래→위)로 차오르며 등장. 최신(맨 위)이 마지막에 안착 ─── */}
        <View>
          {item.entries.map((entry, i) => {
            // 아래→위 stagger(오래된 것부터). 같은 지연을 노드에 넘겨 선/점 연출을 동기화.
            const revealDelay = Math.min(item.entries.length - 1 - i, 6) * 55;
            return (
              // layout/exiting: 편집·삭제 시 부드러운 재배치·소멸.
              <Animated.View
                key={entry.id}
                entering={
                  reduceMotion ? undefined : FadeInUp.delay(revealDelay).duration(motion.duration.slow)
                }
                layout={LinearTransition.duration(motion.duration.base)}
                exiting={FadeOut.duration(motion.duration.fast)}
              >
                <TimelineNode
                  entry={entry}
                  isNow={i === 0}
                  isLast={i === item.entries.length - 1}
                  revealDelay={revealDelay}
                  editing={editingId === entry.id}
                  editingNote={editingNoteId === entry.id}
                  onLongPress={() => {
                    hapticTap(); // 시트가 뜨기 전에 "잡혔다"를 손끝으로
                    setActionEntryId(entry.id);
                  }}
                  // 최신 카드에만 — 모든 카드에 붙이면 같은 버튼이 줄줄이 반복돼 시끄럽다.
                  // 옛 카드의 노트는 길게 눌러 액션시트에서 남긴다.
                  onAddNote={i === 0 ? () => startEditNote(entry.id) : undefined}
                  justSaved={justSavedId === entry.id}
                  onSaveEdit={(t) => saveEdit(entry.id, t)}
                  onCancelEdit={cancelEdit}
                  onSaveNote={(n) => saveNote(entry.id, n)}
                  onCancelNote={cancelEditNote}
                />
              </Animated.View>
            );
          })}
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
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
});
