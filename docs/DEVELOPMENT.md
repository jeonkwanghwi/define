# define — 개발 (Development)

> 기술 스택 · 현재 상태 · 화면별 구현 · 핵심 아키텍처 · 작업 로그
> 브랜드/BM/정책은 [PLANNING.md](./PLANNING.md) 참조.
>
> 📖 **읽는 법** — 비개발자(기획)는 **§0 현재 작업 상태**만 봐도 전체 진행도가 잡힙니다. §1~5는 기술 상세(필요할 때만), 맨 아래 작업 로그는 결정·변경 히스토리입니다. (JWT·OAuth·임베딩 같은 기술 용어는 정확성을 위해 풀어쓰지 않고 그대로 둡니다.)

---

## 0. 현재 작업 상태 (한눈에)

**✅ 완성된 큰 묶음**
1. RN/Expo 본 프로젝트 + 폴더 구조 + 폴더 지도
2. 디자인 시스템 (색 / 타입 / 스페이싱 / 라운드 / 섀도우 + Pretendard)
3. 아이콘 셋 27개 + 기본 컴포넌트(Button/Card/TextField/ActionSheet/ConfirmDialog)
4. 5개 탭 네비게이션 + 중앙 record chip 강조
5. **메인 기록 화면 풀 동작** — 단어 swap 트랜지션 / DateSheet(과거 날짜 기록) / CustomWordSheet / 저장 완료 마이크로 인터랙션
6. **단어장 + 단어별 타임라인** — 가나다 정렬, 통계, 변화 뱃지, 시간 역순 노드
7. **entry 수정/삭제** — 롱프레스 → 액션시트 → 인라인 편집 / confirm 다이얼로그
8. **익명 영속 store** — Zustand + AsyncStorage. 회원가입 없이 폰에 단어 누적
9. 브랜드 자산(define.png 1024×1024) 통합
10. **마이페이지 + 다크 모드 토글** — 헤더 진입점 / 라이트·다크·시스템 세그먼트 / 닉네임 편집 / 실제 통계 / 버전. 다크 토큰을 토글로 복원
11. **streak·통계 보강** — 연속 기록일(timezone 안전) selector + 단어장 3칸/마이페이지 표시
12. **백엔드 마일스톤1 (NestJS+Prisma)** — 서버 기본 뼈대 1차 동작 확인. `back/` 스캐폴드, `GET /api/words` 풀 슬라이스 동작(controller→service→repository→SQLite). DB 교체 대비 repository 인터페이스로 격리
13. **백엔드 auth/동기화 (마일스톤2)** — 이메일+PW 회원가입/로그인(access-only JWT 90일, bcryptjs) + `POST /api/journal/import`(로컬 entries 서버 동기화, `(userId,clientId)` 멱등 upsert). `User`·`Entry` 테이블 추가. curl 6스텝 검증 통과(가입201/중복409/로그인200/실패401/import 3→0/재import 0→3/무토큰401)
14. **프론트 인증 연결 + 업로드 동기화 (1차)** — 마이페이지 진입 `/auth` 풀스크린(로그인↔가입 토글) + `auth-store`(async-storage persist) + `services/`(api-client·auth·journal) + `lib/sync-journal`. 가입·로그인 시 로컬 entries를 서버로 **멱등 업로드**(비치명적 — 실패해도 로그인 유지), 로그아웃은 로컬 단어장 보존. tsc 클린·웹 번들·백엔드 curl 계약 검증
15. **가입 유도 게이트 (프론트 2차)** — `AuthGate`(token 분기) 컴포넌트로 광장·회고·과거의나 3탭에 잠금 화면 + "가입하고 시작하기" CTA(→`/auth`). 로그인 시 기존 placeholder, 로그아웃 시 게이트(자동 리렌더). 기록·단어장은 무가입. §5 탭 게이팅 정책 구현 — 전환 퍼널(가입 유도→/auth→동기화) 완성. tsc·웹 번들 검증
16. **광장 1차 — 읽기 전용 MVP (컨셉1 단어 중심)** — 데모 시드(유저9+정의36) + `modules/plaza`(단어별 정의 조회, JwtAuthGuard, 내 정의 isMine 맨 위) + plaza 탭 stack 전환(리스트 `/plaza` + 상세 `/plaza/[word]`). 노출=시드+내 정의(나에게만 강조), 상호주의=로그인. 신규 DB 테이블 없음(Entry 재사용). 클린 DB curl+tsc+웹 번들 검증
17. **다운로드 동기화 (서버→로컬) + 로그인 reconcile** — `GET /api/journal`(JwtAuthGuard, 내 entries 최신순) + 프론트 `getJournal`/`downloadJournal`/store `mergeEntries`(id=clientId union·로컬우선·멱등·savedAt정렬). 로그인/가입 시 **업로드 후 다운로드**(reconcile, 비치명적) → **새 기기·재설치에서 단어장 복원**. 신규 DB 테이블 없음(Entry 재사용). curl 계약+merge 로직+실서버 e2e(login→GET→복원3)+tsc 검증

**🟡 다음 후보 (우선순위 미정)**
- **광장 2차**: 추천(좋아요)+추천순 정렬 → 3차 신고/모더레이션
- **저장-시 업로드 + 삭제 동기화**: 현재 업로드는 로그인 때 1회 → 매 변경(addEntry/edit) 시 push로 확장. 삭제는 delete 엔드포인트/tombstone 필요. (다운로드는 17에서 완료)
- **각 탭 실제 기능**: 마을(좌2)/과거의나 (광장은 1차 완료). 명시적 공개/비공개 동의는 배포·다유저 시
- **좌2 마을** — 2D 픽셀아트 목업 구동(`/village-demo` dev 라우트, 백엔드 0). 탭 라우트는 `village`. **2D/3D 렌더링 방향은 팀 논의 중**(§6 결정 브리프). 회고/검색/주간 회고는 대체 후보로 보류
- 과거의 나와 대화 (GPT API 종속)
- 마이페이지 후속: 알림/PDF/프리미엄 실제 기능, 다크 톤 실기기 대비 점검

**⏳ 큰 결정 대기**
- ~~백엔드 시작 시점~~ → **착수함** (NestJS+Prisma, 마일스톤1 완료). 다음: auth → journal 동기화 → plaza
- ~~인증 모델~~ → ✅ **확정(2026-06-06): ① 익명우선 + 탭 게이팅**. 인증 방식(소셜 Google/Apple/Kakao vs 일반) 세부만 구현 시 결정
- **아바타 마을 2D vs 3D** (신규 · 팀 논의 중) — 2D 픽셀아트 목업으로 감 검증 완료. 3D(동물의 숲式) 요청 있음. 렌더러 교체 가능 구조라 결정은 **가역적**. 안건·트레이드오프 §6 참조
- 관리자 모드 (웹 별도 vs 앱 내)
- AI 정의 이미지/영상화 · 금주의 단어
- ~~광장 표시 컨셉~~ → ✅ 확정(2026-06-14): 병행(tab1 광장 / tab2 마을)
- ~~좌2 탭 기능~~ → ✅ 확정(2026-06-14): 마을
- ~~추천 단어 형식~~ → ✅ 확정(2026-06-14): 형식 B + 성격 안 넣음, 50선 반영

---

## 1. 기술 스택 (확정)

| 항목 | 내용 |
|------|------|
| 플랫폼 | iOS / Android (React Native via Expo) |
| Expo SDK | 56 |
| 언어 | TypeScript 6 |
| 라우팅 | Expo Router (file-based, 5탭 + 단어장 stack) |
| 스타일 | StyleSheet + theme 객체 (NativeWind/Tamagui 미사용) |
| 상태 관리 | **Zustand** + **AsyncStorage** (persist 미들웨어) |
| 폰트 | Pretendard Variable (expo-font, 6.4MB ttf 1파일) |
| 아이콘 | react-native-svg 기반 자체 셋 (27개) |
| Node | nvm LTS v24.16.0 |
| 백엔드 | **NestJS** (TypeScript) · REST/JSON. **프론트와 동일 언어**(TS 단일 스택 → DTO 타입 공유 가능). 마일스톤1 동작(`GET /api/words`). 광장/회원가입은 auth부터 본격 착수 |
| 백엔드 아키텍처 | MVC 계열 — **controller / service / repository / dto** 레이어 + 모듈별(`modules/<도메인>/`) 구성. DI로 repository 인터페이스↔구현 바인딩 |
| DB | **시작: SQLite 파일DB** + **Repository 인터페이스로 격리** → 나중에 스왑. 종착 **Postgres 유력**(SQL→SQL 매끄러움; Mongo도 repository가 막아주므로 가능). 구현: **Prisma 제안**(SQLite/Postgres 동일 스키마). 확정은 보류 |
| 인프라/배포 | **AWS** — 회원·데이터 관리 |
| 외부 API | GPT API — 과거의 나. 파인튜닝 전략: 공통 페르소나 1차 파인튜닝 + 유저별 few-shot 최적화. (사진 기반 talking-video는 별도 생성 파이프라인) |

---

## 2. 현재 레포 상태

```
/Users/kwanghwi/dev/define/
├── CLAUDE.md / README.md / LICENSE / .gitignore   # CLAUDE.md=루트 인덱스(자동 로드)
├── docs/                       # PLANNING.md / DEVELOPMENT.md (노션 동기화 대상)
│
├── front/
│   ├── design-source/        # HTML+React 시드/SSOT (RN 포팅 참조 — 위상 유지)
│   ├── vendor/               # 외부 공용 모듈 (tweaks-panel.jsx)
│   └── mobile/               # RN/Expo 본 프로젝트 ★
│       ├── src/
│       │   ├── app/                          # Expo Router 라우트
│       │   │   ├── _layout.tsx               # 폰트 로드 + Stack(headerShown:false)
│       │   │   ├── mypage.tsx                 # 마이페이지 (탭 밖 풀스크린)
│       │   │   ├── village-demo.tsx           # 마을 2D 픽셀아트 목업 (dev 라우트 /village-demo, 탭 밖)
│       │   │   └── (tabs)/
│       │   │       ├── _layout.tsx           # 5탭 + chip 강조
│       │   │       ├── index.tsx             # 기록 (메인)
│       │   │       ├── plaza.tsx             # 광장 (placeholder)
│       │   │       ├── village.tsx           # 마을 (좌2, AuthGate placeholder)
│       │   │       ├── past.tsx              # 과거의 나 (placeholder)
│       │   │       └── journal/
│       │   │           ├── _layout.tsx       # 자체 Stack (push 위함)
│       │   │           ├── index.tsx         # 단어장 리스트
│       │   │           └── [word].tsx        # 단어 상세 타임라인
│       │   ├── components/
│       │   │   ├── primitives/  Button · Card · TextField · ActionSheet · ConfirmDialog
│       │   │   ├── domain/      WordRow · TimelineNode · ChangeBanner
│       │   │   │                DateSheet · CustomWordSheet · SaveConfirmation
│       │   │   │                RecordTabChip · ScreenPlaceholder
│       │   │   │                ThemeModeToggle · NicknameSheet
│       │   │   ├── themed-text.tsx · themed-view.tsx
│       │   ├── theme/           colors/typography/spacing/radii/shadows/fonts/index
│       │   ├── store/           journal-store.ts · settings-store.ts (Zustand+persist)
│       │   ├── data/            recommended-words.ts (mock 단어 풀)
│       │   ├── icons/           index.tsx (27개)
│       │   ├── lib/             format-date.ts
│       │   ├── hooks/           use-color-scheme.ts
│       │   ├── services/, types/   (현재 비어있거나 word.ts만)
│       │   └── README.md        폴더 지도
│       ├── assets/
│       │   ├── fonts/PretendardVariable.ttf
│       │   └── images/define.png   # 1024×1024 로고 — 모든 슬롯 통합 참조
│       ├── CLAUDE.md / AGENTS.md / app.json / package.json / tsconfig.json
│
└── back/                       # NestJS API ★ (마일스톤1: GET /api/words 동작)
    ├── src/{main,app.module}.ts
    │   ├── config/             # 환경변수 설정
    │   ├── database/           # PrismaService(+전역 모듈)
    │   └── modules/word/       # controller·service·repository(+prisma impl)·dto·entity·module
    ├── prisma/{schema.prisma, seed.ts, migrations/}   # SQLite, 데모 6단어 시드
    └── README.md               # 폴더 지도 + 레이어 흐름 설명
```

