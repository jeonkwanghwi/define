/**
 * auto-sync — journal-store 변경을 구독해 로그인 상태면 서버에 반영한다.
 *  - 추가/수정/삭제 → 디바운스 후 syncJournal 한 번(지운 것 DELETE + 바뀐 것만 멱등 import)
 *    삭제도 여기서 바로 쏘지 않는다 — 실패하면 잊혔다. 이제 store의 pendingDeletes가 기억하고
 *    syncJournal이 비운다(실패하면 다음 동기화가 다시 시도).
 *  - 주인이 바뀐 변경(계정 전환·탈퇴로 로컬을 통째로 비움)은 서버에 보내지 않는다
 * 익명(token 없음)이면 no-op. journal-store는 auth를 모르게 유지 — 여기가 매개.
 * 모든 동기화는 비치명적(실패해도 화면은 막지 않고, 다음 동기화가 복구).
 * 단, 실패는 auth-store에 표시해 헤더·마이페이지가 "동기화 안 됨"을 보여준다
 * (조용히 삼키면 서버가 죽어도 사용자는 저장됐다고 믿는다).
 */
import { syncJournal } from '@/lib/sync-journal';
import { useAuthStore } from '@/store/auth-store';
import { useJournalStore } from '@/store/journal-store';

const DEBOUNCE_MS = 1500;

/**
 * 변경 구독 시작. 반환값 = 구독 해제 함수(_layout 언마운트 시 호출).
 */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsub = useJournalStore.subscribe((state, prev) => {
    const token = useAuthStore.getState().token;
    if (!token) return; // 익명 — 서버 없음, no-op
    // 기록 자체가 안 바뀐 변경(업로드 성공 표시·주인 지정 등)은 올릴 게 없다.
    if (state.entries === prev.entries) return;
    // 계정 전환·탈퇴로 로컬을 비운 것 — "사용자가 지웠다"가 아니다. 서버에 보낼 게 없다
    // (resetLocal이 pendingDeletes도 비운다 — 전엔 기록 수만큼 DELETE가 한꺼번에 쏟아졌다).
    if (state.ownerId !== prev.ownerId) return;

    // 디바운스 후 한 번에: 지운 것 DELETE + 바뀐 것만 업로드(멱등)
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const t = useAuthStore.getState().token;
      if (t) {
        syncJournal(t)
          .then((res) => {
            // 잔액 갱신 + 루트 토스트("잉크 N개가 쌓였어요")까지 한 번에.
            if (res.recordBonus) useAuthStore.getState().applyRecordBonus(res.recordBonus);
            useAuthStore.getState().markSynced();
          })
          .catch((e) => {
            console.warn('[auto-sync] 업로드 실패:', e);
            useAuthStore.getState().markSyncFailed();
          });
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
