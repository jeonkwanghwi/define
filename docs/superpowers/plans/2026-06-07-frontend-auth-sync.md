# 프론트 인증 연결 + 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이페이지에서 진입하는 `/auth` 화면으로 회원가입·로그인하고, 인증 직후 로컬 단어장(entries)을 서버로 멱등 업로드한다.

**Architecture:** `services/`에 얇은 API 계층(fetch 래퍼 + auth/journal 함수), `store/auth-store.ts`(zustand+persist, 기존 store 패턴)가 인증 상태·토큰을 보유하고 성공 시 `lib/sync-journal.ts`로 업로드를 위임(관심사 분리 — auth-store는 journal-store를 모름). `/auth`는 풀스크린 라우트(로그인↔가입 토글), 마이페이지에 계정 섹션 추가.

**Tech Stack:** React Native / Expo Router · Zustand + AsyncStorage · 기존 primitives(Button/TextField/ConfirmDialog) · theme 토큰

**검증 방식:** 테스트 프레임워크 없음 → 기존 프론트 컨벤션을 따른다. 플러밍 태스크는 `npx tsc --noEmit`(타입 통과)로, 통합(Task 6)은 **Expo Web + 백엔드 구동 + curl/DB 확인**으로 검증. 각 태스크 끝에 커밋.

**기준 디렉터리:** 모든 명령은 `front/mobile/`에서 실행. 파일 경로는 `front/mobile/` 기준. 임포트 alias `@/X` = `src/X`. git repo 루트는 `/Users/kwanghwi/dev/define`.

**스펙:** [docs/superpowers/specs/2026-06-07-frontend-auth-sync-design.md](../specs/2026-06-07-frontend-auth-sync-design.md)

**참고(기존 패턴):** store=`src/store/settings-store.ts`(persist 구조) · primitives=`src/components/primitives/{button,text-field,confirm-dialog}.tsx` · 화면=`src/app/mypage.tsx`(헤더·Row·Group·ThemedText/ThemedView·useTheme).

---

## File Structure

**신규**
```
src/services/api-client.ts     fetch 래퍼 — API_BASE + JSON + Bearer + 에러→{status,message}
src/services/auth-api.ts       signup / login (AuthResult 반환)
src/services/journal-api.ts    importJournal(token, entries) → {imported,updated}
src/lib/sync-journal.ts        journal-store entries → import payload 변환·업로드 (멱등)
src/store/auth-store.ts        token·user·lastSyncedAt + signup/login/logout (persist)
src/app/auth.tsx               /auth 풀스크린 (로그인↔가입 토글)
```
**수정**
```
src/app/mypage.tsx             "계정" 섹션 추가 (로그아웃/로그인 분기)
```
**수정 불필요**: `src/app/_layout.tsx` — `<Stack>`이 `app/` 파일을 자동 라우팅하므로 `auth.tsx`는 별도 등록 없이 `/auth`로 동작(기존 `mypage.tsx`와 동일).

---

## Task 1: API 클라이언트 (`services/api-client.ts`)

**Files:**
- Create: `src/services/api-client.ts`

- [ ] **Step 1: 파일 작성**

```ts
/**
 * api-client — 백엔드(NestJS) 호출 공용 fetch 래퍼.
 * JSON 직렬화 + (토큰 있으면) Bearer 주입 + 응답 에러를 {status, message}로 정규화.
 * 각 도메인 함수(auth-api/journal-api)는 이걸 통해서만 서버와 통신한다.
 */

/**
 * 개발 기본값 = localhost. 웹/시뮬레이터에선 동작.
 * ★ 실기기(Expo Go/EAS) 빌드 시 이 한 줄을 개발 머신 LAN IP로 교체:
 *   예) 'http://192.168.0.10:3000/api'
 */
export const API_BASE = 'http://localhost:3000/api';

/** 서버 에러를 화면이 다루기 쉬운 형태로. */
export type ApiError = { status: number; message: string };

type RequestOptions = {
  method: 'GET' | 'POST';
  body?: unknown;
  token?: string;
};

/**
 * 한 번의 API 호출. 성공이면 파싱된 T, 실패면 ApiError를 throw.
 * (NestJS 검증 에러는 message가 배열일 수 있어 첫 항목을 쓴다.)
 */
export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    let message = '요청을 처리하지 못했어요.';
    try {
      const data = await res.json();
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message[0] : data.message;
      }
    } catch {
      // body가 JSON이 아니면 기본 메시지 유지
    }
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 새 파일로 인한 에러 0. (기존 `/mypage` 관련 typed-routes 경고가 있을 수 있으나 무관 — 이번 파일과 상관없음.)

- [ ] **Step 3: 커밋**

```bash
git add front/mobile/src/services/api-client.ts
git commit -m "feat(front): API 클라이언트 fetch 래퍼 (Bearer·에러 정규화)"
```

---

## Task 2: auth/journal API 함수 (`services/auth-api.ts`, `services/journal-api.ts`)

**Files:**
- Create: `src/services/auth-api.ts`
- Create: `src/services/journal-api.ts`

- [ ] **Step 1: `auth-api.ts` 작성**

```ts
/**
 * auth-api — 회원가입/로그인 호출. 백엔드 계약(POST /api/auth/*)에 1:1.
 * 응답에 passwordHash는 없음(서버가 token+공개 user만 반환).
 */