**경로 규칙**: import 시 `@/X` = `src/X` alias. 파일/폴더는 kebab-case, 컴포넌트는 PascalCase, 훅은 `use`+camelCase.

---

## 3. 디자인 시스템 (구축 완료)

`src/theme/` — 한 번에 useTheme()으로 접근.

| 모듈 | 내용 |
|------|------|
| `colors.ts` | 라이트/다크 페어. paper / surface / ink / line / point(p050~p700) / ruby. Shape 명시 강제 |
| `typography.ts` | 8 variants — display / h1 / h2 / h3 / body / bodyMd / sm / caption |
| `spacing.ts` | 4pt base. s1~s12 |
| `radii.ts` | sm / md / lg / xl / pill |
| `shadows.ts` | sm / md / lg / point(글로우). 라이트/다크 페어 |
| `fonts.ts` | fontFamily.sans = 'PretendardVariable' |
| `index.ts` | useTheme() — 현재 라이트 강제, 다크 토큰은 코드상 유지(추후 토글) |

**컴포넌트 사용 패턴**: `const theme = useTheme(); style={[theme.typography.display, { color: theme.colors.ink.primary }]}`

---

## 4. 화면별 구현 상태

| 화면 | 상태 | 비고 |
|------|------|------|
| **메인 — 기록** (`/`) | ✅ 완료 | 헤더(워드마크+마이페이지) / 단어 swap / DateSheet / CustomWordSheet / SaveConfirmation / **재정의 시 변화 노트 입력**. 저장 시 store.addEntry |
| **단어장 리스트** (`/journal`) | ✅ 완료 | 가나다 정렬, 통계(총 기록/생각 변화), 빈 상태 안내, 변화 뱃지 |
| **단어 상세** (`/journal/[word]`) | ✅ 완료 | 타임라인(노드별 **변화 노트** 표시) + 인라인 편집 + 삭제(ConfirmDialog) + entries=0 시 자동 router.back |
| 광장 (`/plaza`) | 🟡 placeholder | 백엔드 종속 — 다른 사용자 데이터 필요 |
| 마을 (`/village`) | 🟡 placeholder | 아바타 마을(광장 컨셉2) · 2D 픽셀아트 목업 별도(`/village-demo`) · 2D/3D 논의 중 · 회원가입 필요 탭 |
| 과거의 나 (`/past`) | 🟡 placeholder | GPT API 종속 |
| **마이페이지** (`/mypage`) | ✅ 완료 | 헤더 우상단 아바타 진입 / 테마 토글(라·다·시) / 닉네임 편집 / 실제 통계 / 버전. 알림·PDF·프리미엄은 준비중 |
| 온보딩/회원가입/로그인 | ⏳ 미착수 | 인증 모델 확정(① 익명우선) → 다음 착수 대상 |

---

## 5. 핵심 아키텍처 결정

### 익명 사용자 + 로컬 영속 (현재 단계)
회원가입/백엔드 없이도 폰의 AsyncStorage에 단어 누적. 핵심 가치(기록·회고) 검증 가능. 백엔드 도입 시 첫 로그인 마이그레이션으로 서버 전송.

### Store 모델 (flat normalize)
`SavedEntry[]` 한 배열 (`id`, `word`, `text`, `savedAt`). 단어별 그룹화는 selector(`useGroupedByWord`)에서. 모델은 단순, 디스플레이는 자유.
- Store key: `define-journal-v1` (모델 깨면 v2로 마이그레이션)
- 액션: `addEntry(word, text, savedAt?)`, `updateEntry(id, text)`, `removeEntry(id)`, `clearAll`
- `changed`는 entries.length≥2일 때 자동. `changeNote`는 **재정의 시 사용자 입력**(entry 단위, 선택). 자동 생성/ML은 추후. 단어 단위 `JournalWord.changeNote`는 최신 entry 노트로 파생

### 단어 모델: 시스템 정의 단어 vs 사용자 정의 단어 (구분 확정 2026-06-06)
두 단어는 **성격이 다른 별도 데이터**로 관리한다. 한 테이블에 합치지 않는다.
- **시스템 정의 단어 (canonical / 추천 풀)** — 앱이 제공하는 단어 문자열 목록(행복·사랑…). **정의·작성자 없음**, 전 사용자 공통. "오늘의 추천 단어" + **광장 클러스터링의 기준점**. 현 백엔드 `Word` 테이블이 이것 (이름이 헷갈리므로 착수 시 `RecommendedWord` 등으로 명확화 검토).
- **사용자 정의 단어 (entry)** — 사용자가 직접 쓴 `{ word, text, changeNote?, savedAt }`. 유저별·시간순 누적. 로컬 `SavedEntry[]`가 이것, 회원가입 시 서버 `Entry` 테이블로 동기화.
- 한 단어("행복")에 **시스템 단어 1개 ↔ 여러 사용자의 여러 entry**가 다대다로 매달림 → 분리 불가피.
- 사용자 entry의 `word`는 (a) 시스템 단어에 **연결**(canonical)되거나 (b) 순수 커스텀(연결 안 됨)일 수 있음.

#### 유사 단어 제안 흐름 (커스텀 단어 추가 시) — 계획
사용자가 추천 풀에 없는 단어를 직접 추가할 때, 시스템 정의 단어 중 **의미가 유사한 단어가 있으면** 1회 제안한다.
1. 입력(예: "행복함") → 시스템 단어 풀에서 유사 검색 → "행복" 발견.
2. 우리 톤 시트로 제안: *"혹시 '행복'을 말하나요? 같은 단어로 모으면 다른 사람의 '행복' 정의도 볼 수 있어요."*
3. 사용자 선택:
   - **"맞아요"** → 기존 **시스템 단어 사용**(canonical 연결). 광장에서 같은 단어 아래 모임.
   - **"아니요, 다른 의미예요"** → 입력 그대로 **사용자 정의 단어로 추가**(주관 존중).
- **왜**: 광장에서 "행복/행복함/행복이"로 의미가 파편화되면 "남들은 이 단어를 어떻게 정의하나" 가치가 깨짐 → canonical로 모음. 단 **강제 병합 X, 제안만** (브랜드: 첫 정의는 가볍게, 유사어 있을 때만 노출).
- 시스템 풀이 작으므로(50선~) 입력 1개 vs 풀 전체 비교는 즉시 가능. 유사도 판별 방법은 §6 미확정 참조.

### 라우팅
- `(tabs)/` — Bottom Tabs (5탭, URL에 안 들어가는 그룹)
- `(tabs)/journal/_layout.tsx` — 단어장 탭 안에서 push 전환을 위한 별도 Stack
- 동적 라우트 `[word].tsx` — `useLocalSearchParams<{word:string}>` + 자동 디코드

### 트랜지션·UX 패턴
- 모든 시트는 RN Modal + animationType="slide" + 외부 scrim 탭 닫기 + 내부 탭 차단
- 시트 슬라이드업 후 250ms 딜레이로 autoFocus (키보드 등장 자연스럽게)
- 액션시트/confirm 닫힘 → setTimeout(다음 액션, 180-200ms) — 모달 충돌 방지
- 단어 swap, chip 활성 전환 등 모든 상태 변화는 Animated 보간 (180-220ms)
- 시스템 Alert·ActionSheet 일절 X — 우리 톤의 커스텀 컴포넌트만

### 테마 시스템
- `useTheme()` = settings-store의 `themeMode` + (system이면) `useColorScheme()`로 라이트/다크 분기. 기본 'light'.
- 다크 토큰은 `darkColors`, `darkShadows`로 1급 시민 유지 → 마이페이지 `ThemeModeToggle`로 즉시 전환.
- 모드 변경 시 useTheme 구독 컴포넌트 전체 자동 리렌더 (Context 없이 Zustand selector로).

---

## 6. 미확정 / 결정 필요 (개발)

