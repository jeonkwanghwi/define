# define — 개발 (Development)

> 기술 스택 · 현재 상태 · 화면별 구현 · 핵심 아키텍처 · 작업 로그
> 브랜드/BM/정책은 [PLANNING.md](./PLANNING.md) 참조.

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
12. **백엔드 마일스톤1 (NestJS+Prisma)** — `back/` 스캐폴드, `GET /api/words` 풀 슬라이스 동작(controller→service→repository→SQLite). DB 스왑 대비 repository 인터페이스

**🟡 다음 후보 (우선순위 미정)**
- 광장 — **백엔드 종속**. 보류 또는 백엔드 시작
- 회고/검색/주간 회고 (좌2 탭 — 기획 미확정)
- 과거의 나와 대화 (GPT API 종속)
- (없음 — 무의존 폴리시 소진. 남은 건 결정/빌드/백엔드 대기)
- 마이페이지 후속: 알림/PDF/프리미엄 실제 기능, 다크 톤 실기기 대비 점검

**⏳ 큰 결정 대기**
- ~~백엔드 시작 시점~~ → **착수함** (NestJS+Prisma, 마일스톤1 완료). 다음: auth → journal 동기화 → plaza
- 회원가입 흐름 (소셜/일반) · 관리자 모드 (웹 별도 vs 앱 내)
- AI 정의 이미지/영상화 · 금주의 단어 · 광장 표시 컨셉

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
| 백엔드 | **NestJS** (TypeScript) · REST/JSON. **프론트와 동일 언어**(TS 단일 스택, DTO 타입 공유 가능). 현재 미구현(익명+로컬 영속), 광장/회원가입 착수 시 본격. (FastAPI에서 변경 — 2026-06-03 로그) |
| 백엔드 아키텍처 | MVC 계열 — **controller / service / repository / dto** 레이어 + 모듈별(`modules/<도메인>/`) 구성. DI로 repository 인터페이스↔구현 바인딩 |
| DB | **시작: SQLite 파일DB** + **Repository 인터페이스로 격리** → 나중에 스왑. 종착 **Postgres 유력**(SQL→SQL 매끄러움; Mongo도 repository가 막아주므로 가능). 구현: **Prisma 제안**(SQLite/Postgres 동일 스키마). 확정은 보류 |
| 인프라/배포 | **AWS** — 회원·데이터 관리 |
| 외부 API | GPT API — 과거의 나. 파인튜닝 전략: 공통 페르소나 1차 파인튜닝 + 유저별 few-shot 최적화. (사진 기반 talking-video는 별도 생성 파이프라인) |

---

## 2. 현재 레포 상태