import { apiRequest } from './api-client';

export type AuthUser = {
  id: string;
  email: string;
  nickname: string | null;
};

export type AuthResult = {
  token: string;
  user: AuthUser;
};

/** POST /api/auth/signup */
export function signup(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/signup', {
    method: 'POST',
    body: { email, password },
  });
}

/** POST /api/auth/login */
export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest<AuthResult>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}
```

- [ ] **Step 2: `journal-api.ts` 작성**

```ts
/**
 * journal-api — 로컬 단어장 서버 업로드. POST /api/journal/import (Bearer 필요).
 * 백엔드가 (userId, clientId) 멱등 upsert → 같은 payload 재전송해도 중복 안 쌓임.
 */
import { apiRequest } from './api-client';

/** 서버로 보내는 entry 한 개. 로컬 SavedEntry.id가 clientId로 보존된다. */
export type ImportEntry = {
  clientId: string;
  word: string;
  text: string;
  changeNote?: string;
  savedAt: string; // ISO
};

export type ImportResult = {
  imported: number;
  updated: number;
};

/** POST /api/journal/import */
export function importJournal(token: string, entries: ImportEntry[]): Promise<ImportResult> {
  return apiRequest<ImportResult>('/journal/import', {
    method: 'POST',
    token,
    body: { entries },
  });
}
```

- [ ] **Step 3: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add front/mobile/src/services/auth-api.ts front/mobile/src/services/journal-api.ts
git commit -m "feat(front): auth/journal API 함수"
```

---

## Task 3: 동기화 변환·업로드 (`lib/sync-journal.ts`)

**Files:**
- Create: `src/lib/sync-journal.ts`

- [ ] **Step 1: 파일 작성**

```ts
/**
 * sync-journal — 로컬 단어장을 서버로 업로드(멱등). 인증 직후 호출.
 *
 * journal-store에서 직접 entries를 읽어 import payload로 변환한다.
 * → auth-store는 journal-store를 import하지 않는다(관심사 분리). 변환·업로드는 여기 한 곳.
 *
 * 로컬 SavedEntry.id → 서버 clientId 보존 → 백엔드 (userId, clientId) 멱등 upsert.
 * entries가 0개면 호출 생략(서버 @ArrayMinSize(1) 위반 회피).
 */
import { importJournal, type ImportEntry, type ImportResult } from '@/services/journal-api';
import { useJournalStore } from '@/store/journal-store';

export async function syncJournal(token: string): Promise<ImportResult> {
  const { entries } = useJournalStore.getState();
  if (entries.length === 0) {
    return { imported: 0, updated: 0 };
  }

  const payload: ImportEntry[] = entries.map((e) => ({
    clientId: e.id,
    word: e.word,
    text: e.text,
    changeNote: e.changeNote,
    savedAt: e.savedAt,
  }));

  return importJournal(token, payload);
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 0. (`useJournalStore.getState()`는 zustand 표준 — 훅 밖 접근.)

- [ ] **Step 3: 커밋**

```bash
git add front/mobile/src/lib/sync-journal.ts
git commit -m "feat(front): 로컬 단어장 업로드 동기화 (journal-store→import 변환)"
```

---

## Task 4: auth-store (`store/auth-store.ts`)

**Files:**
- Create: `src/store/auth-store.ts`

- [ ] **Step 1: 파일 작성** (settings-store와 동일한 persist 구조)

```ts
/**
 * 인증 글로벌 상태 — Zustand store + AsyncStorage 영속 (settings/journal-store와 동일 패턴).
 *
 * token이 persist되어 앱 재시작 시 로그인 유지.
 * signup/login 성공 → token·user 저장 → 로컬 단어장을 서버로 동기화(가입·로그인 둘 다, 멱등).
 * logout → 인증 상태만 비움. 로컬 단어장(journal-store)은 절대 건드리지 않음.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { syncJournal } from '@/lib/sync-journal';
import { login as loginApi, signup as signupApi, type AuthUser } from '@/services/auth-api';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  /** 마지막 동기화 시각(ISO). 마이페이지 표시용. */
  lastSyncedAt: string | null;
  /** 실패 시 throw(화면이 인라인 에러로 표시). 성공 시에만 상태 갱신. */
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** 인증만 해제. 로컬 단어장은 보존. */
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
 */