- [x] **백엔드 스택** — **NestJS**(TypeScript) + MVC(controller/service/repository/dto) + REST/JSON. 마일스톤1 동작 완료(`GET /api/words`). (FastAPI→NestJS 변경 경위: 작업 로그 2026-06-03)
- [ ] **DB 종착 확정** — 현재 **SQLite로 시작 + Repository 인터페이스로 격리**(스왑은 바인딩 한 줄). 종착은 **Postgres 유력**(Mongo도 가능). AWS 호스팅 형태(RDS 등)는 확정 시 결정.
- [x] **인증 모델** — ✅ **확정(2026-06-06): ① 익명우선 + 탭 게이팅**. 기록·통계 무가입, 광장·아바타마을·과거의나 가입 유도(잠금/블러). 회원가입 시 로컬→서버 `POST /api/journal/import`. 남은 세부: 인증 방식(소셜 Google/Apple/Kakao / 일반 / 로그아웃)은 구현 시 결정.
- [ ] **단어 의미 유사도 판별 알고리즘** — 유사 단어 제안(§5)의 핵심. 단계 후보: **L0** 정규화/동의어 사전(조사·어미 제거 + 수기 동의어 — 싸고 결정적, "행복함"→"행복") · **L1** 자모 분해(NFD) 후 편집거리(Levenshtein)/자카드(오타·활용형) · **L2** 의미 임베딩 코사인 유사도(예: OpenAI text-embedding-3-small 또는 한국어 특화 — "기쁨"↔"행복" 같은 의미 유사 포착, 서버·비용 필요). **권고**: 초기 L0+L1(클라/서버 가볍게), 광장 규모↑ 시 L2(과거의나 GPT 연동과 임베딩 인프라 재활용). 임계값·계산 위치(클라 vs 서버) 미정.
- [ ] **GPT 연동·비용** — 과거의 나. 파인튜닝(공통 페르소나)+few-shot, 비용 정책
- [ ] **AI 정의 이미지/영상 생성** — 모델·파이프라인·비용(온디바이스 불가 → 서버/외부 API), 릴스式 피드 데이터 모델, 사진 기반 talking-video
- [ ] **관리자 모드** — 웹 별도 어드민 vs 앱 내. 금주의 단어 지정·추천 단어 풀·신고 처리
- [ ] **iOS/Android 실기기 빌드** — 현재는 웹 검증만. EAS Build 시점
- [ ] **광장 데이터 모델** — 공유 정책, 익명 닉네임, 신고/모더레이션, 추천·추천순 정렬, 표시 컨셉(단어 vs 싸이월드式)
- [ ] **알림 푸시 인프라** — Expo Push / FCM (로컬 리마인더는 별개로 선구현 가능)
- [ ] **출석 체크** — 출석 시 루비 지급(예: 10루비). 게이미피케이션 노출 정책과 연동
- [x] **추천 단어 풀 — 형식·성격 확정 + 50선 반영(2026-06-14)** — ✅ 형식 **B(객체 `{ word }[]`)** 채택(나중 `{word, tags?}` 무마이그레이션 확장 여지). **카테고리/성격은 데이터에 안 넣음**(단어 다의적·분류 자의적·브랜드 충돌). 50선을 `RECOMMENDED_WORDS`에 반영(테마는 주석=큐레이션 참고용, 데이터 필드 아님). 미래 태그는 단일분류 X→복수 soft tags·시스템 단어에만. **남은 것**: 저장 위치 — 현재 로컬 파일(앱 배포 콘텐츠). 앱 업데이트 없이 단어 추가하려면 원격(백엔드/호스팅 JSON) 승격 필요(후속).
- [ ] **탭2 마을 — 렌더링: 2D~2.5D 프로토타입 먼저, 퀄리티 보고 3D 판단** ★ — *2026-06-15 갱신*
  - **결정 방식(2026-06-15 회의)**: 2D/3D를 지금 못 박지 않고 **2D~2.5D 수준 프로토타입을 먼저 만들어 다같이 퀄리티 보고 결정**. 렌더러 분리 구조라 3D 전환은 가역적(아래).
  - **회의 확정 기능 → 구현 함의(상세 기획 PLANNING §4)**:
    - **세로(portrait) 고정** — 가로 대응 불필요.
    - **2단계**: 마을(맵+이동) → 집 입장(상세). 이미 목업의 board+sheet 구조와 일치.
    - **집 목록 새로고침 + 필터(나이·성별·관심사)** → 백엔드 쿼리 필요(`GET /village/houses?filters` 류). 매 새로고침 다른 이웃 셋 = 서버 랜덤/페이지네이션. **공개 동의 + 프로필(나이·성별·관심사) 수집** 선행.
    - **건물 "설치 시간"** → 서버 권위 타이머(설치 완료 시각 저장) + **루비로 단축**(루비 경제 선행). 클라는 남은 시간 표시.
    - **캐릭터 이동 + 잔상·효과음** → 이동 연출(잔상=afterimage, 사운드). 톤 가드(차분) 안에서 절제.
  - **현황**: 2D 픽셀아트 목업 **구동 완료**(`/village-demo` dev 라우트, 백엔드 0, 새 의존성 0). 탑다운 RPG 룩(잔디 격자 타일+지붕색별 집+나무·꽃+캐릭터), 빈 땅 탭→캐릭터 걷기, 집 탭→그 집 정의 시트. 에셋은 직접 생성(CC0, `scripts/gen-village-art.mjs`+`assets/village/*.png`). 작업 로그 2026-06-13 참조.
  - **핵심 결론(엔지니어 의견)**: ① 동물의 숲의 *정서*(아늑·산책)는 **2.5D로 달성 가능** — 3D의 진짜 비용은 렌더링이 아니라 **3D 에셋 파이프라인**(모델·텍스처·리깅). ② 아바타 마을의 진짜 블로커는 렌더링이 아니라 **데이터**(광장 공유 동의·계정·루비 경제) — 렌더러 결정은 순서상 **맨 마지막**. ③ **렌더러 분리 구조**(`village-board`만 교체, 데이터·로직·시트는 유지)라 2D로 가도 **3D 전환이 가역적** — 지금 못 박을 필요 없음.
  - **선택지**:
    - **2D 픽셀아트(현재 안)** — 비용↓·톤 적합·즉시. 출시 땐 외주/라이선스 픽셀아트로 교체 전제.
    - **3D (react-three-fiber + expo-gl)** — TS/React 유지하며 진짜 3D 가능. 비용은 주로 **3D 에셋 + 저사양 폰 성능**. Unity 임베드는 규모상 과함(런타임 수십 MB·Expo Go 불가).
  - **결정 시 기준**: define의 차별점은 **글쓰기·회고**지 게임 그래픽이 아님 → 가장 비싼 카드(3D)를 비핵심 레이어에 쓸지. 어느 쪽이든 **백엔드·계정·루비 경제가 선행**돼야 "진짜 기능"이 됨(비동기 월드 = 집은 유저 스냅샷, 실시간 동기화 배제).
  - **2D를 더 밀 경우 기술 단계**: 현재 RN `<Image>`+Animated로 정지+슬라이딩 충분. 다음은 4방향 걷기 애니(스프라이트 시트)+타일 격자 이동(포켓몬式). 더 큰 맵/이펙트면 skia/expo-gl 추가(현재 미설치). 상세 기획 [PLANNING.md](./PLANNING.md).

---

## 작업 로그 (개발)

> 개발·기능명세·디자인 시스템 구현·기술 결정 변경만 누적. 역시간순(최신 위).
> 형식: `### YYYY-MM-DD — 한 줄 요약` + 핵심 변경 + 회고가 있으면 회고.

### 2026-06-15 — 회의 결정 기록: 마을 기능 상세 + 메인 아바타 질문 (코드 0)
- **마을 렌더링**: 2D~2.5D 프로토타입 먼저 → 퀄리티 보고 3D 판단(§6 갱신). 지금 코드 변경 없음, 기록만.
- **마을 기능 확정**(구현 함의 §6): 세로 고정 · **내 집(짓기·꾸미기 고정 공간) + 남의 집 랜덤 방문** · 집 고르기→집 입장 2단계 · 집 새로고침+필터(나이·성별·관심사, **백엔드 쿼리+프로필 수집 선행**) · 건물 "설치 시간"(**대상=건물 짓기**, 서버 타이머+루비 단축, **루비 경제 선행**) · 캐릭터 이동 잔상·효과음.
- **메인탭**: 아바타가 단어 질문("사랑이란 무엇인가요?") — 기존 단어 카드 → 아바타 질문 UI(후속 구현).
- **아침 push 알림**: 확정하되 기록 연결 구조 미정(알림 인프라 §6 + PLANNING §8).
- **인증/DB 변경(클라리파이)**: **가입 시 나이·성별·관심사 필수** 확정 → 종전 "이메일·비밀번호만"에서 변경. **`User`/`Profile` 테이블 컬럼 추가 + 가입 DTO·폼 확장** 필요(구현 시). 익명우선과 무충돌(가입은 선택).
- **선행 의존성 부각**: 마을 "진짜 기능"은 ① 공개/비공개 동의 모델 ② 프로필(가입 시 나이·성별·관심사) 수집 ③ 루비 서버 경제에 묶임. 프로토타입(목업 데이터)은 이와 무관하게 선행 가능.

### 2026-06-14 — 추천 단어 풀: 50선 반영 + 형식 B 확정 (성격 부여 안 함)
- **무엇**: `recommended-words.ts`를 6개 → **50선**으로 확장. 저장 형식 **B(객체 `{ word }[]`)** 확정. 소비처 `index.tsx`는 `RECOMMENDED_WORDS.map(w=>w.word)`로 받아 `pool`(string[]) 유지 — 최소 변경.
- **성격(카테고리) 결정 = 안 넣음(확정)**: 단어는 다의적("봄"=계절이자 시작·낭만), 분류가 자의적이라 고정 카테고리는 브랜드("각자의 정의")와 충돌·손실적. 테마(감정/관계/나/삶/가치/현실)는 **주석=큐레이션 참고용**일 뿐 데이터 필드 아님. 형식만 객체(B)로 둬 미래 soft tags 여지만 확보(단일분류 X·시스템 단어에만·사용자 정의엔 X).
- **검증**: tsc 0, `expo export` 0에러, 단어 50개 확인.
- **후속**: 풀 저장 위치 원격(백엔드/호스팅 JSON) 승격 — 앱 업데이트 없이 단어 추가하려면 필요.

### 2026-06-14 — 다운로드 동기화 (서버→로컬) + 로그인 양방향 reconcile ★
- **무엇**: 업로드 전용이던 동기화에 **서버→로컬 다운로드**를 추가. 이제 로그인/가입 시 업로드(로컬→서버) 후 다운로드(서버→로컬)까지 = **reconcile** → 재설치/새 기기에서 단어장 복원됨. 브랜치 `feat/journal-download-sync`.
- **왜**: 기존엔 올리기만 되고 내려받기가 없어서, 앱 재설치/다른 기기 로그인 시 서버에 데이터가 있어도 로컬이 비어 단어장이 빈 채로 보였음(데이터 유실처럼 느껴짐).
- **백엔드**: `GET /api/journal`(JwtAuthGuard 상속) — 내 entries 최신순. `EntryRepository.findByUserId`(인터페이스+Prisma `findMany`) + `EntryRecord` 출력 타입 + `JournalService.list`. 신규 테이블 없음(Entry 재사용).
- **프론트**: `journal-api.getJournal` · `lib/sync-journal.downloadJournal`(ServerEntry→SavedEntry 매핑) · `store/journal-store.mergeEntries`(**id=clientId 기준 union, 로컬 우선·덮어쓰기 X, savedAt 역순 정렬, 멱등** — 새 추가 없으면 같은 배열 반환해 리렌더 회피). `auth-store.runSync`가 `syncJournal`(업로드) 후 `downloadJournal`(다운로드) 호출, **비치명적** 유지.
- **동기화 모델 정리**(설계 합의): UI는 항상 로컬(local-first) → 로컬→서버 업로드는 **수시**(저장 시, 후속), 서버→로컬 다운로드는 **로그인 때만**(이 기기가 뒤처졌을 때 = 새 기기/재설치). "앱 종료 시 push"는 모바일에서 비신뢰라 채택 X.
- **검증**: 백엔드 curl 계약(signup→import 3→**GET 3개 최신순·changeNote 보존**→무토큰 401→재import 멱등 count 3) · `mergeEntries` 단위(union/로컬우선/정렬/멱등·동일참조) · **실서버 e2e**(login→GET /journal→매핑→빈 로컬 머지→복원 3, changeNote/순서/멱등) · 백엔드·프론트 tsc 0. 브라우저 CORS 미설정이라 웹 인터랙티브 로그인은 수동 잔여(실기기 무관).
- **비범위(후속)**: 저장-시 업로드(매 변경 push)·삭제 동기화(delete/tombstone)·멀티기기 포그라운드 당김·CORS(웹 검증용).

