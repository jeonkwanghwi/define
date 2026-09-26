/**
 * 인증 글로벌 상태 — Zustand store + AsyncStorage 영속 (settings/journal-store와 동일 패턴).
 *
 * token이 persist되어 앱 재시작 시 로그인 유지.
 * signup/login 성공 → token·user 저장 → 단어장 reconcile(업로드 로컬→서버 + 다운로드 서버→로컬, 멱등).
 *   다운로드 덕에 새 기기·재설치에서도 로그인하면 단어장이 복원된다.
 * logout → 인증 상태만 비움. 로컬 단어장(journal-store)은 절대 건드리지 않음.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  claimLocalOwner,
  downloadJournal,
  getLocalOwner,
  resetLocalForAccount,
  syncJournal,
} from '@/lib/sync-journal';
import {
  login as loginApi,
  signup as signupApi,
  updateNickname as updateNicknameApi,
  updateProfile as updateProfileApi,
  type AuthUser,
} from '@/services/auth-api';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  /** 마지막 동기화 시각(ISO). 마이페이지 표시용. */
  lastSyncedAt: string | null;
  /**
   * 마지막 동기화 실패 시각(ISO). 성공하면 null로 지워진다.
   * 실패를 조용히 삼키면 사용자는 "저장됐다"고 믿게 되므로, 이 값을 헤더·마이페이지에 노출한다.
   */
  syncFailedAt: string | null;
  /**
   * 이 기기에서 로그인해 본 적이 있는가 — 로그아웃해도 유지(영구).
   * 비로그인 상태일 때 "재방문 사용자에게만" 로그인 리마인드 말풍선을 띄우는 판별용.
   */
  hasLoggedInBefore: boolean;
  /** 실패 시 throw(화면이 인라인 에러로 표시). 성공 시에만 상태 갱신. */
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** 프로필 완성/수정. 성공 시 user 갱신. 실패 시 throw(화면이 인라인 에러). */
  updateProfile: (input: {
    birthYear: number;
    gender: 'male' | 'female';
    interests: string[];
  }) => Promise<void>;
  /** 닉네임 설정/변경. 성공 시 user 갱신. 중복(409) 등 실패 시 throw(시트가 인라인 에러). */
  updateNickname: (nickname: string) => Promise<void>;
  /**
   * 이미 로그인된 세션에서 서버 단어장 변경을 로컬로 당겨온다(다른 기기에서 추가한 단어 반영).
   * 앱 시작·포그라운드 복귀 시 호출. 비치명적(실패는 warn, 다음 기회에 재시도).
   * reconcileForUser(로그인 시)와 달리 다운로드만 — 업로드는 auto-sync가 담당.
   */
  pullRemoteJournal: () => Promise<void>;
  /** 동기화 성공 기록 — 시각 갱신 + 실패 표시 해제. (auto-sync 등 store 밖에서도 호출) */
  markSynced: () => void;
  /** 동기화 실패 기록 — 화면에 경고를 띄우기 위한 표시. */
  markSyncFailed: () => void;
  /**
   * 사용자가 경고를 보고 직접 재시도. 로그인 reconcile과 같은 순서(업로드→다운로드).
   * 성공/실패 표시는 안에서 처리하고, 호출한 화면은 await로 "동기화 중…"만 보여주면 된다.
   */
  retrySync: () => Promise<void>;
  /** 출석 적립 등으로 잔액만 갱신(서버 응답값으로). */
  setBalance: (balance: number) => void;
  /** 동의 완료 표시(서버 기록 후). */
  setRecallConsented: () => void;
  /** 인증만 해제. 로컬 단어장은 보존. */
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      lastSyncedAt: null,
      syncFailedAt: null,
      hasLoggedInBefore: false,
      signup: async (email, password) => {
        const { token, user } = await signupApi(email, password);
        set({ token, user, hasLoggedInBefore: true });
        await reconcileForUser(user.id, token, set);
      },
      login: async (email, password) => {
        const { token, user } = await loginApi(email, password);
        set({ token, user, hasLoggedInBefore: true });
        await reconcileForUser(user.id, token, set);
      },
      updateProfile: async (input) => {
        const token = get().token;
        if (!token) throw new Error('로그인이 필요합니다.');
        const { user } = await updateProfileApi(token, input);
        set({ user });
      },
      updateNickname: async (nickname) => {
        const token = get().token;
        if (!token) throw new Error('로그인이 필요합니다.');
        const { user } = await updateNicknameApi(token, nickname);
        set({ user });
      },
      pullRemoteJournal: async () => {
        const token = get().token;
        if (!token) return; // 익명 — 서버 없음
        try {
          await downloadJournal(token);
          set({ lastSyncedAt: new Date().toISOString(), syncFailedAt: null });
        } catch (e) {
          console.warn('[auth] 포그라운드 다운로드 실패 (다음 기회에 재시도):', e);
          set({ syncFailedAt: new Date().toISOString() });
        }
      },
      markSynced: () => set({ lastSyncedAt: new Date().toISOString(), syncFailedAt: null }),
      markSyncFailed: () => set({ syncFailedAt: new Date().toISOString() }),
      retrySync: async () => {
        const token = get().token;
        if (!token) return; // 익명 — 동기화할 서버가 없음
        try {
          const res = await syncJournal(token);
          if (res.recordBonus) get().setBalance(res.recordBonus.balance);
          await downloadJournal(token);
          set({ lastSyncedAt: new Date().toISOString(), syncFailedAt: null });
        } catch (e) {
          console.warn('[auth] 수동 재동기화 실패:', e);
          set({ syncFailedAt: new Date().toISOString() });
        }
      },
      setBalance: (balance) => {
        const user = get().user;
        if (user) set({ user: { ...user, balance } });
      },
      setRecallConsented: () => {
        const user = get().user;
        if (user) set({ user: { ...user, recallConsented: true } });
      },
      logout: () => set({ token: null, user: null, lastSyncedAt: null, syncFailedAt: null }),
    }),
    {
      name: 'define-auth-v1', // 모델 깨는 변경 시 v2로 마이그레이션
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * 저장된 인증 상태를 다 읽었는지 구독하는 훅.
 *
 * AsyncStorage 읽기가 비동기라 앱 시작 직후엔 token이 잠깐 null이다. 이걸 "로그아웃"으로
 * 오해하면 로그인 사용자에게도 가입 유도 화면이 한 번 깜빡인다 — 게이트는 이 값이 true가
 * 된 뒤에만 판단한다.
 *
 * 왜 store 상태가 아니라 훅인가: store에 넣으면 값을 올리는 setState가 곧바로 persist 저장을
 * 부르는데, 웹 SSR(노드)에는 window가 없어 그 저장이 터진다(dev 서버가 죽는다).
 * zustand persist가 주는 hasHydrated/onFinishHydration만 읽으면 저장을 건드리지 않는다.
 */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  useEffect(() => {
    // 구독을 거는 사이에 이미 끝났을 수 있어 한 번 더 확인한다.
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/**
 * 로그인/가입 직후 단어장 정합 — 로컬 데이터의 "주인"에 따라 갈린다.
 * 비치명적(인증은 이미 성공, sync 실패해도 로그인 유지·다음 로그인이 복구).
 *
 * - 로컬 주인 ≠ 로그인 계정  → **계정 전환**: 업로드 금지(오염 차단) + 로컬 비우고 서버 것만.
 * - 로컬 주인 = null(익명) 또는 = 로그인 계정 → 소유권 클레임 + 양방향 sync(업로드→다운로드).
 *
 * 오염 버그(다른 계정 로컬 데이터가 새 계정에 업로드되던 문제)의 핵심 방어선.
 */
async function reconcileForUser(
  userId: string,
  token: string,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> {
  const localOwner = getLocalOwner();

  // 계정 전환 — 이전 계정 로컬 데이터를 새 계정에 올리지 않는다. 로컬 비우고 서버 것만 내려받음.
  if (localOwner !== null && localOwner !== userId) {
    resetLocalForAccount(userId);
    try {
      await downloadJournal(token);
      set({ lastSyncedAt: new Date().toISOString(), syncFailedAt: null });
    } catch (e) {
      console.warn('[auth] 전환 후 다운로드 실패 (다음 로그인에 재시도):', e);
      set({ syncFailedAt: new Date().toISOString() });
    }
    return;
  }

  // 익명 첫 로그인 or 같은 계정 재로그인 — 이 로컬은 이 계정 것. 기존 양방향 reconcile.
  claimLocalOwner(userId);
  // 업로드 실패가 다운로드를 막지 않도록 분리(멱등 재동기화가 복구).
  // 둘 중 하나라도 실패하면 경고를 남긴다 — 이번 로그인의 결과만 반영해야 하므로
  // 지난 세션에 persist된 경고에 의존하지 않고 지역 변수로 판정한다.
  let failed = false;
  try {
    const res = await syncJournal(token);
    if (res.recordBonus) {
      useAuthStore.getState().setBalance(res.recordBonus.balance);
    }
  } catch (e) {
    console.warn('[auth] 업로드 실패 (다운로드는 계속 진행):', e);
    failed = true;
  }
  try {
    await downloadJournal(token);
  } catch (e) {
    console.warn('[auth] 다운로드 실패 (다음 로그인에 재시도):', e);
    failed = true;
  }
  set(
    failed
      ? { syncFailedAt: new Date().toISOString() }
      : { lastSyncedAt: new Date().toISOString(), syncFailedAt: null },
  );
}
