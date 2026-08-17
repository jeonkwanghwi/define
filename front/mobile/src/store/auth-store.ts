/**
 * 인증 글로벌 상태 — Zustand store + AsyncStorage 영속 (settings/journal-store와 동일 패턴).
 *
 * token이 persist되어 앱 재시작 시 로그인 유지.
 * signup/login 성공 → token·user 저장 → 단어장 reconcile(업로드 로컬→서버 + 다운로드 서버→로컬, 멱등).
 *   다운로드 덕에 새 기기·재설치에서도 로그인하면 단어장이 복원된다.
 * logout → 인증 상태만 비움. 로컬 단어장(journal-store)은 절대 건드리지 않음.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
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
          set({ lastSyncedAt: new Date().toISOString() });
        } catch (e) {
          console.warn('[auth] 포그라운드 다운로드 실패 (다음 기회에 재시도):', e);
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
      logout: () => set({ token: null, user: null, lastSyncedAt: null }),
    }),
    {
      name: 'define-auth-v1', // 모델 깨는 변경 시 v2로 마이그레이션
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

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
      set({ lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('[auth] 전환 후 다운로드 실패 (다음 로그인에 재시도):', e);
    }
    return;
  }

  // 익명 첫 로그인 or 같은 계정 재로그인 — 이 로컬은 이 계정 것. 기존 양방향 reconcile.
  claimLocalOwner(userId);
  // 업로드 실패가 다운로드를 막지 않도록 분리(멱등 재동기화가 복구).
  try {
    const res = await syncJournal(token);
    if (res.recordBonus) {
      useAuthStore.getState().setBalance(res.recordBonus.balance);
    }
  } catch (e) {
    console.warn('[auth] 업로드 실패 (다운로드는 계속 진행):', e);
  }
  try {
    await downloadJournal(token);
    set({ lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[auth] 다운로드 실패 (다음 로그인에 재시도):', e);
  }
}