### 2026-06-13 — 네이밍 통일: 마을 코드명을 `village`로 일원화 (`town` 제거)
- **무엇**: 좌2 탭 라우트가 `town`, 나머지 마을 자산(컴포넌트·데이터·에셋·아이콘·생성기)은 `village`로 갈려 있던 불일치를 `village`로 통일. `town`은 코드에서 완전 제거.
- **왜 갈렸었나**: dev 목업을 먼저 `app/village.tsx`(URL `/village`)로 만든 탓에, 탭 파일을 `village.tsx`로 두면 같은 `/village` 경로가 둘 → **라우트 충돌**. 임시로 탭만 `town`으로 회피했던 것(의미 차이 아님).
- **변경**: dev 목업 `app/village.tsx` → `app/village-demo.tsx`(URL `/village-demo`, 함수 `VillageDemoScreen`)로 옮겨 `/village`를 비움 → 탭 `(tabs)/town.tsx` → `(tabs)/village.tsx`(URL `/village`, 함수 `TownScreen`→`VillageScreen`). `_layout` TAB_ORDER `name: 'town'`→`'village'` + 주석. 라벨 "마을"·아이콘 `village`는 불변. 문서(§0/§2/§4/§6 + 작업 로그) 경로 참조 일괄 갱신.
- **결과**: 마을 = 어디서나 `village`. 탭 = `/village`(placeholder), 목업 = `/village-demo`(실동작). 2D/3D 확정 후 목업을 탭에 합치면 `/village-demo`는 사라지고 `village` 하나로 수렴.
- **검증**: `grep town`(src) 0건, `/village` 라우트 파일 1개(충돌 없음), `tsc --noEmit` 0, `expo export` 0에러, 탭바·`/village-demo` 웹 캡처.

### 2026-06-13 — 좌2 탭 명명: 회고 → 마을 (아바타 마을 = 광장 컨셉2)
- **무엇**: 메인 탭바 좌2가 아직 "회고"(낡은 placeholder)였음 → 기획상 들어갈 **아바타 마을**로 명명·교체. 팀 작명 결정 = **"마을"**(광장(공적)↔마을(생활권) 대비, 글랜서블, 톤 적합. 후보 마실/동네/골목 중).
- **변경**: `(tabs)/mood.tsx`→탭 라우트 마을(route `/mood`→`/village`), 라벨 회고→마을, 아이콘 신규 `village`(라인 스타일 집) 추가. AuthGate/placeholder 문구를 마을 컨셉으로. `_layout.tsx` TAB_ORDER·주석 갱신. `mood` 아이콘은 셋에 보존(미사용, 데드코드 삭제 안 함). (※ 라우트명은 처음 `town`이었다가 후속 통일로 `village`가 됨 — 같은 날 마지막 로그 참조.)
- **주의**: 실제 마을 화면은 2D 목업(`/village-demo` dev 라우트)에 별도 존재 — 탭은 아직 가입게이트 placeholder. 2D/3D 확정(§6) 후 탭에 본격 연결.
- **검증**: tsc 0. 웹 실측 — 탭바 라벨 `광장·마을·기록·과거의 나·단어장`, 집 아이콘 렌더, pageerror 0 캡처 확인.

### 2026-06-13 — 아바타 마을: 픽셀아트 타일셋으로 업그레이드 (쯔꾸르/탑다운 RPG 룩) ★
- **무엇**: 같은 날 만든 2D 목업이 "색 사각형"이라 설득력이 0이라는 피드백 → 픽셀아트 스프라이트로 룩 교체(설득용 B안). 렌더러만 갈아끼움(`village-board.tsx`), 걷기 로직·시트·월드 데이터는 그대로(렌더러 분리 구조가 값을 함).
- **에셋 = 직접 생성(CC0, 외부 0)**: `scripts/gen-village-art.mjs` — `pngjs`로 픽셀아트를 베이스 해상도에 그린 뒤 정수배 업스케일(nearest)해 크리스프 PNG 출력 + 1px 다크 아웃라인으로 가독성. 산출물 `assets/village/*.png`(grass·tree·flower·char·house-warm/forest/gold/violet). **외부 팩 다운로드/라이선스/Nintendo 에셋 표절 리스크 전부 회피.** 실제 출시 땐 외주/라이선스 아트로 교체 전제.
- **렌더러**: 잔디=grass.png 격자 타일(⚠️ `resizeMode="repeat"`는 RNW에서 안 먹어 직접 격자 + 베이스 그린 폴백). 집=지붕색별 스프라이트(이웃 `house` 키 매핑), 나무·꽃=장식(pointerEvents none로 탭 통과), 캐릭터=`<Image>`(기존 Animated translate 그대로). 픽셀 안 뭉개지게 모든 스프라이트 네이티브 크기 1:1 표시.
- **검증**: `tsc` 0 + `expo export` 0에러. **실측 스크린샷**(playwright 요소클릭): 탑다운 RPG 마을 렌더 확인 → 빈 땅 탭 시 캐릭터 이동 → 집 탭 시 그 집 앞까지 걸어가 정의 시트 오픈까지 캡처로 눈으로 확인. pageerror 0.
- **비범위(후속)**: 4방향 걷기 애니(스프라이트 시트)·타일 격자 이동(포켓몬式 C안)·루비 꾸미기·진짜 데이터 연동.

### 2026-06-13 — 아바타 마을: 2D 목업 프로토타입 (백엔드 0, 감/톤 검증용) ★
- **무엇**: 좌2 탭 "아바타 마을"의 느낌(느린 산책 → 집 입장 → 그 사람 정의 열람)을 백엔드 없이 체험하는 목업. 브랜치 `feat/village-mock-prototype`. **새 의존성 0**(기존 RN `Animated`만 사용 — skia/expo-gl/three 안 깖).
- **왜 2D 먼저 + 왜 목업**: 팀에서 "동물의 숲처럼 3D" 의견 → 검토 결과 (1) 동물의 숲의 *정서*(아늑·산책)는 2.5D로 달성 가능, 3D의 진짜 비용은 렌더링이 아니라 **3D 에셋 파이프라인** (2) 아바타 마을의 진짜 블로커는 렌더링이 아니라 **데이터**(광장 공유·계정·루비 경제) — 렌더러 결정은 순서상 맨 마지막. → 3D 확정 전에 **2D 목업으로 감/순서부터** 검증.
- **렌더러 교체 가능 구조(2D→3D 대비 핵심)**: 3층 분리 — ⓐ 월드 데이터(`data/village-mock.ts`, **0~1 비율 좌표**라 해상도·렌더러 독립) ⓑ 렌더러(`components/village/village-board.tsx`, 그리기+탭 보고만 하는 presentational, **여기만 3D로 교체**) ⓒ 화면 로직(`app/village-demo.tsx`, 월드 상태+걷기). 비싼 부분(데이터·로직·시트)은 살고 얇은 렌더러만 버려짐.
- **동작**: 빈 땅 탭 → 그 지점으로 걸어감(거리 비례 320~1400ms, px당 6ms = 일정 속도, 느린 산책 톤). 집 탭 → 현관까지 걸어간 뒤 **도착 콜백으로** 정의 시트 오픈(`neighbor-sheet.tsx`, 광장 [word] 카드 스타일·시트 규칙 재사용). 이웃 4명 더미 정의(같은 단어 다른 정의로 "남들은 어떻게" 연출).
- **접근**: 탭바에 없는 dev 라우트 `/village-demo`. 웹 `http://localhost:8081/village-demo` 또는 `router.push('/village-demo')`. 기존 5탭·게이트 **무수정**(외과수술식, 통째로 삭제 쉬움).
- **버그 수정(빈 땅 탭이 안 걷던 문제)**: 첫 구현은 바닥 탭 좌표를 `nativeEvent.locationX/locationY`로 읽었는데 **react-native-web에서 이 값이 undefined** → `walkTo(undefined)` → 아바타가 안 움직임(집 탭은 좌표 불필요라 멀쩡, 그래서 "안 움직인다"로 보임). 양 플랫폼 공통으로 신뢰 가능한 `pageX/pageY` + 보드 `measureInWindow`로 로컬 좌표를 계산하도록 수정.
- **검증**: `tsc --noEmit` 0 + `expo export --platform web` 0에러(`/village-demo` 라우트 생성). **인터랙티브 실측**(playwright-core + 시스템 Chrome): 빈 땅 탭 → 아바타가 그 지점으로 **애니메이션하며 이동**(중간 프레임 보간 확인: 174→253→288), 집 탭 → 걸어간 뒤 정의 시트 오픈까지 캡처 검증.
- **검증 도구 주의(중요)**: RNW의 press 응답은 `page.mouse.click(x,y)`·`touchscreen.tap`(좌표 합성 이벤트)으로는 **onPress가 안 뜬다**(헤드리스·헤디드 무관). `elementHandle.click()`(액셔너빌리티 기반)으로 클릭해야 발화. 이후 웹 인터랙션 자동검증은 요소 기반 클릭으로 할 것.
- **비범위(후속)**: 진짜 데이터(광장 공유 연동)·루비 꾸미기·방명록·아바타 방향전환/스프라이트·3D 스파이크(react-three-fiber). dev 진입 버튼(마이페이지 등)은 미추가.