async function runSync(
  token: string,
  set: (partial: Partial<AuthState>) => void,
): Promise<void> {
  try {
    await syncJournal(token);
    set({ lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    console.warn('[auth] 동기화 실패 (다음 로그인에 재시도):', e);
  }
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 에러 0.

- [ ] **Step 3: 커밋**

```bash
git add front/mobile/src/store/auth-store.ts
git commit -m "feat(front): auth-store (persist + 가입/로그인 시 멱등 동기화)"
```

---

## Task 5: /auth 화면 (`app/auth.tsx`)

**Files:**
- Create: `src/app/auth.tsx`

- [ ] **Step 1: 화면 작성** (기존 mypage 헤더·톤 컨벤션 재사용)

```tsx
/**
 * /auth — 로그인 ↔ 회원가입 토글 풀스크린. 마이페이지에서 진입.
 *
 * (tabs) 밖의 루트 Stack 화면(mypage와 동일하게 자동 라우팅 + 자체 back 헤더).
 * 성공 시 router.back()으로 마이페이지에 로그인 상태가 반영된다.
 * 시스템 다이얼로그 X — 검증/서버 에러는 인라인 메시지(우리 톤).
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, TextField } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import type { ApiError } from '@/services/api-client';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const theme = useTheme();
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const login = useAuthStore((s) => s.login);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  function validate(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '올바른 이메일 형식이 아니에요.';
    if (password.length < 8) return '비밀번호는 8자 이상이에요.';
    return null;
  }

  async function handleSubmit() {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      router.back();
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError(null);
  }

  return (
    <ThemedView bg="paper" style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* ─── 헤더 ─── */}
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.iconBtn}>
            <Icon name="back" size={22} color={theme.colors.ink.strong} />
          </Pressable>
          <ThemedText variant="h3" style={{ flex: 1, textAlign: 'center' }}>
            {isSignup ? '회원가입' : '로그인'}
          </ThemedText>
          <View style={styles.iconBtn} />
        </View>

        {/* ─── 본문 ─── */}
        <View style={styles.body}>
          <ThemedText variant="h1" style={{ marginBottom: theme.spacing.s7 }}>
            {isSignup ? '나만의 정의를\n저장해 보세요' : '다시 만나서\n반가워요'}
          </ThemedText>

          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="이메일"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={{ marginBottom: theme.spacing.s3 }}
          />
          <TextField
            value={password}
            onChangeText={setPassword}
            placeholder="비밀번호 (8자 이상)"
            autoCapitalize="none"
            secureTextEntry
            style={{ marginBottom: theme.spacing.s2 }}
          />

          {error ? (
            <ThemedText
              variant="sm"
              style={{ color: theme.colors.ruby.base, marginTop: theme.spacing.s1 }}
            >
              {error}
            </ThemedText>
          ) : null}

          <Button
            label={submitting ? '잠시만요…' : isSignup ? '가입하기' : '로그인'}
            onPress={handleSubmit}
            disabled={submitting}
            fullWidth
            style={{ marginTop: theme.spacing.s5 }}
          />

          <Pressable onPress={toggleMode} style={styles.toggle} hitSlop={8}>
            <ThemedText variant="sm" tone="secondary">
              {isSignup ? '이미 계정이 있으세요? ' : '계정이 없으세요? '}
              <ThemedText variant="sm" style={{ color: theme.colors.point.p600 }}>
                {isSignup ? '로그인' : '가입하기'}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

/** 서버/네트워크 에러 → 우리 톤 인라인 문구(이번엔 합리적 기본값, 카피는 후속). */
function mapAuthError(e: unknown): string {
  const err = e as Partial<ApiError>;
  if (err?.status === 409) return '이미 가입된 이메일이에요.';
  if (err?.status === 401) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (err?.message) return err.message;
  return '연결이 불안정해요. 잠시 후 다시 시도해 주세요.';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  toggle: {
    alignSelf: 'center',
    marginTop: 24,
  },
});
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 새 파일로 인한 에러 0. (참고: `typedRoutes:true`라 `/auth`가 아직 생성된 라우트 타입에 없으면 경고가 날 수 있는데, 이는 기존 `index.tsx`의 `router.push('/mypage')`와 동일한 알려진 typed-routes 이슈 — 무관. 여기선 `router.back()`만 써서 해당 없음. Task 6의 `router.push('/auth')`에서 동일 케이스가 나오면 expo dev 서버 기동 시 자동 재생성됨.)

- [ ] **Step 3: 커밋**

```bash
git add front/mobile/src/app/auth.tsx
git commit -m "feat(front): /auth 로그인·회원가입 화면 (토글·인라인 에러)"
```

---

## Task 6: 마이페이지 계정 섹션 + 풀 검증

**Files:**
- Modify: `src/app/mypage.tsx`

- [ ] **Step 1: import 추가** — `mypage.tsx` 상단 import 블록에 다음을 추가(기존 import는 유지):

```ts
import { ConfirmDialog } from '@/components/primitives';
import { useAuthStore } from '@/store/auth-store';
```

- [ ] **Step 2: 컴포넌트 상단 상태/구독 추가** — `MyPageScreen` 함수 안, 기존 `const [nicknameSheetOpen, setNicknameSheetOpen] = useState(false);` 아래에 추가:

```ts
  const token = useAuthStore((s) => s.token);
  const accountEmail = useAuthStore((s) => s.user?.email ?? null);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const logout = useAuthStore((s) => s.logout);
  const [logoutOpen, setLogoutOpen] = useState(false);
```

- [ ] **Step 3: "계정" 섹션 JSX 삽입** — 프로필 `</Pressable>` 블록(프로필 닫힘) 바로 다음, `{/* ─── 화면 (테마) ─── */}` 주석 **앞에** 삽입:

```tsx
        {/* ─── 계정 ─── */}
        <SectionLabel theme={theme} text="계정" />
        <Group theme={theme}>
          {token ? (
            <>
              <Row
                theme={theme}
                icon="user"
                label={accountEmail ?? '로그인됨'}
                value={lastSyncedAt ? '동기화됨' : undefined}
              />
              <Divider theme={theme} />
              <Row
                theme={theme}
                icon="close"
                label="로그아웃"
                onPress={() => setLogoutOpen(true)}
              />
            </>
          ) : (
            <Row
              theme={theme}
              icon="user"
              label="로그인 / 회원가입"
              onPress={() => router.push('/auth')}
            />
          )}
        </Group>
```

- [ ] **Step 4: 로그아웃 ConfirmDialog 추가** — 파일 하단의 `<NicknameSheet ... />` 바로 다음(같은 `</ThemedView>` 안)에 삽입:

```tsx
      {/* 로그아웃 확인 (시스템 Alert X) */}
      <ConfirmDialog
        visible={logoutOpen}
        title="로그아웃할까요?"
        message="기록한 단어는 이 기기에 그대로 남아요."
        confirmLabel="로그아웃"
        onConfirm={logout}
        onClose={() => setLogoutOpen(false)}
      />
```

- [ ] **Step 5: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 새 변경으로 인한 에러 0. (`router.push('/auth')`가 typed-routes 미생성으로 경고를 내면 기존 `router.push('/mypage')`와 동일한 알려진 이슈. Step 6에서 expo 기동 시 라우트 타입 재생성되어 해소.)

- [ ] **Step 6: 풀 검증 (Expo Web + 백엔드 end-to-end)**

1. 백엔드 기동: 별도 터미널에서 `cd /Users/kwanghwi/dev/define/back && npm run start:dev` (포트 3000 사용 중이면 `lsof -ti:3000 | xargs kill -9` 후 재기동).
2. 프론트 웹 기동: `cd /Users/kwanghwi/dev/define/front/mobile && npx expo start --web` (라우트 타입 자동 재생성됨).
3. 사전 시드: 단어장에 로컬 entry가 있어야 업로드를 검증할 수 있다. 웹에서 기록 탭으로 단어 1~2개 저장하거나, 브라우저 콘솔에서 store에 주입. 검증 절차:
   - 마이페이지 진입(헤더 우상단 아바타) → **계정** 섹션에 「로그인 / 회원가입」 보임.
   - 탭 → `/auth`. **회원가입** 모드로 토글 → 새 이메일+8자 비번 입력 → 가입하기.
   - 성공 시 마이페이지로 복귀, 계정 섹션이 **이메일 + 동기화됨**으로 바뀜.
4. 서버 반영 확인(백엔드 쪽): 위에서 만든 계정으로 curl 로그인 → import가 됐는지 재import로 검증:
```bash
EMAIL="<위에서 가입한 이메일>"; PW="<비번>"
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
# 같은 단어장을 다시 올려보면, 프론트가 이미 올렸으므로 imported:0(전부 updated)이어야 함
curl -s -X POST http://localhost:3000/api/journal/import -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"entries":[{"clientId":"probe-1","word":"검증","text":"x","savedAt":"2026-06-01T00:00:00.000Z"}]}'
```
   - 기대: 프론트가 올린 로컬 entry 수만큼 서버에 존재. (probe로 넣은 건 새 clientId라 imported:1 — 이건 프론트 업로드와 별개 확인용. 핵심은 마이페이지가 "동기화됨"으로 바뀌고, 프론트 entries가 서버에 올라간 것.)
5. **로그아웃**: 계정 섹션 「로그아웃」 → ConfirmDialog → 확인. 로그인 상태 해제(「로그인/회원가입」으로 복귀) + **단어장 탭에 로컬 단어 그대로 유지** 확인.
6. **재로그인**: 같은 계정으로 `/auth` 로그인 → 다시 마이페이지 로그인 상태. (멱등이라 중복 없음.)
7. 브라우저 콘솔 `pageerror` 0 확인.

콘솔/화면으로 위 1~7 확인되면 1차 범위 완료.

- [ ] **Step 7: 커밋**

```bash
git add front/mobile/src/app/mypage.tsx
git commit -m "feat(front): 마이페이지 계정 섹션 (로그인/로그아웃) — end-to-end 검증"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: §3 api-client→T1, auth/journal-api→T2, sync-journal→T3, auth-store→T4, /auth 화면→T5, 마이페이지 계정 섹션→T6. §4~§8 모두 태스크 매핑. §9 검증 6스텝→T6 Step6. _layout 수정은 자동 라우팅이라 불필요(스펙 §3의 해당 항목 제거 — 변경 최소화). 누락 없음.
- **타입 일관성**: `ApiError{status,message}`(T1)↔`mapAuthError`(T5)·`apiRequest`(T2,T3) 일치. `AuthResult/AuthUser`(T2)↔auth-store(T4)·mypage(T6) 일치. `ImportEntry`(T2)↔sync-journal payload(T3) 필드 일치(clientId,word,text,changeNote?,savedAt). `SavedEntry.id→clientId` 매핑 정확. auth-store 액션 시그니처(signup/login/logout)↔auth.tsx 호출 일치.
- **Placeholder**: 없음. 모든 코드 블록 실제 구현.
- **범위**: 프론트 인증+업로드 단일 슬라이스. 게이트·다운로드는 명시적 후속.

---

## 보류 / 후속 (이 계획 밖)
- 게이트 3탭(광장·회고·과거의나 가입 유도) = 2차 계획
- 다운로드 동기화(서버→로컬, `GET /journal` 선행) · 닉네임 서버↔로컬 정합
- 에러 카피 다듬기 · expo-secure-store 승격 · refresh 토큰 · 소셜 로그인
