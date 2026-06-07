# 프론트 인증 연결 + 동기화 설계 (Spec)

> 작성일 2026-06-07 · 범위: **프론트 1차 — 인증 기반 + 업로드 동기화** (게이트 3탭은 2차 별도 계획)
> 선행: 백엔드 마일스톤2 완료(main). 근거: [PLANNING.md](../../PLANNING.md) §5 · [DEVELOPMENT.md](../../DEVELOPMENT.md) §0·§5

## 1. 목적

익명우선 모델에서 **회원가입·로그인**과 **로컬 단어장(entries)의 서버 업로드 동기화**를 프론트에 연결한다. 실제 백엔드(`/api/auth/*`, `/api/journal/import`)와 end-to-end로 동작하는 완결 슬라이스. 가입 유도 게이트(광장·회고·과거의나)는 이 auth 상태를 재사용하는 2차 레이어로 분리한다.

진입점은 **마이페이지**(이미 존재, IA상 계정 홈): 로그아웃 상태 = 「로그인/회원가입」, 로그인 상태 = 이메일 + 로그아웃 + 동기화 상태.

## 2. 확정된 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|------|------|
| 범위 | 인증 기반 + **업로드** 동기화. 게이트 3탭은 2차 |
| 진입점 | 마이페이지 계정 섹션 → `/auth` 풀스크린 라우트 |
| 화면 형태 | 한 화면, **로그인↔가입 토글** |
| 토큰 저장 | **async-storage**(auth-store persist). 웹 포함 전 환경. secure-store 승격은 후속 |
| 동기화 트리거 | **회원가입 + 로그인 둘 다**(백엔드 멱등이라 안전) |
| 동기화 방향 | **업로드 전용**(로컬→서버). 다운로드(서버→로컬)는 `GET /journal` 필요 → 후속 |
| 로그아웃 | 인증만 해제, **로컬 단어장(journal-store)은 유지** |
| 닉네임 정합 | 후속(지금 계정 표시는 이메일) |

## 3. 파일 구조

**신규**
```
src/services/api-client.ts     fetch 래퍼 — baseURL + JSON + Bearer 주입 + 에러→{status,message}
src/services/auth-api.ts       signup(email,pw) / login(email,pw)
src/services/journal-api.ts    importJournal(token, entries) → {imported, updated}
src/store/auth-store.ts        token·user·lastSyncedAt + signup/login/logout (persist)
src/lib/sync-journal.ts        로컬 entries → import payload 변환 후 업로드 (멱등)
src/app/auth.tsx               /auth 풀스크린 라우트 (로그인↔가입 토글 폼)
```
**수정**
```
src/app/_layout.tsx            루트 Stack에 auth 라우트 등록 (headerShown:false 유지)
src/app/mypage.tsx             계정 섹션 추가 (로그아웃/로그인 상태 분기)
```

**경로 규칙**: `@/X` = `src/X`. 파일/폴더 kebab-case, 컴포넌트 PascalCase, 훅 `use`+camelCase.

## 4. API 클라이언트 (`services/`)

- `api-client.ts`:
  - `const API_BASE = 'http://localhost:3000/api'` — 상수 1곳. **실기기 빌드 시 LAN IP로 교체할 자리**(주석 명시). 웹 검증에선 localhost 동작.
  - `request<T>(path, { method, body?, token? })`: JSON 직렬화 + `Content-Type` + (token 있으면) `Authorization: Bearer` 주입 → 응답 `ok`면 파싱, 아니면 `{ status, message }` throw(서버 에러 body의 `message` 사용).
- `auth-api.ts`: `signup`/`login` — `request`로 `POST /auth/signup`·`/login`, `{ token, user }` 반환.
- `journal-api.ts`: `importJournal(token, entries)` — `POST /journal/import`, `{ imported, updated }` 반환.

## 5. auth-store (`define-auth-v1`, async-storage persist)

```
state:
  token: string | null
  user: { id: string; email: string; nickname: string | null } | null
  lastSyncedAt: string | null        // ISO. 마이페이지 동기화 표시용
actions:
  signup(email, password): Promise<void>   // 성공 → token·user 저장 → 동기화 → lastSyncedAt
  login(email, password): Promise<void>     // 위와 동일
  logout(): void                            // token·user·lastSyncedAt만 비움 (journal-store 불변)
```

- 토큰이 persist되어 앱 재시작 시 로그인 유지.
- `signup`/`login`은 실패 시 throw(화면이 인라인 에러로 표시). 성공 시에만 상태 갱신.
- **journal-store를 직접 import하지 않는다** — 동기화는 `lib/sync-journal.ts`에 위임(관심사 분리). 액션은 `syncJournal(token)`을 호출만.