### 2026-06-08 — 광장 1차: 읽기 전용 MVP (백엔드+프론트) ★
- **무엇**: "남들은 이 단어를 어떻게 정의했나"를 보여주는 광장을 읽기 전용으로 구현. 브랜치 `feat/plaza-mvp`, 6 태스크 서브에이전트 구동(설계·계획은 세션 내 대화, 별도 문서 없음). 추천·신고·컨셉2(아바타 마을)는 후속 슬라이스.
- **콜드스타트 해결(시드)**: `prisma/seed-plaza.ts`(npm `db:seed:plaza`) — 닉네임 붙은 시드 유저 9명 + 추천 단어 12개에 큐레이션 정의 36개 분배(멱등). dev.db는 로컬 throwaway라 배포 무관, prod 시드는 후속.
- **백엔드 `modules/plaza`**(신규 테이블 없음, Entry 재사용): `GET /api/plaza/words`(정의 있는 단어+count, 많은 순), `GET /api/plaza/words/:word`(정의들 + 내 정의 isMine 맨 위, 닉네임 없으면 '익명'). 모두 JwtAuthGuard. repository가 Entry를 `word`로 groupBy + User 닉네임 조인.
- **프론트**: `services/plaza-api.ts` + plaza 탭을 journal처럼 **stack 전환**(`plaza/_layout`+`index`+`[word]`). index는 AuthGate 뒤에서 단어 리스트, `[word]`는 정의 카드(내 정의 포인트 보더+"내 정의" 배지). 로딩/빈/에러 상태 우리 톤.
- **노출·상호주의 모델**: 시드 정의 + 내 정의(나에게만 강조). 진짜 타인 자동 공개는 배포·다유저 시 명시적 동의로 보류. 상호주의 게이팅 = 로그인(AuthGate + JwtAuthGuard 이중). canonical 클러스터링은 `word` 문자열 그대로(유사어 병합 후속).
- **검증**: 클린 dev.db(`prisma migrate reset`+시드)에서 curl — 12단어 count 3, 행복 count 4(시드 3+내 1), 내 정의 isMine:true 맨 위, 무토큰 401. 프론트 tsc 0 + `expo export` 0에러(/plaza·/plaza/[word]). 인터랙티브 클릭스루는 수동 잔여.
- **회고**: 세션 누적 curl 테스트 데이터가 dev.db에 쌓여 광장 count가 부풀어 보이는 일이 반복 → throwaway DB라 코드 문제 아니나, 데모 전 `migrate reset`+시드로 정리. 코드리뷰가 빈 정의 배열 상태 안내 누락을 잡아 보강(형제 리스트 화면과 일관).

### 2026-06-07 — 가입 유도 게이트 프론트 2차 (RN/Expo) ★
- **무엇**: §5 탭 게이팅 정책 구현. 브랜치 `feat/auth-gate`, 2 태스크 서브에이전트 구동(설계·계획은 세션 내 대화, 별도 문서 없음).
- **신규**: `components/domain/auth-gate.tsx` — `AuthGate`(props: icon·title·description·children). `useAuthStore` token 구독 → 있으면 children, 없으면 잠금 화면(탭 아이콘 + 유도 문구 + `lock` + "가입하고 시작하기" CTA→`/auth`). 수정: `(tabs)/{plaza,mood,past}.tsx`가 기존 `ScreenPlaceholder`를 `AuthGate`로 감쌈(탭별 문구).
- **정책**: 광장·회고·과거의나만 게이트(가입 필요), 기록·단어장은 무가입. 탭바에서 **숨기지 않음**(진입 시 유도). CTA→`/auth`→성공 시 `router.back()`으로 해당 탭 복귀 → 게이트가 token 보고 children으로 자동 전환. 로그아웃 시 token=null → 게이트 자동 복귀(zustand 리렌더).
- **시각**: 가짜 콘텐츠·블러 라이브러리 없는 **깔끔한 잠금 화면**(진짜 콘텐츠 없는 단계라 정직하게). 광장에 실제 정의 쌓이면 블러 티저로 승격은 후속.
- **검증**: tsc 클린 + `expo export --platform web` 0에러(plaza/mood/past 라우트 포함). 인터랙티브 클릭스루는 수동 잔여.
- **비범위(후속)**: 블러 티저 · 다운로드 동기화 · 각 탭 실제 기능 · 닉네임 정합.

### 2026-06-07 — 프론트 인증 연결 + 업로드 동기화 1차 (RN/Expo) ★
- **무엇**: 백엔드 마일스톤2 위에 프론트 인증을 연결. 브랜치 `feat/frontend-auth-sync`, 6 태스크 서브에이전트 구동(스펙+품질 리뷰, 설계·계획은 세션 내 대화). 게이트 3탭은 2차로 분리.
- **신규**: `services/{api-client,auth-api,journal-api}.ts`(fetch 래퍼 + 도메인 함수) · `lib/sync-journal.ts`(journal-store entries → import payload 변환·업로드) · `store/auth-store.ts`(token·user·lastSyncedAt, async-storage persist) · `app/auth.tsx`(`/auth` 풀스크린, 로그인↔가입 토글, 인라인 에러). 수정: `app/mypage.tsx` 계정 섹션(로그인/로그아웃 ConfirmDialog).
- **동기화 정책**: 가입·로그인 **둘 다** 트리거, 업로드 전용(로컬→서버), 멱등(`SavedEntry.id`→`clientId`). **비치명적** — 인증 성공 후 sync가 throw해도 로그인 롤백 X(다음 로그인 멱등 재동기화로 복구). 로그아웃은 인증만 해제, **로컬 단어장 보존**.
- **관심사 분리**: auth-store는 journal-store를 직접 import하지 않고 `lib/sync-journal`이 매개. 토큰은 async-storage(웹 검증 유지; expo-secure-store는 웹 미지원이라 실기기 빌드 시 승격).
- **검증**: tsc 클린(typedRoutes는 `expo start`가 `/auth` 타입 재생성) · `expo export --platform web` 번들 0에러 · 백엔드 curl 계약(signup 201 / import {imported,updated} / 재import 멱등) 재현. 인터랙티브 UI 클릭스루는 수동 잔여.
- **비범위(후속)**: 게이트 3탭 · 다운로드 동기화(`GET /journal`) · 닉네임 서버↔로컬 정합 · 에러 카피 다듬기 · refresh/소셜.
- **회고**: 계획이 참조한 `theme.spacing.s7`이 실제 토큰에 없어(s6→s8 점프) 구현 중 `s8`로 정정 — 스케일 확인 누락. `_layout.tsx`는 expo-router 자동 라우팅이라 스펙의 "수정" 항목이 불필요(코드 최소화).

### 2026-06-07 — 백엔드 auth/동기화 마일스톤2 (NestJS) ★
- **무엇**: 익명우선 모델의 회원가입·로그인·로컬 단어장 서버 동기화 백엔드를 구현. 브랜치 `feat/backend-auth-sync`, 8 태스크를 서브에이전트 구동(태스크별 스펙+품질 2단계 리뷰)으로 진행.
- **DB**: `User`{email unique, passwordHash, nickname?} + `Entry`{clientId, userId, word, text, changeNote?, savedAt} 추가(마이그레이션 `add_user_entry`). 기존 `Word`(추천 풀) 무변경. `Entry`는 `@@unique([userId, clientId])` — 로컬 `SavedEntry.id`를 `clientId`로 보존해 재import 멱등성 보장.
- **modules/auth**: `signup`/`login`(bcryptjs 해싱, 계정 열거 방지로 로그인 실패 메시지 통일) + **access-only JWT 90일**(refresh 없음). passport-jwt 전략 + `JwtAuthGuard`. repository 인터페이스↔Prisma 구현 DI 바인딩(word 모듈 패턴 동일).
- **modules/journal**: `POST /api/journal/import`(JwtAuthGuard 보호). entries를 `(userId,clientId)` upsert(findUnique→create/update 분기)해 `{imported, updated}` 반환. 같은 payload 재전송 시 imported=0 → **중복 안 쌓임**. 중첩 배열 검증(`@ValidateNested`+`@Type`).
- **검증**: 실제 구동+curl 6스텝 전부 통과(테스트 프레임워크 미도입 — 마일스톤1 컨벤션 따름). 멱등성은 DB COUNT=3(재import 후에도 6 아님)로 증명. 무토큰 401, 잘못된 entry 400(검증 동작)까지 확인.
- **인증 방식 세부 확정**: 이메일+PW(소셜은 후속). 가입 수집 정보는 **이메일·비밀번호만**(닉네임·프로필은 미수집). 분석용 프로필(`gender`/`birthYear`)은 향후 nullable 컬럼/`Profile` 1:1로 — 가입 마찰 회피·성별 중립(PLANNING §9). *(→ 2026-06-15 변경: 마을 필터 위해 **가입 시 나이·성별·관심사 필수**로 전환. 같은 날 로그 참조.)*
- **비범위(보류)**: 프론트 연결(다음), 소셜 로그인, refresh 토큰, canonical 단어 연결(`Entry.wordId`), 로그아웃/탈퇴, 다중기기 양방향, 자동 e2e 테스트.
- **회고**: 계획을 그대로 옮기는 기계적 태스크(3·5·7)는 통합 리뷰 1회로, 실제 서버 검증이 도는 통합 태스크(6·8)는 스펙+품질 2단계로 분리해 리뷰 비용을 차등. `@nestjs/jwt@11` 타입 강화로 `expiresIn`에 템플릿 리터럴 캐스트 1건 불가피(동작 무변화). 계획이 만든 미사용 `EntryEntity`는 YAGNI로 제거.

### 2026-06-06 — 문서 인프라: docs/ 재배치 + 노션 자동 동기화 + 가독성 점검
- **docs/ 재배치**: `PLANNING.md`·`DEVELOPMENT.md`를 루트 → `docs/`로 이동(git mv, 히스토리 보존). 참조 링크 4개 파일 갱신(루트 CLAUDE.md, front/mobile/CLAUDE.md, back/README.md, 본 §2 트리). CLAUDE.md·README는 루트 유지(자동 로드/레포 readme).
- **노션 자동 동기화**: `.github/workflows/notion-sync.yml` 추가 — `docs/**` push 시 `@vrerv/md-to-notion`으로 노션 페이지에 동기화(secrets: `NOTION_TOKEN`, `NOTION_PAGE_ID`). **단방향(GitHub→노션) 미러** — 파일명 매칭·바뀐 블록만 갱신(중복 X), 로컬에서 파일 삭제해도 노션은 기본 보존(옵트인). 첫 동기화 성공 확인. actions checkout/setup-node `v5`·node `22`로 선제 버전업(Node 20 deprecation 대비).
- **노션 운영 메모**: synced 페이지는 **읽기 전용 취급**(기획자 의견은 노션 댓글/별도 페이지에). 노션 라벨 — PLANNING="개발 기획", DEVELOPMENT="개발 현황".
- **가독성 점검**(기획자 독자 대상): 두 문서에 '읽는 법' 안내 추가, 낡은/모순 내용 정정(백엔드 NestJS·마일스톤1 동작, DB 방향, §4 화면 상태, IA 좌2). 작업 로그(결정 히스토리)는 보존.

