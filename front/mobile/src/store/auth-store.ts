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

import { downloadJournal, syncJournal } from '@/lib/sync-journal';
import {
  login as loginApi,
  signup as signupApi,
  updateProfile as updateProfileApi,
  type AuthUser,
} from '@/services/auth-api';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  /** 마지막 동기화 시각(ISO). 마이페이지 표시용. */
  lastSyncedAt: string | null;
  /** 실패 시 throw(화면이 인라인 에러로 표시). 성공 시에만 상태 갱신. */
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** 프로필 완성/수정. 성공 시 user 갱신. 실패 시 throw(화면이 인라인 에러). */
  updateProfile: (input: {
    birthYear: number;
    gender: 'male' | 'female';
    interests: string[];
  }) => Promise<void>;
  /** 출석 적립 등으로 잔액만 갱신(서버 응답값으로). */
  setBalance: (balance: number) => void;
  /** 인증만 해제. 로컬 단어장은 보존. */
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      lastSyncedAt: null,
      signup: async (email, password) => {
        const { token, user } = await signupApi(email, password);
        set({ token, user });
        await runSync(token, set);
      },
      login: async (email, password) => {
        const { token, user } = await loginApi(email, password);
        set({ token, user });
        await runSync(token, set);
      },
      updateProfile: async (input) => {
        const token = get().token;
        if (!token) throw new Error('로그인이 필요합니다.');
        const { user } = await updateProfileApi(token, input);
        set({ user });
      },
      setBalance: (balance) => {
        const user = get().user;
        if (user) set({ user: { ...user, balance } });
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
 * 동기화 실행 — 비치명적. 인증(token 발급)은 이미 성공했으므로 sync가 실패해도
 * 로그인 상태를 롤백하지 않는다. 실패는 콘솔 경고만, 다음 로그인의 멱등 재동기화가 복구.
 *
 * 순서 = 업로드 먼저(로컬→서버), 그다음 다운로드(서버→로컬).
 *   업로드로 로컬-only 단어를 서버에 올린 뒤, 다운로드로 서버-only(다른 기기/과거) 단어를
 *   로컬로 복원 → 로그인이 곧 양방향 reconcile. 둘 다 멱등이라 반복 안전.
 */
async function runSync(
  token: string,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> {
  try {
    await syncJournal(token);
    await downloadJournal(token);
    set({ lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[auth] 동기화 실패 (다음 로그인에 재시도):', e);
  }
}