## 6. 동기화 (`lib/sync-journal.ts`)

```
syncJournal(token): Promise<{ imported: number; updated: number }>
```
- `useJournalStore.getState().entries`를 읽어 `{ clientId: e.id, word: e.word, text: e.text, changeNote: e.changeNote, savedAt: e.savedAt }`로 변환 → `journal-api.importJournal(token, payload)`.
- 로컬 `SavedEntry.id` → 서버 `clientId` 보존 → 백엔드 `(userId, clientId)` 멱등 upsert. **가입·로그인마다 호출해도 중복 안 쌓임.**
- entries가 0개면 호출 생략(빈 배열은 백엔드 `@ArrayMinSize(1)`에 걸리므로). 결과 카운트는 auth-store가 받아 표시에 사용.
- **동기화 실패는 비치명적**: 인증(token 발급)은 이미 성공했으므로 sync가 throw해도 **로그인 상태는 롤백하지 않는다**. 실패는 조용히 삼키고(콘솔 경고), 다음 로그인의 멱등 재동기화가 자연히 복구. → auth-store 액션은 sync를 `try/catch`로 감싸 인증 성공과 분리.

## 7. /auth 화면 (풀스크린 라우트)

- 한 화면, 상태 `mode: 'login' | 'signup'` 토글. 이메일·비밀번호 2필드(기존 `TextField` 재사용), 제출 `Button`, 하단에 모드 전환 텍스트 링크("계정이 없으세요? 가입하기" ↔ "이미 계정이 있으세요? 로그인").
- **클라 검증**(제출 전): 이메일 형식 + 비밀번호 8자. 위반 시 필드 아래 인라인 메시지.
- **서버 에러 인라인 매핑**(문구는 추후 다듬음 — 이번엔 합리적 기본값): 409 → "이미 가입된 이메일이에요" / 401 → "이메일 또는 비밀번호를 확인해 주세요" / 기타·네트워크 → "연결이 불안정해요. 잠시 후 다시 시도해 주세요".
- **시스템 다이얼로그 X**(UX 원칙). 성공 시 부드럽게 `router.back()` → 마이페이지가 로그인 상태로 전환(트랜지션 유지). 제출 중 로딩 상태 표시(버튼 비활성/스피너).

## 8. 마이페이지 계정 섹션 (`mypage.tsx` 수정)

- **로그아웃 상태**: 「로그인 / 회원가입」 행 → `router.push('/auth')`.
- **로그인 상태**: 이메일 표시 + 동기화 상태(`lastSyncedAt` 있으면 "동기화됨" 정도, 없으면 생략) + 「로그아웃」 행.
- 로그아웃은 우리 톤 `ConfirmDialog`로 한 번 확인(시스템 Alert X). 확인 시 `auth-store.logout()` — 로컬 단어장은 그대로.
- 기존 마이페이지 구성(테마 토글·닉네임·버전 등)은 **무변경**, 계정 섹션만 추가.

## 9. 검증 목표 (통과 기준)

테스트 프레임워크 없음 → 기존 프론트 컨벤션(Expo Web + 시스템 Chrome headless, `pageerror` 0)으로:

1. 백엔드 기동(`back`, :3000) + Expo Web 기동
2. `/auth`에서 **회원가입** → 마이페이지가 로그인 상태(이메일 표시)로 전환
3. 백엔드 확인(curl 또는 DB)으로 로컬 entries가 서버에 **업로드됨**(import 카운트 > 0)
4. **로그아웃**(ConfirmDialog) → 로그인 상태 해제, **로컬 단어장 유지**(단어장 탭에 그대로)
5. 같은 계정 **재로그인** → 재업로드해도 **중복 없음**(서버 카운트 불변, 멱등)
6. 만진 파일 `npx tsc --noEmit` 에러 0

## 10. 범위 밖 / 보류 (명시)

- **게이트 3탭**(광장·회고·과거의나 가입 유도 잠금/블러) — 2차 계획.
- **다운로드 동기화**(서버→로컬) — 백엔드 `GET /journal` 선행 필요. 재설치/다른 기기 복원은 이후.
- **닉네임 서버↔로컬 정합** — 지금 계정 표시는 이메일만.
- **에러 문구 다듬기** — 이번엔 합리적 기본값, 카피라이팅은 후속.
- **expo-secure-store 승격 / refresh 토큰 / 소셜 로그인 / 다중기기 양방향** — 후속.
