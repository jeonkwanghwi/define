/**
 * 단어장 글로벌 상태 — Zustand store + AsyncStorage 영속.
 *
 * 익명 사용자 모델: 회원가입/백엔드 없이도 사용자가 적은 단어가 폰에 누적됨.
 * 백엔드 도입 시 첫 로그인 마이그레이션 단계에서 서버로 entries 일괄 전송 가능.
 *
 * 모델: flat SavedEntry[] 한 배열로 정규화 저장.
 *   - 같은 word를 N번 적어도 별도 entry로 추가 (시간순 누적)
 *   - 단어별 그룹화는 디스플레이 계층에서 selector로 (useGroupedByWord)
 *
 * 사용:
 *   const addEntry = useJournalStore((s) => s.addEntry);
 *   addEntry('행복', '오늘은…');
 *
 *   const grouped = useGroupedByWord();           // 단어장 리스트용
 *   const item = useJournalWord('행복');          // 단어 상세용
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { formatRelativeLabel, formatYmd } from '@/lib/format-date';
import type { JournalWord, WordEntry } from '@/types/word';

export type SavedEntry = {
  /** 충돌 가능성 매우 낮은 단순 ID — 백엔드 붙으면 서버 발급으로 교체 */
  id: string;
  word: string;
  text: string;
  /** ISO datetime — 정렬과 상대 시간 계산용 */
  savedAt: string;
  /** 재정의 시 "이전과 달라진 점" 선택 메모. 첫 정의엔 없음. */
  changeNote?: string;
};

type JournalState = {
  entries: SavedEntry[];
  /**
   * 정의 저장.
   * @param savedAt 지정 안 하면 현재 시각. 과거 날짜 기록(캘린더 선택) 시 그 Date 전달.
   * @param changeNote 재정의 시 "이전과 달라진 점" 선택 메모. 빈 값이면 생략.
   */
  addEntry: (word: string, text: string, savedAt?: Date, changeNote?: string) => void;
  /** 한 entry의 텍스트만 수정 (savedAt/word는 그대로). */
  updateEntry: (id: string, text: string) => void;
  /**
   * 한 entry의 변화 노트만 소급 추가/수정.
   * savedAt/word/text는 절대 손대지 않음 → 정렬(생성일 기준)에 영향 없음.
   * 빈 값이면 노트 제거(undefined로 정규화).
   */
  updateChangeNote: (id: string, changeNote: string) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (word, text, savedAt, changeNote) =>
        set((state) => ({
          entries: [
            {
              id: makeId(),
              word,
              text,
              savedAt: (savedAt ?? new Date()).toISOString(),
              // 빈 문자열은 저장하지 않음 (undefined로 정규화)
              changeNote: changeNote?.trim() ? changeNote.trim() : undefined,
            },
            ...state.entries,
          ],
        })),
      updateEntry: (id, text) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, text } : e,
          ),
        })),
      updateChangeNote: (id, changeNote) =>
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === id
              ? { ...e, changeNote: changeNote.trim() ? changeNote.trim() : undefined }
              : e,
          ),
        })),
      removeEntry: (id) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== id),
        })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'define-journal-v1', // 스토리지 키. 모델 깨는 변경 시 v2로 올려 마이그레이션.
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ─── selectors / derived state ──────────────────────────────────────

/**
 * SavedEntry[]를 단어별 그룹으로 변환 + 디스플레이용 라벨 부여.
 *
 * 결과: JournalWord[] (단어장 리스트와 동일한 도메인 타입).
 *   - changed는 entries.length >= 2 일 때 true (정의가 2번 이상 쌓이면)
 *   - changeNote는 자동 생성 안 함 (정성 항목이라 사용자가 적거나 ML 도입 시점)
 */
function groupByWord(saved: SavedEntry[]): JournalWord[] {
  const now = new Date();
  const map = new Map<string, SavedEntry[]>();

  for (const e of saved) {
    const bucket = map.get(e.word);
    if (bucket) bucket.push(e);
    else map.set(e.word, [e]);
  }

  const result: JournalWord[] = [];
  for (const [word, list] of map.entries()) {
    // 최신이 entries[0] (시간 역순)
    const sorted = [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    const wordEntries: WordEntry[] = sorted.map((e) => {
      const d = new Date(e.savedAt);
      return {
        id: e.id,
        date: formatYmd(d),
        relativeLabel: formatRelativeLabel(d, now),
        text: e.text,
        changeNote: e.changeNote,
      };
    });
    result.push({
      word,
      entries: wordEntries,
      changed: wordEntries.length >= 2,
      // 단어 단위 요약 = 가장 최근(entries[0]) 변화 노트. 리스트/배너 미리보기용.
      changeNote: wordEntries[0]?.changeNote,
    });
  }
  return result;
}

/** 단어장 리스트 화면 — 모든 단어를 그룹화해 반환. */
export function useGroupedByWord(): JournalWord[] {
  const entries = useJournalStore((s) => s.entries);
  return useMemo(() => groupByWord(entries), [entries]);
}

/**
 * 특정 단어의 누적 기록 수 — 메인 화면에서 "재정의 여부" 판별용.
 * 0보다 크면 과거 정의가 있으므로 "변화 노트" 입력을 노출한다.
 */
export function useEntryCountForWord(word: string): number {
  return useJournalStore((s) => s.entries.reduce((n, e) => (e.word === word ? n + 1 : n), 0));
}

/** 단어 상세 화면 — 특정 단어 하나 찾아 반환. 없으면 undefined. */
export function useJournalWord(word: string): JournalWord | undefined {
  const grouped = useGroupedByWord();
  return useMemo(() => grouped.find((w) => w.word === word), [grouped, word]);
}

/** 통계 카드 — 총 기록 수와 변화 단어 수. */
export function useJournalStats(): { totalEntries: number; uniqueWords: number; changedWords: number } {
  const grouped = useGroupedByWord();
  return useMemo(() => {
    const total = grouped.reduce((sum, w) => sum + w.entries.length, 0);
    const changed = grouped.filter((w) => w.changed).length;
    return { totalEntries: total, uniqueWords: grouped.length, changedWords: changed };
  }, [grouped]);
}
