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
   * 이 로컬 단어장의 주인(계정 id). null = 익명(아직 어느 계정 것도 아님).
   * 로그인 시 이 값과 로그인 계정을 비교해 "계정 전환"을 감지 → 남의 계정에
   * 내 로컬 데이터가 업로드되는 오염을 막는다. 로그아웃해도 유지(다음 로그인 판별용).
   */
  ownerId: string | null;
  /** 로컬 단어장의 주인 지정(로그인 계정 클레임 / 익명 복귀 시 null). */
  setOwner: (id: string | null) => void;
  /**
   * 아직 서버에 올라가지 않은 entry id들("더러운" 것). 추가·수정하면 여기 들어가고,
   * 업로드가 **성공한 뒤에만** 빠진다. 동기화는 이것만 올린다.
   *
   * 왜: 전에는 바뀔 때마다 단어장 전체를 올렸다. 기록이 많아지면 요청이 서버 한도를 넘어 영원히
   * 실패했고(413), 다른 폰에서 지운 기록·고친 기록을 이 폰의 옛 사본이 되살리거나 덮어썼다.
   * Set이 아니라 배열인 이유: AsyncStorage에 JSON으로 저장되는데 Set은 JSON이 안 된다.
   */
  dirtyIds: string[];
  /**
   * 업로드 성공 처리 — 보낸 entry가 **보낸 그대로**일 때만 깨끗하게 표시한다.
   * 올리는 사이에 사용자가 또 고쳤다면(객체가 바뀌었다면) 다음 업로드를 위해 더러운 채로 둔다.
   */
  markClean: (sent: SavedEntry[]) => void;
  /** 전부 다시 올려야 할 때(이 기록이 아직 없는 새 계정에 붙을 때). */
  markAllDirty: () => void;
  /**
   * 지웠지만 서버에 아직 "지워라"를 못 전한 entry id들. 동기화가 DELETE로 하나씩 비운다.
   * 왜 기억하나: 전엔 삭제 요청이 실패하면 그대로 잊혀서, 다음 다운로드가 서버의 사본을
   * 다시 내려받아 지운 기록이 **되살아났다**(광장에도 계속 공개된 채로).
   */
  pendingDeletes: string[];
  /** 서버 삭제 성공 — 목록에서 뺀다. */
  clearPendingDelete: (id: string) => void;
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
  /**
   * 서버 단어장을 로컬에 맞춘다(다운로드 동기화: 새 기기·재설치 복원 + 다른 폰의 수정·삭제 반영).
   * @param cleanAtStart 다운로드를 **시작할 때** 이미 서버에 올라가 있던(더럽지 않은) id들.
   *   - 로컬에 없는 서버 entry → 추가 (단, 여기서 지운 뒤 서버 삭제를 기다리는 것은 빼고)
   *   - 시작 때도 지금도 깨끗한 entry → 서버 사본이 이긴다(다른 폰에서 고친 것)
   *   - 시작 때 깨끗했는데 서버에 없는 entry → 다른 폰에서 지운 것 → 지운다
   *   더러운 것(아직 안 올린 이 폰의 글)은 절대 건드리지 않는다. 받는 사이 올라간 글도
   *   "시작 때 깨끗"이 아니라서 서버 목록에 없다고 지워지지 않는다.
   * 바뀐 게 없으면 state를 그대로 둔다(불필요한 리렌더·동기화 방지). 멱등.
   */
  applyServerEntries: (incoming: SavedEntry[], cleanAtStart: Set<string>) => void;
  /**
   * 로컬을 비우고 주인을 바꾼다(계정 전환·탈퇴). **한 번의 set으로** — auto-sync가 "주인이 바뀐
   * 변경"을 보고 이번 삭제를 서버에 보내지 않는다(남의/사라진 계정에 DELETE를 쏟아붓지 않게).
   */
  resetLocal: (ownerId: string | null) => void;
};