### 2026-06-06 — 단어 모델 구분(시스템/사용자) 명문화 + 유사 단어 제안 설계 (코드 0)
- **구분 확정**: 시스템 정의 단어(canonical 추천 풀) ↔ 사용자 정의 단어(entry)는 **별도 데이터·별도 테이블**. 다대다 관계라 합칠 수 없음. 상세 §5 신설.
- **유사 단어 제안**(신규 기능 계획): 커스텀 단어 추가 시 시스템 풀에 유사어 있으면 *"이걸로 모을까요?"* 제안 → 사용자가 같음/다름 선택. 같음=시스템 단어 연결, 다름=커스텀 추가(주관 존중). **목적**: 광장 클러스터링 파편화 방지, **강제 병합 X**. 상세 §5.
- **유사도 알고리즘 = 미확정**: L0 정규화/동의어 → L1 자모 편집거리 → L2 임베딩 코사인 3단계 후보를 §6에 등록. 초기 L0+L1, 추후 L2(GPT 임베딩 재활용). 임계값·계산 위치 추후.

### 2026-06-06 — 인증 모델 확정 + 동기화/게이팅 기술 검토 (코드 0, 설계)
- **확정**: 인증 모델 = **① 익명우선**(회의 결과). 기록·통계는 무가입, 광장·회고(아바타 마을)·과거의나는 가입 유도. 정책 표는 [PLANNING.md](./PLANNING.md) §5 / 동일 날짜 로그.
- **기술 타당성 결론: 전부 가능, 현재 구조와 정확히 일치** (추천 ①이 이미 반쯤 구현돼 있던 덕).
  - **로컬 저장**: 사용자가 말한 "로컬 스토리지" = RN의 **AsyncStorage**. 이미 `journal-store.ts`가 Zustand `persist`로 `define-journal-v1` 키에 영구 저장 중. **추가 작업 0**.
  - **탭 게이팅**: 새 `auth-store`(로그인 상태/토큰, persist)를 두고, 가입 필요 탭(`plaza`/`mood`/`past`) 진입 시 콘텐츠 대신 **가입 유도 게이트**(잠금/블러) 렌더. 탭바에서 숨기지 않음(전환 유도 + 상호주의 정책 일관). `journal`(통계)·`index`(기록)은 게이트 없이 로컬 store 그대로.
  - **동기화**: 모델이 flat `SavedEntry[]`라 회원가입 직후 **1회 업로드**(`POST /api/journal/import`)면 끝. 충돌 로직 불필요(신규 가입=로컬→서버 단방향). 다중 기기 양방향은 추후.
- **신규 필요 작업(착수 시)**:
  1. (백엔드) `modules/auth` — 회원가입/로그인(JWT 등) + `User` 모델. `modules/journal` — `POST /api/journal/import`(인증 가드).
  2. (프론트) `store/auth-store.ts`(persist) + 가입 유도 게이트 컴포넌트 + 가입·로그인 화면(우리 톤 시트/화면, 시스템 다이얼로그 X).
  3. (프론트) 로그인 성공 시 로컬 entries 업로드 → 성공 후 동기화 플래그.
- **미정(구현 시 결정)**: 인증 방식(소셜 vs 일반), 토큰 저장 위치(expo-secure-store 권장), DB의 User↔Word 관계(현 `Word`는 글로벌 추천 풀이라 사용자 entry용 테이블 별도 필요).

### 2026-06-03 — 인증 모델 검토 (3모델 비교 → 팀 논의 보류, 코드 0)
- **질문**: 익명 로컬을 허용할까, 처음부터 가입 강제할까?
- **3모델**:
  - **① 순수 로컬 익명(현행)** — 마찰0, 가입 전엔 폰에만 저장, 가입 시 `POST /journal/import`로 1회 업로드. 가장 단순, 이미 반쯤 구현.
  - **② 서버 익명 계정** — 첫 실행에 서버가 익명 신원 조용히 생성(가입 UI 없음), day1 동기화, 나중에 이메일/소셜 **연결**(마이그레이션이 '연결'로). 무마찰+안전이나 구현 복잡·항상온라인 성격.
  - **③ 가입 필수** — 데이터 day1 안전·백엔드 단순하나, 첫 활성화 이탈·브랜드(부담없이) 충돌. 페르소나 P1(일기 앱 깔았다 지웠다)과 정면 충돌.
- **추천 ①** (페르소나·브랜드·전환 심리·기존 구조 모두 부합). 가입은 광장·동기화 등 **동기 생기는 순간** 유도. 마이그레이션은 flat `SavedEntry[]`라 1회 업로드로 간단. ②는 "데이터 안전 중요" 시 미래 업그레이드로 보류.
- **보류**: 최종 모델은 팀 논의. auth·journal 동기화·광장 마일스톤이 이 결정에 **종속**.

### 2026-06-03 — 백엔드 마일스톤1: NestJS 스캐폴드 + GET /api/words 동작 ★
- **언어 결정 보강**: 사용자가 TS 초보임을 밝힘 → FastAPI/가벼운TS/NestJS 재검토 후 **NestJS 유지(TS 제대로 학습)** 선택. 코드에 학습용 주석 충실히.
- **스캐폴드**: `back/`에 NestJS + Prisma 프로젝트 생성. 레이어 풀 슬라이스 1바퀴 — `GET /api/words`가 controller→service→**repository(인터페이스)**→`PrismaWordRepository`(SQLite)→DB로 흘러 시드 6단어 반환 확인(200 OK).
- **DB**: Prisma + SQLite(`prisma/dev.db`). `Word{ id(cuid), text unique, createdAt }` (카테고리 없음). 마이그레이션 `init` 생성·적용, seed로 데모 6개(행복·사랑·돈·시간·용기·어른).
- **스왑 준비 실증**: `word.module.ts`의 `{ provide: WordRepository, useClass: PrismaWordRepository }` 한 줄로 구현 교체 가능. service는 인터페이스만 의존.
- **`back/.gitignore` 재작성**: Python용 → **Node/NestJS용**(node_modules·dist·*.db·.env). 마이그레이션 SQL은 추적, dev.db·.env·node_modules·dist는 제외 확인.
- **착오 2건(수정 완료)**: ① 빌드 산출물이 `dist/src/main.js`로 들어가 `start:prod` 실패 → `tsconfig.build.json`에서 `prisma` 제외해 `dist/main.js`로 평탄화. ② 전역 ValidationPipe가 요구하는 `class-validator`/`class-transformer` 누락 → 설치(곧 DTO 검증에 필요).
- **다음**: auth(회원가입/로그인) → journal 동기화(로컬 entries 서버 이전) → plaza. 50선 일괄 시드는 저장 형식 결정 후.

### 2026-06-03 — 백엔드 스택 재결정: FastAPI → NestJS (설계 단계, 코드 0)
- **재판단 결론**: 진짜 갈림길은 FastAPI(Python) vs NestJS(TS). 프론트가 RN/TS라 **언어 통일·DTO 타입 공유·MVC 내장**이 결정타. AI(과거의나·이미지)는 외부 API 호출이라 Python을 강제하지 않음 → **NestJS 채택**.
- **게임(탭2) 책임 분리 확정**: 엔진·렌더링=프론트, 상태·데이터·경제(아바타/집 설정·루비·집 목록·단어)=백엔드 **평범한 REST**. 실시간 배제(비동기 월드) 결정 덕에 게임 서버 불필요 → 스택 선택에 영향 없음.
- **DB 전략**: Repository 인터페이스로 service를 DB와 격리. **SQLite 파일DB로 시작**, 구현은 Prisma 제안. 스왑은 config 바인딩 교체. 종착 DB(Postgres 유력/Mongo 가능)는 인터페이스가 막아주므로 **보류**.
- **구조(확정 방향)**: `back/src/{config,common(utils·filters·guards),database,modules/<도메인>/{controller,service,repository(+impl),dto,entities,module}}`. 함수는 동사+대상(`findWordById`·`grantRuby`).
- **첫 마일스톤(제안)**: `GET /words` — 인증 없이 전 레이어 얇게 관통(controller→service→repository→SQLite)로 뼈대 검증 → 이후 auth → journal 동기화 → 광장.
- **미정**: DB 구현 방식(Prisma vs raw sqlite), 종착 DB, 인프라(문서상 AWS 유지). 다음 턴에서 스캐폴드 착수 여부 결정.

### 2026-06-03 — streak·통계 보강 (연속 기록일)
- **store**: `computeStreak(entries, now)` 순수 함수 + `useJournalStreak()` selector 추가. `JournalStreak = { currentStreak, longestStreak, daysThisWeek, totalDays }`.
  - 날짜는 `Date.UTC(로컬 y/m/d)` 기반 일련번호(`dayIndex`)로 **timezone 안전**하게 일 단위 계산. 하루 여러 번 적어도 1일.
  - **현재 연속**: 오늘 있으면 오늘부터, 없고 어제 있으면 어제부터(오늘은 아직 '저장 가능') 역방향 카운트. 둘 다 비면 0.
- **단어장**: 통계 2칸 → **3칸**(총 기록 / 연속 기록 `N일` / 생각 변화).
- **마이페이지**: 프로필 통계 줄에 `· N일 연속 기록` 추가 — **2일 이상일 때만**(1일은 의미 약, 0일은 압박이라 생략).
- **톤 가드**: 불꽃 이모지·경쟁 없이 차분한 숫자 카드만. 페르소나 P2 "성장 확인" JTBD에 정렬.
- 검증: 만진 3파일 `tsc --noEmit` 0. 웹 캡처로 3일 연속(오늘·어제·그제, 5일전 갭 제외) 정확 표시 확인.

### 2026-06-03 — 추천 단어 풀: 50선 큐레이션 (저장 형식은 팀 논의 보류, 코드 미변경)
- 추천 단어 풀을 6개 → **50선 후보**로 확장 큐레이션. 성향 타겟(§9 PLANNING)과 부합 — 추상적·주관적 정의 가능·시간에 따라 관점이 변하는 단어 위주. **테마 묶음은 발표용 분류일 뿐, 데이터에 카테고리는 넣지 않기로 함.**
  - **감정·마음(10)**: 사랑·행복·외로움·불안·그리움·설렘·위로·후회·두려움·질투
  - **관계(8)**: 가족·친구·우정·부모·이별·인연·신뢰·어른
  - **나 자신(8)**: 나·자존감·욕심·결핍·취향·혼자·습관·자유
  - **삶·시간(10)**: 시간·청춘·죽음·나이듦·성장·일상·추억·변화·시작·끝
  - **가치·꿈(8)**: 용기·꿈·성공·노력·선택·책임·진심·희망
  - **현실·물질(6)**: 돈·일·집·여행·휴식·행운
- **보류(팀 논의 예정)**: 저장 형식 A(플랫 `string[]`, 현 코드 0수정·추천) vs B(객체 `{word}[]`, 미래 필드 여지). 소비처는 index.tsx 1곳뿐이라 나중에 전환해도 5분.
- **현재 코드 미변경**: `recommended-words.ts` 6개 그대로. 형식 결정 후 50선 반영 예정.

