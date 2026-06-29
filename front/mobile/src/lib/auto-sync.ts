/**
 * auto-sync — journal-store 변경을 구독해 로그인 상태면 서버에 반영한다.
 *  - 삭제된 entry id → DELETE /journal/:clientId (즉시, best-effort)
 *  - 그 외 변경(추가/수정) → 디바운스 후 syncJournal(전체 멱등 import) 재호출
 * 익명(token 없음)이면 no-op. journal-store는 auth를 모르게 유지 — 여기가 매개.
 * 모든 동기화는 비치명적(실패는 console.warn, 다음 로그인 reconcile이 복구).
 */
import { syncJournal } from '@/lib/sync-journal';
import { deleteJournalEntry } from '@/services/journal-api';
import { useAuthStore } from '@/store/auth-store';
import { useRewardStore } from '@/store/reward-store';
import { type SavedEntry, useJournalStore } from '@/store/journal-store';

const DEBOUNCE_MS = 1500;

/** prev에 있고 next에 없는 entry id 목록(= 삭제된 것). 순수 함수. */
export function diffRemovedIds(prev: SavedEntry[], next: SavedEntry[]): string[] {
  const nextIds = new Set(next.map((e) => e.id));
  return prev.filter((e) => !nextIds.has(e.id)).map((e) => e.id);
}

/**
 * 변경 구독 시작. 반환값 = 구독 해제 함수(_layout 언마운트 시 호출).
 */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsub = useJournalStore.subscribe((state, prev) => {
    const token = useAuthStore.getState().token;
    if (!token) return; // 익명 — 서버 없음, no-op

    // 1) 삭제 즉시 반영
    for (const id of diffRemovedIds(prev.entries, state.entries)) {
      deleteJournalEntry(token, id).catch((e) =>
        console.warn('[auto-sync] 삭제 동기화 실패:', e),
      );
    }

    // 2) 추가/수정 → 디바운스 후 전체 재업로드(멱등)
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const t = useAuthStore.getState().token;
      if (t) {
        syncJournal(t)
          .then((res) => {
            if (res.recordBonus) {
              useAuthStore.getState().setBalance(res.recordBonus.balance);
              useRewardStore
                .getState()
                .push({ streak: res.recordBonus.milestone, amount: res.recordBonus.amount });
            }
          })
          .catch((e) => console.warn('[auto-sync] 업로드 실패:', e));
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