```
/Users/kwanghwi/dev/define/
├── CLAUDE.md / PLANNING.md / DEVELOPMENT.md / README.md / LICENSE / .gitignore
│
├── front/
│   ├── design-source/        # HTML+React 시드/SSOT (RN 포팅 참조 — 위상 유지)
│   ├── vendor/               # 외부 공용 모듈 (tweaks-panel.jsx)
│   └── mobile/               # RN/Expo 본 프로젝트 ★
│       ├── src/
│       │   ├── app/                          # Expo Router 라우트
│       │   │   ├── _layout.tsx               # 폰트 로드 + Stack(headerShown:false)
│       │   │   ├── mypage.tsx                 # 마이페이지 (탭 밖 풀스크린)
│       │   │   └── (tabs)/
│       │   │       ├── _layout.tsx           # 5탭 + chip 강조
│       │   │       ├── index.tsx             # 기록 (메인)
│       │   │       ├── plaza.tsx             # 광장 (placeholder)
│       │   │       ├── mood.tsx              # 회고 (placeholder)
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
| 회고 (`/mood`) | 🟡 placeholder | 기획 미확정 |
| 과거의 나 (`/past`) | 🟡 placeholder | GPT API 종속 |
| **마이페이지** (`/mypage`) | ✅ 완료 | 헤더 우상단 아바타 진입 / 테마 토글(라·다·시) / 닉네임 편집 / 실제 통계 / 버전. 알림·PDF·프리미엄은 준비중 |
| 온보딩/회원가입/로그인 | ⏳ 미착수 | 회원가입 도입 시점 결정 필요 |

---

## 5. 핵심 아키텍처 결정

### 익명 사용자 + 로컬 영속 (현재 단계)
회원가입/백엔드 없이도 폰의 AsyncStorage에 단어 누적. 핵심 가치(기록·회고) 검증 가능. 백엔드 도입 시 첫 로그인 마이그레이션으로 서버 전송.

### Store 모델 (flat normalize)
`SavedEntry[]` 한 배열 (`id`, `word`, `text`, `savedAt`). 단어별 그룹화는 selector(`useGroupedByWord`)에서. 모델은 단순, 디스플레이는 자유.
- Store key: `define-journal-v1` (모델 깨면 v2로 마이그레이션)
- 액션: `addEntry(word, text, savedAt?)`, `updateEntry(id, text)`, `removeEntry(id)`, `clearAll`
- `changed`는 entries.length≥2일 때 자동. `changeNote`는 **재정의 시 사용자 입력**(entry 단위, 선택). 자동 생성/ML은 추후. 단어 단위 `JournalWord.changeNote`는 최신 entry 노트로 파생

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

- [x] **백엔드 스택** — FastAPI + MVC(controller/service/dto) + REST/JSON 결정. 착수 시점만 미정
- [ ] **DB 확정** — MongoDB 적합성(스키마리스 vs 관계형) + AWS 호스팅 형태(Atlas / DocumentDB / self-host)
- [ ] **인증 모델(보류)** — 익명우선① vs 서버익명② vs 가입필수③ 3모델 검토 완료, **추천 ①**, 팀 논의 보류(작업 로그 참조). 이후 인증 방식(소셜 Google/Apple/Kakao / 일반 / 로그아웃)은 모델 확정 후.
- [ ] **GPT 연동·비용** — 과거의 나. 파인튜닝(공통 페르소나)+few-shot, 비용 정책
- [ ] **AI 정의 이미지/영상 생성** — 모델·파이프라인·비용(온디바이스 불가 → 서버/외부 API), 릴스式 피드 데이터 모델, 사진 기반 talking-video
- [ ] **관리자 모드** — 웹 별도 어드민 vs 앱 내. 금주의 단어 지정·추천 단어 풀·신고 처리
- [ ] **iOS/Android 실기기 빌드** — 현재는 웹 검증만. EAS Build 시점
- [ ] **광장 데이터 모델** — 공유 정책, 익명 닉네임, 신고/모더레이션, 추천·추천순 정렬, 표시 컨셉(단어 vs 싸이월드式)
- [ ] **알림 푸시 인프라** — Expo Push / FCM (로컬 리마인더는 별개로 선구현 가능)
- [ ] **출석 체크** — 출석 시 루비 지급(예: 10루비). 게이미피케이션 노출 정책과 연동
- [ ] **추천 단어 풀 저장 형식(보류)** — 50선 큐레이션 완료(작업 로그 참조). 카테고리 **제외 확정**, 형식 A(플랫 `string[]`) vs B(객체 `{word}[]`)는 **팀 논의 보류**. 저장 위치: AsyncStorage 아님(앱 배포 콘텐츠) → 현 로컬 파일. 앱 업데이트 없이 단어 추가하려면 원격(백엔드/호스팅 JSON) 승격 필요.
- [ ] **탭2 아바타 마을(보류)** — 게임 레이어 기술 선택 미정. 후보: ⓐ `@shopify/react-native-skia`(네이티브 2D 캔버스, worklets 게임루프, 품질↑/비용↑) ⓑ WebView+Phaser/Pixi(타일맵·이동·충돌 즉시, 브릿지·성능 마찰) ⓒ RN View+SVG+Reanimated(저사양·작은 맵). 현재 미설치(skia/expo-gl 없음). **비동기 월드 데이터 모델**(집=유저 스냅샷, 실시간 동기화 배제) 설계 필요. 백엔드·계정·루비 서버 경제 선행. 상세 기획 [PLANNING.md](./PLANNING.md).

---

## 작업 로그 (개발)

> 개발·기능명세·디자인 시스템 구현·기술 결정 변경만 누적. 역시간순(최신 위).
> 형식: `### YYYY-MM-DD — 한 줄 요약` + 핵심 변경 + 회고가 있으면 회고.

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