/** 추가·수정된 id를 더러운 목록에 넣는다(이미 있으면 그대로). */
function withDirty(dirtyIds: string[], id: string): string[] {
  return dirtyIds.includes(id) ? dirtyIds : [...dirtyIds, id];
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useJournalStore = create<JournalState>()(
  persist(
    (set) => ({
      entries: [],
      ownerId: null,
      dirtyIds: [],
      setOwner: (id) => set({ ownerId: id }),
      markClean: (sent) =>
        set((state) => {
          const current = new Map(state.entries.map((e) => [e.id, e]));
          // === 비교: zustand는 고칠 때 새 객체를 만든다 → 같은 객체면 보낸 뒤로 안 바뀐 것.
          const done = new Set(sent.filter((e) => current.get(e.id) === e).map((e) => e.id));
          return { dirtyIds: state.dirtyIds.filter((id) => !done.has(id)) };
        }),
      markAllDirty: () => set((state) => ({ dirtyIds: state.entries.map((e) => e.id) })),
      pendingDeletes: [],
      clearPendingDelete: (id) =>
        set((state) => ({ pendingDeletes: state.pendingDeletes.filter((d) => d !== id) })),
      addEntry: (word, text, savedAt, changeNote) => {
        const id = makeId();
        set((state) => ({
          dirtyIds: withDirty(state.dirtyIds, id),
          entries: [
            {
              id,
              word,
              text,
              savedAt: (savedAt ?? new Date()).toISOString(),
              // 빈 문자열은 저장하지 않음 (undefined로 정규화)
              changeNote: changeNote?.trim() ? changeNote.trim() : undefined,
            },
            ...state.entries,
          ],
        }));
      },
      updateEntry: (id, text) =>
        set((state) => ({
          dirtyIds: withDirty(state.dirtyIds, id),
          entries: state.entries.map((e) =>
            e.id === id ? { ...e, text } : e,
          ),
        })),
      updateChangeNote: (id, changeNote) =>
        set((state) => ({
          dirtyIds: withDirty(state.dirtyIds, id),
          entries: state.entries.map((e) =>
            e.id === id
              ? { ...e, changeNote: changeNote.trim() ? changeNote.trim() : undefined }
              : e,
          ),
        })),
      removeEntry: (id) =>
        set((state) => {
          const removed = state.entries.find((e) => e.id === id);
          let entries = state.entries.filter((e) => e.id !== id);
          // 지운 건 올릴 필요가 없다. 대신 서버에 지우라고 전할 목록에 넣는다(동기화가 DELETE로).
          let dirtyIds = state.dirtyIds.filter((d) => d !== id);
          // 첫 정의를 지우면 그다음 정의가 첫 정의가 된다. 그 정의의 변화 노트("이전과 달라진 점")는
          // 비교할 이전이 사라졌으니 남기면 안 된다 → 지우고 서버에도 다시 올린다.
          if (removed) {
            const oldest = entries
              .filter((e) => e.word === removed.word)
              .reduce<SavedEntry | null>((a, e) => (!a || e.savedAt < a.savedAt ? e : a), null);
            if (oldest?.changeNote) {
              entries = entries.map((e) => (e === oldest ? { ...e, changeNote: undefined } : e));
              dirtyIds = withDirty(dirtyIds, oldest.id);
            }
          }
          return {
            entries,
            dirtyIds,
            pendingDeletes: withDirty(state.pendingDeletes, id),
          };
        }),
      applyServerEntries: (incoming, cleanAtStart) =>
        set((state) => {
          const server = new Map(incoming.map((e) => [e.id, e]));
          const dirty = new Set(state.dirtyIds);
          const pending = new Set(state.pendingDeletes);
          let changed = false;
          const kept: SavedEntry[] = [];
          for (const e of state.entries) {
            const remote = server.get(e.id);
            const synced = cleanAtStart.has(e.id) && !dirty.has(e.id);
            if (!remote) {
              if (synced) changed = true; // 다른 폰에서 지웠다 → 여기서도 뺀다
              else kept.push(e);
              continue;
            }
            const same =
              remote.word === e.word &&
              remote.text === e.text &&
              remote.savedAt === e.savedAt &&
              (remote.changeNote ?? undefined) === (e.changeNote ?? undefined);
            if (synced && !same) {
              kept.push(remote); // 다른 폰에서 고쳤다 → 서버 사본
              changed = true;
            } else {
              kept.push(e); // 같은 객체를 유지해야 markClean의 === 비교가 산다
            }
          }
          const known = new Set(state.entries.map((e) => e.id));
          const additions = incoming.filter((e) => !known.has(e.id) && !pending.has(e.id));
          if (!changed && additions.length === 0) return state;
          return {
            entries: [...kept, ...additions].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
          };
        }),
      resetLocal: (ownerId) => set({ entries: [], dirtyIds: [], pendingDeletes: [], ownerId }),
    }),
    {
      name: 'define-journal-v1', // 스토리지 키. 모델 깨는 변경 시 v2로 올려 마이그레이션.
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * 저장 형식 버전. 1 = dirtyIds 도입(빌드 14).
       * 업데이트 전에 저장된 데이터(version 0)엔 dirtyIds가 없다 — 어느 게 이미 서버에 있는지
       * 알 길이 없으니 **전부 더러운 것으로** 보고 한 번 다 올린다(멱등 upsert라 중복은 안 생긴다).
       * 빈 목록으로 시작하면 업데이트 직전에 못 올라간 기록이 영영 안 올라간다.
       */
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as Partial<JournalState>;
        if (version < 1) {
          return { ...state, dirtyIds: (state.entries ?? []).map((e) => e.id) } as JournalState;
        }
        return state as JournalState;
      },
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
      // 단어 단위 요약 = **최신 정의의** 변화 노트(없으면 없음). 리스트/배너 미리보기용.
      // "노트가 있는 가장 최근 것"으로 거슬러 올라가면 석 달 전 노트가 오늘 정의 밑에
      // 붙어 오늘 얘기처럼 읽혔다(2026-10-17 감사). 옛 노트는 타임라인의 그 카드에 남아 있다.
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

/**
 * 통계 카드 — 총 기록 수와 변화 통계.
 * 변화 기준은 "2회 이상 정의"가 아니라 **사용자가 남긴 변화 노트**(2026-07-17 변경).
 * 기계적 재정의 횟수는 쓸수록 전체에 수렴해 신호가 죽지만, 노트는 사용자가 직접
 * "생각이 변했다"고 선언한 것이라 시간이 지나도 의미가 유지된다.
 *   - changedWords: 변화 노트가 1개 이상 있는 단어 수 = "생각이 바뀐 단어".
 *     단어장 통계·마이페이지가 **같은 이 값**을 쓴다 — 화면마다 다른 숫자(노트 개수 vs
 *     단어 수)를 같은 '변화'라고 부르면 어느 쪽이 맞는지 헷갈린다(2026-10-17 통일).
 */
export function useJournalStats(): {
  totalEntries: number;
  uniqueWords: number;
  changedWords: number;
} {
  const grouped = useGroupedByWord();
  return useMemo(() => {
    const total = grouped.reduce((sum, w) => sum + w.entries.length, 0);
    const changedWords = grouped.filter((w) => w.entries.some((e) => e.changeNote)).length;
    return { totalEntries: total, uniqueWords: grouped.length, changedWords };
  }, [grouped]);
}

// ─── streak / 기록 흐름 통계 ──────────────────────────────────────

/** 로컬 자정 기준 일련번호. Date.UTC(로컬 y/m/d)로 timezone 영향 없이 '며칠 차이'를 정수로. */
function dayIndex(d: Date): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export type JournalStreak = {
  /** 오늘(또는 어제)까지 이어진 연속 기록일. 오늘·어제 모두 비면 0. */
  currentStreak: number;
  /** 역대 최장 연속 기록일. */
  longestStreak: number;
  /** 이번 주(월~오늘) 기록한 날 수. */
  daysThisWeek: number;
  /** 기록한 날의 총 개수(하루 여러 번 적어도 1일). */
  totalDays: number;
};

/**
 * 기록 '날짜'들로 streak 계산. 시각·중복은 무시(하루 여러 번 적어도 1일로 셈).
 * @param now 기준 시각(주입식 — 테스트/일관성).
 */
export function computeStreak(entries: SavedEntry[], now: Date): JournalStreak {
  if (entries.length === 0) {
    return { currentStreak: 0, longestStreak: 0, daysThisWeek: 0, totalDays: 0 };
  }
  const days = new Set<number>();
  for (const e of entries) days.add(dayIndex(new Date(e.savedAt)));

  const todayIdx = dayIndex(now);

  // 현재 연속: 오늘이 있으면 오늘부터, 없고 어제가 있으면 어제부터(오늘은 아직 '저장 가능').
  const anchor = days.has(todayIdx)
    ? todayIdx
    : days.has(todayIdx - 1)
      ? todayIdx - 1
      : null;
  let currentStreak = 0;
  while (anchor !== null && days.has(anchor - currentStreak)) currentStreak++;

  // 최장 연속: 정렬 후 연속(차이 1) 구간 최대 길이.
  const sorted = [...days].sort((a, b) => a - b);
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  // 이번 주(월요일 시작) ~ 오늘.
  const weekStartIdx = todayIdx - ((now.getDay() + 6) % 7); // getDay: 0=일
  let daysThisWeek = 0;
  for (const d of days) if (d >= weekStartIdx && d <= todayIdx) daysThisWeek++;

  return { currentStreak, longestStreak, daysThisWeek, totalDays: days.size };
}

/** 기록 흐름(연속/이번 주/누적일) — 마이페이지·단어장 통계용. */
export function useJournalStreak(): JournalStreak {
  const entries = useJournalStore((s) => s.entries);
  return useMemo(() => computeStreak(entries, new Date()), [entries]);
}