### 2026-06-03 — 탭2 아바타 마을: 기술 타당성 검토 (보류, 코드 변경 없음)
- 기획 아이디어(아바타가 맵을 돌며 집=유저 방문)의 **현상태 구현 가능성 엄밀 점검**. 결론: 게임 기술은 가능하나 **소셜 코어가 백엔드·계정·공유·루비 경제에 전면 종속 → 지금은 싱글플레이 목업만 가능.**
- **설치 스택 점검**: `reanimated 4`+`worklets 0.8.3`+`gesture-handler` 있음(게임루프·조이스틱 가능), `svg` 있음. **없음: react-native-skia, expo-gl**(진짜 2D 게임 캔버스).
- **게임 레이어 경로 3안**: ⓐ Skia 추가(네이티브, 60fps, 직접 엔진 구현 비용 큼) ⓑ WebView+Phaser(타일맵/충돌 즉시, 웹끼움·브릿지 마찰) ⓒ RN View/SVG만(작은 맵·탭이동 한정). 톤상 **느린 산책형**이라 ⓐ/ⓒ 적합.
- **핵심 아키텍처 권고**: **실시간 멀티 배제 → 비동기 월드.** 집=실제 유저 스냅샷(REST, 광장과 동일 데이터), 내 아바타만 이동. presence 동기화(Colyseus/websocket) 회피 → 복잡도 급감.
- **기능 범위(확정 경계)**:
  - ✅ 포함: 내 아바타만 이동 / 정적 집(NPC) / 집 입장→단어장 열람 / 루비 꾸미기.
  - 🔓 미래 가능(비동기, 백엔드 후): **방명록·쪽지** — 단순 REST CRUD(작성/조회), 실시간 불필요. websocket 없이 구현 가능.
  - ❌ 배제: 실시간 채팅 / 라이브 타인 아바타 / presence(websocket).
  - ⚠️ 데이터 출처: mock이면 오프라인 프로토타입 가능, 실제 타인 정의는 백엔드·계정·광장 공유 필요.
- **블로커(=보류 이유)**: 백엔드 0, 광장 상호주의 미구현, 회원가입 미착수, 루비 서버 경제·결제 미정. = 광장과 같은 벽 + 게임 레이어.
- **재개 시 첫 수**: 백엔드 없는 mock 싱글플레이 프로토타입(작은 맵+아바타 이동+집 입장→mock 단어장)으로 감/톤 검증 먼저.

### 2026-06-03 — changeNote 후속: 과거 entry 소급 수정 + WordRow 미리보기
- **소급 수정 (단어 상세)**: 타임라인 카드 롱프레스 액션시트에 **"변화 노트 추가/수정"** 항목 추가(라벨은 기존 노트 유무로 분기). 선택 시 노드가 변화 노트 인라인 입력 모드로 전환(텍스트 편집과 상호배타). 빈 값으로 저장하면 노트 **삭제**.
  - **첫 정의(가장 오래된 entry)는 항목 제외** — "이전과 달라진 점"이라 비교 대상이 없음(메인 화면 `isRedefinition` 게이팅과 동일 규칙).
- **store**: `updateChangeNote(id, note)` 신규. `changeNote` 필드만 갱신, **`savedAt`/`text`/`word` 불변**. 빈 값은 undefined 정규화.
  - ⚠️ **핵심 제약**: 정렬은 항상 **생성일(savedAt)** 기준. 옛 entry 노트를 고쳐도 맨 위로 튀지 않음(수정일 정렬 금지). 단어 단위 파생 `changeNote`는 최신 entry(entries[0]) 노트라, 옛 노트 수정은 리스트 미리보기/순서에 영향 없음 — 의도대로.
