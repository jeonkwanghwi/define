# 백엔드 auth/동기화 설계 (Spec)

> 작성일 2026-06-07 · 범위: **백엔드만** (프론트 auth-store·게이트·가입/로그인 화면은 후속 별도 계획)
> 근거 문서: [PLANNING.md](../../PLANNING.md) §5(익명우선·탭 게이팅) · [DEVELOPMENT.md](../../DEVELOPMENT.md) §0·§5

## 1. 목적

익명우선 모델에서 **회원가입·로그인·로컬 데이터 서버 동기화**의 백엔드를 구현한다.
이것이 풀리면 광장 → 아바타마을 → 과거의나가 순차로 열리는 **현재 유일한 병목**이다.

마일스톤1(`GET /api/words`)에서 검증한 레이어 패턴(controller→service→repository(인터페이스)→Prisma 구현)을 그대로 확장한다. 학습용 주석 흐름 일관성 유지.

## 2. 확정된 결정 (회의·브레인스토밍 결과)

| 항목 | 결정 |
|------|------|
| 인증 방식 | **이메일 + 비밀번호** (일반). 소셜은 후속 |
| 가입 수집 정보 | **이메일·비밀번호 둘뿐.** 닉네임·프로필은 가입 폼에서 안 받음 |
| 토큰 전략 | **access-only JWT, 90일 만료.** refresh 없음 |
| 비밀번호 해싱 | **bcrypt** |
| 동기화 멱등성 | 로컬 `SavedEntry.id`를 `clientId`로 보존, `(userId, clientId)` 유니크 upsert |
| canonical 단어 연결 | **보류** — `Entry.word`는 문자열만 |

## 3. 데이터 모델 (Prisma)

기존 `Word`(글로벌 추천 풀)는 **변경 없이 유지**. 두 테이블만 추가한다.

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  nickname     String?               // 익명 모델 → 가입 시 미설정 허용
  createdAt    DateTime @default(now())
  entries      Entry[]
}

model Entry {                         // = 로컬 SavedEntry의 서버 쌍둥이
  id         String   @id @default(cuid())  // 서버 PK
  clientId   String                          // 로컬 SavedEntry.id 보존 (멱등성 키)
  userId     String
  word       String                          // 문자열만. canonical FK는 보류
  text       String
  changeNote String?
  savedAt    DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])

  @@unique([userId, clientId])               // 재import 시 중복 방지
}
```

### 설계 근거 (지금 잘 잡아야 하는 구조)

- **`clientId` 멱등성**: 로컬 entry의 `id`를 서버에 보존 → `import`를 두 번 호출해도(재설치·재로그인) `(userId, clientId)` 유니크로 **upsert**, 중복 안 쌓임. PK 전략은 나중에 바꾸기 아프므로 지금 못박는다.
- **`Entry`를 `Word`와 별도 테이블로**: DEVELOPMENT.md §5 — 시스템 정의 단어(canonical 추천 풀)와 사용자 정의 단어(entry)는 성격이 다른 별도 데이터, 다대다 관계라 합칠 수 없음. 관계 카디널리티는 나중에 바꾸기 아프므로 지금 분리.
- **canonical 연결 보류**: 광장 착수 시 `Entry`에 `wordId String?` (nullable FK) 추가 예정. 지금 넣으면 유사도 알고리즘(§6 미확정)까지 끌려옴. nullable FK는 나중에 추가해도 싼 변경.

## 4. 모듈 구조

마일스톤1의 `modules/word/` 레이어 패턴을 그대로 따른다.

```
modules/auth/
  auth.controller.ts        POST /api/auth/signup, POST /api/auth/login
  auth.service.ts           bcrypt 해싱·검증, JWT 발급
  dto/
    signup.dto.ts           { email, password } — class-validator (IsEmail, MinLength)
    login.dto.ts            { email, password }
  user.repository.ts        인터페이스 (findByEmail, create)
  prisma-user.repository.ts Prisma 구현
  jwt.strategy.ts           passport-jwt — Bearer 토큰 검증 → req.user
  jwt-auth.guard.ts         보호 라우트용 가드
  auth.module.ts            DI 바인딩 { provide: UserRepository, useClass: PrismaUserRepository }

modules/journal/
  journal.controller.ts     POST /api/journal/import  (@UseGuards(JwtAuthGuard))
  journal.service.ts        entries upsert by (userId, clientId), imported/updated 카운트
  dto/
    import-journal.dto.ts   { entries: EntryDto[] } — 중첩 검증
  entry.repository.ts       인터페이스 (upsertMany 또는 upsert)
  prisma-entry.repository.ts Prisma 구현
  journal.module.ts
```

### 의존성 추가
- `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` (+ `@types/passport-jwt`, `@types/bcrypt`)
- `JWT_SECRET`·만료(90d)는 기존 `config/`로 주입. `JWT_SECRET`은 `.env`(이미 `back/.gitignore`에서 제외 확인).

## 5. API 계약

| 엔드포인트 | 입력 | 성공 | 실패 |
|---|---|---|---|
| `POST /api/auth/signup` | `{email, password}` | `201 {token, user:{id,email,nickname}}` | `409` 이메일 중복 · `400` 검증 |
| `POST /api/auth/login` | `{email, password}` | `200 {token, user:{id,email,nickname}}` | `401` 자격 불일치 |
| `POST /api/journal/import` | `{entries:[{clientId,word,text,changeNote?,savedAt}]}` + `Authorization: Bearer` | `200 {imported, updated}` | `401` 토큰 없음/만료 · `400` 검증 |

- 응답 `user`에 `passwordHash` 절대 미포함.
- `import` 응답의 `imported`/`updated` 카운트 → 프론트(후속)가 동기화 완료 표시에 사용.
- 전역 `ValidationPipe`(마일스톤1에서 이미 설치)가 DTO 검증 담당.

## 6. 검증 목표 (통과 기준)

마일스톤1처럼 **실제 구동 + curl 시나리오**로 검증한다. 아래 6스텝 통과 = 백엔드 범위 완료.

1. `signup` (새 이메일) → `token` 수신 (**201**)
2. 같은 이메일 재가입 → **409**
3. `login` (같은 자격) → 같은 유저 `token` (**200**)
4. `import` (entry 3개) + Bearer → `{imported:3, updated:0}` (**200**)
5. **같은 payload 재import → `{imported:0, updated:3}`** (멱등성 = 중복 안 쌓임 증명) ★
6. 토큰 없이 `import` → **401**

(가능하면 4·5·6을 NestJS e2e 테스트로도 1개 작성 — 멱등성은 회귀 위험이 큰 핵심 계약이므로.)

## 7. 범위 밖 / 보류 (명시)

- **프론트 연결** — auth-store, 가입 유도 게이트(plaza/mood/past), 가입·로그인 화면. **다음 계획**.
- **소셜 로그인** (Google/Apple/Kakao) — 후속.
- **refresh 토큰** — 광장 본격화 시점에 재검토.
- **canonical 단어 연결** (`Entry.wordId`) — 광장 착수 시 nullable FK로 추가.
- **로그아웃 / 회원 탈퇴 / 다중기기 양방향 동기화** — 후속.
- **분석용 프로필 필드** (`gender`, `birthYear` 등) — 분석 목적. `User`의 nullable 컬럼(또는 필드 증가 시 `Profile` 1:1 테이블)로 향후 추가, 온보딩 설문/마이페이지에서 선택 수집. **제품 세그먼트 아님**(성별 중립, PLANNING §9).
- **이메일 인증(verification)** — MVP 밖. 지금은 형식 검증만.