- **WordRow 미리보기**: 단어장 리스트에서 최신 정의 아래에 최신 변화 노트를 arrowUp + point 톤 한 줄(말줄임)로 노출(있을 때만).
- **TimelineNode**: 읽기/텍스트편집/**노트편집** 3-state. 정의 카드를 공유 변수로 추출(중복 제거).
- 검증: 만진 4파일 `tsc --noEmit` 에러 0. (index.tsx의 `/mypage` 타입 경고는 기존 Expo typed-routes 미생성 이슈로 무관.)
- **웹 실구동 검증**(Expo Web + 시스템 Chrome headless, pageerror 0): ① 리스트 미리보기 ② 상세 타임라인 노트 ③ 롱프레스→"변화 노트 추가" 액션시트 ④ 인라인 노트 에디터 ⑤ 옛 entry(3달 전)에 노트 소급 저장 후에도 **정렬 위치 불변**(2일전→3달전→5달전 유지) — 모두 캡처 확인.

### 2026-06-03 — 루트 .gitignore 안전화 (Python 템플릿 → monorepo 분리)
- **근본 원인 제거**: 루트 `.gitignore`가 Python 전용 템플릿이라 `lib/`·`build/`·`*.log`·`target/` 등 **범위 없는** 규칙이 repo 전체에 적용 → front/ RN 소스를 삼킬 위험(실제로 `format-date.ts` 유실 사고). 임시방편으로 `!front/mobile/src/lib/` 예외만 박아뒀던 상태였음.
- **해결**: monorepo 베스트 프랙티스로 ignore를 서브트리별로 소유.
  - **루트 `.gitignore`** → 전역 규칙만(.DS_Store, .idea, .env, *.pem). 어느 서브트리에도 안전.
  - **`back/.gitignore`** 신규 → FastAPI/Python 산출물(__pycache__·venv·build·pytest 등). back/ 안에서만 적용.
  - `front/mobile/.gitignore`(Expo 생성)는 그대로 — node_modules·.expo·dist 처리 중.
- 이제 한쪽 규칙이 다른 쪽 소스를 삼키는 게 구조적으로 불가능. `git check-ignore`로 front 위험 패턴(build/lib/log/target) 전부 안전, back 산출물은 정상 무시 확인.
- 임시 `!front/mobile/src/lib/` 예외 제거(더 이상 불필요).

### 2026-06-03 — "단어 전체 삭제" task 제거 (결정)
- 다음 후보에서 **단어 전체 삭제(P2)** 항목 삭제. 원래 Task #14에서 디버그용 "데이터 초기화" 버튼을 지우며 남긴 잔여 메모였음.
- **이유**: ① 앱 정체성(누적·회고)과 반대 방향 ② 로컬 영속이라 실수 시 복구 불가 ③ 개별 entry 삭제로 충분. 회원 탈퇴 시 데이터 파기는 **서버에서 DB 레코드 삭제**로 처리하면 되므로 클라이언트에 전체 삭제 버튼을 둘 이유 없음.

### 2026-06-03 — 기능 메모 반영: 백엔드 스택 결정 + 확장 기능 정리
- 사용자 최신 기능 메모를 문서에 흡수 (구현 아님 — 기획/결정 기록).
- **백엔드 스택 결정**: FastAPI(Python) · REST/JSON · MVC(controller/service/dto) · DB MongoDB(잠정) · AWS 배포. §1·§6 갱신.
- **과거의 나 GPT 전략 구체화**: 공통 페르소나 파인튜닝 + 유저별 few-shot. 사진 기반 talking-video는 별도 파이프라인.
- **신규 기능 후보**(상세는 PLANNING): 금주의 단어(공개 댓글), AI 정의 이미지/영상화(릴스式), 광장 컨셉2(싸이월드式 방·아바타), 신고/추천/정렬, 관리자 모드, 출석 체크.
- 미확정에 DB 확정·AI 생성 파이프라인·관리자 모드·출석 추가.

### 2026-06-02 — Task #16: changeNote (생각의 변화 노트) — entry 단위 ★
- **앱 정체성 직결 기능**: "같은 단어, 시간에 따라 변하는 생각"을 명시적으로 포착. 재정의하는 순간 "이전과 달라진 점"을 그 기록에 남김.
- **데이터 모델 (entry 단위)**: `SavedEntry.changeNote?` + `WordEntry.changeNote?`. `addEntry(word, text, savedAt?, changeNote?)` (빈 값은 undefined 정규화). `groupByWord`가 entry별로 전달 + 단어 단위 `JournalWord.changeNote`는 최신 entry 노트로 파생(리스트/배너 미리보기용).
- **신규 selector** `useEntryCountForWord(word)` — 메인 화면 "재정의 여부" 판별.
- **메인 기록 화면**: 현재 단어에 과거 기록이 있을 때(`isRedefinition`)만 정의 입력 아래 "생각의 변화 · 선택" 필드 노출. **첫 정의 흐름은 그대로 가볍게** 유지(비교 대상 없으므로). 단어 swap/저장 시 메모 초기화.
- **타임라인(TimelineNode)**: `entry.changeNote`가 있으면 정의 카드 **위**에 arrowUp(변화 일관 기호) + point 톤 주석으로 표시. 읽기 모드에서만.
- **설계 판단**: design-source는 changeNote를 단어 단위 요약(ChangeBanner)로 뒀으나(정적 mock), 우리는 **실제 입력 시점이 있는 entry 단위**가 "변화의 흐름"에 더 충실 → entry 단위 채택 + 단어 단위는 파생. ChangeBanner는 당분간 미사용(노드별 표시와 중복 회피).
- **다음 할 일**: (선택) 과거 entry에 변화 메모 소급 추가/수정(액션시트 항목), 단어장 리스트(WordRow)에 최신 변화 노트 미리보기.

### 2026-06-02 — 웹 구동 검증 + format-date 유실 근본원인(gitignore) 수정
- **실제 구동 검증**: Expo Web(`expo start --web`) + 시스템 Chrome(playwright-core headless)로 시드 데이터 주입 후 Task #14~#16 전 기능 캡처. `pageerror` 0, 웹 번들 정상 컴파일.
  - 마이페이지(라이트/다크)·테마 토글 전환·닉네임/실제통계·changeNote 입력(재정의 시)·타임라인 변화노트 표시 모두 시각 확인.
- **유실 근본원인 규명**: `src/lib/format-date.ts`가 사라졌던 건 루트 `.gitignore`가 **Python 템플릿**이라 17번 `lib/`(파이썬 빌드 산출물용)이 우리 소스 `front/mobile/src/lib/`까지 무시 → 이전 세션이 만들어도 **커밋 자체가 안 됐음**. 작업트리에서 파일이 사라지자 복구 불가였던 것.
  - 수정: `.gitignore`에 `!front/mobile/src/lib/` 예외 추가 → 추적 복원 확인(`git add` 인식).
  - **잠재 리스크(미해결)**: 루트 gitignore가 Python용이라 `build/`·`dist/`·`target/`·`*.log`·`env/` 등도 RN 소스와 충돌 가능. 향후 루트 gitignore를 Node/Expo용으로 교체 검토 필요.

### 2026-06-02 — Task #15: 마이페이지 + 다크 모드 토글 복원 ★
- **신규 store** `settings-store.ts` — `themeMode('light'|'dark'|'system')` + `nickname`. persist 키 `define-settings-v1`. 기본 themeMode='light' (제품 결정 유지 → 기존 사용자 무변화).
- **`useTheme()` 리팩터** — 라이트 강제 제거. settings-store의 themeMode + (system이면) `useColorScheme()`로 라이트/다크 분기. 다크 토큰(이미 1급 시민)을 토글로 즉시 복원. useTheme를 쓰는 모든 컴포넌트가 모드 변경 시 자동 리렌더.
- **신규 컴포넌트**:
  - `ThemeModeToggle` — 라이트/다크/시스템 3분할 세그먼트. onLayout으로 내부 폭 측정 → 하이라이트 translateX 200ms 슬라이드.
  - `NicknameSheet` — CustomWordSheet 규약(250ms autoFocus·카운터·Enter submit) 그대로. 현재 닉네임 prefill 편집. 익명 모델이라 빈 값(미설정) 허용.
- **`mypage.tsx`** (루트 Stack, (tabs) 밖) — 프로필(닉네임/아바타 + **실제** 기록 통계) · 화면(테마 토글) · 설정(닉네임/알림[준비중]) · 곧 만나요(프리미엄·PDF, BM 로드맵 disabled) · 버전(expo-constants). 프로필/행 탭 → 닉네임 시트.
- **진입점**: 메인 기록 화면 상단에 앱 헤더(워드마크 `define` + 우상단 아바타 버튼) 추가 → `router.push('/mypage')`. IA의 "헤더 우상단: 마이페이지" 충족.
- `_layout.tsx` 루트 Stack에 `headerShown:false` 명시 (mypage가 자체 back 헤더 렌더).
- **의도적 제외**: 루비/연속출석 등 가짜 게이미피케이션 수치 X(기획 미확정). "데이터 초기화"도 재도입 X(Task #14 제거 결정 존중) — 정식 "전체 삭제"는 P2로 분리.
- **레포 헬스 복구**: 작업 중 `src/lib/format-date.ts`가 디스크·git 양쪽에서 **유실**된 상태 발견(Task #9/#11 로그엔 작성됨). index/date-sheet/journal-store가 import해 프로젝트 전체가 컴파일 불가였음. design-source의 원본 구현 + `types/word.ts` 포맷 주석으로 정확히 복원(`formatKoreanDate`/`isSameDay`/`formatYmd`/`formatRelativeLabel`). 이제 `tsc --noEmit` 통과.
- **검증**: `npm install` 후 `tsc --noEmit` 에러 0. (실기기/시뮬 구동 검증은 다음 세션.)
- **다음 할 일**: 실기기에서 다크 토큰 대비 점검(특히 point/ruby), 알림·PDF·프리미엄 실제 기능, 전체 삭제(P2).

### 2026-06-02 — Task #14: entry 수정/삭제 (롱프레스 → 액션시트)
- `WordEntry`에 `id` 추가. store에 `updateEntry` 액션.
- 신규 primitives: `ActionSheet`(슬라이드업, destructive=ruby, 취소 별도 카드), `ConfirmDialog`(spring pop, destructive면 ruby 강조).
- `TimelineNode` 확장: `editing` 모드(카드 → TextField, 120ms 후 autoFocus), `onLongPress` 350ms.
- 단어 상세에 안내 문구 "길게 눌러 수정/삭제". entries=0 되면 자동 `router.back()`.
- UX 디테일: 액션시트→confirm 사이 200ms, confirm→onConfirm 180ms 딜레이로 모달 충돌 방지.
- **사용자 가치 회복**: "데이터 초기화"는 디버그 편의(=개발자 시점)였음. 사용자 지적 후 마이페이지에서도 제거 확정.

### 2026-06-02 — Task #13: 중앙 record 탭 시각 강조
- `RecordTabChip` — pill 칩(46×30) + feather. inactive=p100 배경/p600 아이콘, active=p600 배경/흰 아이콘/포인트 글로우.
- 상태 전환 시 180ms 색 보간 (Animated.Value 0↔1, color는 native driver 미지원).
- `(tabs)/_layout.tsx`에 `center?: boolean` 옵션 추가.

### 2026-06-02 — Task #12: CustomWordSheet + 단어 swap 트랜지션
- `TextField` forwardRef로 업그레이드(외부 ref autoFocus).
- `CustomWordSheet` — 슬라이드업 + 250ms 후 autoFocus + 12자 카운터 + Enter submit + KeyboardAvoidingView + 닫힘 시 입력 초기화.
- 메인 화면 `swapTo` 공통 함수 — fade-out + translateY 8 (180ms) → 인덱스/풀 갱신 → fade-in (200ms). drawNew/addCustom/저장 후 자동 전환 모두 적용.
- **UX 원칙 즉시 반영**: 이전 즉시 변경이던 단어 swap을 트랜지션으로 교체.

### 2026-06-02 — Task #11: DateSheet (캘린더 바텀시트)
- RN Modal + 커스텀 7열 그리드. 미래 비활성, 오늘 강조, 선택=p600 채움. 월 nav ◀▶ (다음 달이 미래면 ▶ 비활성).
- `store.addEntry`에 옵셔널 `savedAt: Date` 추가 — 과거 날짜 기록 지원.
- **회고**: Edit 중복으로 같은 함수 두 번 정의 → grep 사전 확인 안 한 실수. tsc 즉시 잡아내서 회복.

### 2026-06-02 — 브랜드 자산 통합 (define.png 1024×1024)
- 1024×1024 로고 한 장으로 모든 슬롯 통합: 공통 icon · web.favicon · android.adaptiveIcon.foregroundImage · splash.
- `app.json` name: "mobile" → "define". splash backgroundColor: 파랑 → warm paper(#FCFAF6).
- 옛 Expo 기본 자산 일괄 삭제 (expo.icon 폴더, icon.png, favicon.png, splash-icon.png, android-icon-*.png 등).
- 최종 자산: `PretendardVariable.ttf` + `define.png` 두 개만.

### 2026-06-02 — Task #10: 기록 완료 마이크로 인터랙션
- `SaveConfirmation` — RN Modal + Animated.spring(scale)/timing(opacity). 포인트 원 + 흰 체크 pop + "{단어}을(를) 기록했어요" + 부제. 1.6초 후 자동 dismiss → drawNewWord로 자연스럽게 이어짐.
- 시스템 Alert 완전 제거. Keyboard.dismiss() 호출.
- **회고**: Task #7에서 "별도 후속"으로 분류했던 게 잘못된 우선순위. 화면 단위 마이크로 UX는 그 화면 작업에 묶을 것 — UX 원칙으로 박힘.

### 2026-06-02 — Task #9: 라이트 강제 + 글로벌 store(Zustand+AsyncStorage)
- `zustand` + `@react-native-async-storage/async-storage` 도입.
- `src/store/journal-store.ts` — `SavedEntry[]` flat 모델 + persist(`define-journal-v1`). `useGroupedByWord` / `useJournalWord` / `useJournalStats` selector.
- `src/lib/format-date.ts` 확장 — `formatYmd`, `formatRelativeLabel` (오늘/어제/N일 전/지난달/N달 전/작년/N년 전).
- `useTheme`을 라이트 강제로 변경 (다크 토큰은 유지 — 추후 토글 시 즉시 복원).
- mock-journal.ts 삭제. 빈 상태 UI 추가.
- **익명 사용자 모델 확립** — 회원가입/백엔드 없이 폰에 영구 누적.

### 2026-06-02 — Task #8: 단어장 + 단어별 타임라인
- 도메인 타입 `WordEntry`/`JournalWord`.
- 도메인 컴포넌트: `WordRow`(리스트 row), `TimelineNode`(원+세로선+카드), `ChangeBanner`.
- 단어장 폴더 라우트: `(tabs)/journal/{_layout,index,[word]}.tsx`.
- **결정**: 탭 안 push 전환을 위해 journal 폴더에 자체 Stack 레이아웃 추가 — BottomTabNavigator만으로는 동적 라우트 push 동작 X.

### 2026-06-02 — Task #7: 메인 기록 화면 본격 구현 ★
- `(tabs)/index.tsx`: 날짜 칩 + Hero(display 52px) + 입력 스테이지(Card+borderless TextInput+카운터) + 액션(단어 추가/기록 완료).
- mock `recommended-words.ts` + `formatKoreanDate`/`isSameDay` 헬퍼.
- KeyboardAvoidingView로 키보드 회피.
- `Button`에 외부 style prop 받도록 수정.

### 2026-06-02 — Task #6: 탭 네비게이션 + 5화면 스캐폴드
- `(tabs)/_layout.tsx` — Expo Router `<Tabs>` 5탭. 활성=point.p600/비활성=ink.placeholder.
- 5개 화면 파일 + 공통 `ScreenPlaceholder` 컴포넌트.
- 라우트: `/`(기록), `/plaza`, `/mood`, `/past`, `/journal`.

### 2026-06-02 — Task #5: primitives (Button/Card/TextField)
- variant(primary/soft/ghost) × size(md/sm), focus 시 포인트 보더, multiline 지원.
- barrel export `@/components/primitives`.

### 2026-06-02 — Task #4: 아이콘 셋 27개
- `react-native-svg@15.15.4` 설치.
- `src/icons/index.tsx` 단일 `Icon` 컴포넌트 + name prop switch. 24×24 / 1.7px stroke. design-source/icons.jsx와 1:1.

### 2026-06-02 — Task #3 + Pretendard: 디자인 토큰
- `src/theme/` 7개 파일 (colors/typography/spacing/radii/shadows/fonts/index). useTheme() 훅.
- `themed-text`/`themed-view`를 우리 토큰으로 교체.
- Pretendard Variable ttf 6.4MB를 assets/fonts/에 두고 expo-font useFonts로 로드, expo-splash-screen으로 깜빡임 방지.

### 2026-06-02 — Task #1·#2: Expo 초기화 + 폴더 구조 정리
- nvm + Node v24.16.0 설치. `front/mobile/`에 Expo SDK 56 default 템플릿 (TS + Expo Router).
- Expo 예제 컴포넌트 일괄 삭제, 도메인 폴더 생성, `src/README.md` 폴더 지도 작성.

### 2026-06-02 — 문서/폴더 구조 재편
- 단일 정의서 v1.0 → PLANNING.md + DEVELOPMENT.md 분리.
- 폴더 재편: `front/{design-source,vendor,mobile}` + `back/`.
- `prototype/` → `design-source/` 리네이밍 (사용자 지적 — 폐기성 아니라 SSOT).
