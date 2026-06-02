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
9. 라이트 톤 강제 + 브랜드 자산(define.png 1024×1024) 통합

**🟡 다음 후보 (우선순위 미정)**
- 마이페이지 (헤더 진입점 + 테마 토글로 다크 모드 복원 입구 + 닉네임/알림 placeholder + 버전)
- 광장 — **백엔드 종속**. 보류 또는 백엔드 시작
- 회고/검색/주간 회고 (좌2 탭 — 기획 미확정)
- 과거의 나와 대화 (GPT API 종속)
- 자잘한 폴리시: 단어 전체 삭제, 통계 보강(streak), changeNote 정성 입력

**⏳ 큰 결정 대기**
- 백엔드 시작 시점 / 스택 (Node·Python·Go 등)
- 회원가입 흐름 (소셜/일반)

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
| 백엔드 | 미정. 현재는 익명 + 로컬 영속 모델 |
| 외부 API | GPT API (과거의 나 기능 — 후속 단계) |

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
│       │   │   ├── _layout.tsx               # 폰트 로드 + Stack
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
│       │   │   ├── themed-text.tsx · themed-view.tsx
│       │   ├── theme/           colors/typography/spacing/radii/shadows/fonts/index
│       │   ├── store/           journal-store.ts (Zustand+persist)
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
└── back/                       # 빈 폴더 (.gitkeep만)
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
| **메인 — 기록** (`/`) | ✅ 완료 | 단어 swap 트랜지션 / DateSheet / CustomWordSheet / SaveConfirmation. 저장 시 store.addEntry |
| **단어장 리스트** (`/journal`) | ✅ 완료 | 가나다 정렬, 통계(총 기록/생각 변화), 빈 상태 안내, 변화 뱃지 |
| **단어 상세** (`/journal/[word]`) | ✅ 완료 | 타임라인 + 인라인 편집 + 삭제(ConfirmDialog) + entries=0 시 자동 router.back |
| 광장 (`/plaza`) | 🟡 placeholder | 백엔드 종속 — 다른 사용자 데이터 필요 |
| 회고 (`/mood`) | 🟡 placeholder | 기획 미확정 |
| 과거의 나 (`/past`) | 🟡 placeholder | GPT API 종속 |
| 마이페이지 | ⏳ 미착수 | 헤더 진입점 없음. 테마 토글 입구도 여기 |
| 온보딩/회원가입/로그인 | ⏳ 미착수 | 회원가입 도입 시점 결정 필요 |

---

## 5. 핵심 아키텍처 결정

### 익명 사용자 + 로컬 영속 (현재 단계)
회원가입/백엔드 없이도 폰의 AsyncStorage에 단어 누적. 핵심 가치(기록·회고) 검증 가능. 백엔드 도입 시 첫 로그인 마이그레이션으로 서버 전송.

### Store 모델 (flat normalize)
`SavedEntry[]` 한 배열 (`id`, `word`, `text`, `savedAt`). 단어별 그룹화는 selector(`useGroupedByWord`)에서. 모델은 단순, 디스플레이는 자유.
- Store key: `define-journal-v1` (모델 깨면 v2로 마이그레이션)
- 액션: `addEntry(word, text, savedAt?)`, `updateEntry(id, text)`, `removeEntry(id)`, `clearAll`
- `changed`는 entries.length≥2일 때 자동. `changeNote`는 정성 항목이라 자동 생성 X (추후 사용자 입력 또는 ML)

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
- `useTheme()` 현재 lightTheme 고정 반환
- 다크 토큰은 `darkColors`, `darkShadows`로 코드 유지 → 추후 마이페이지 토글 또는 시스템 분기로 즉시 복원 가능

---

## 6. 미확정 / 결정 필요 (개발)

- [ ] **백엔드 스택** — 광장/회원가입/동기화 진입 시
- [ ] **회원가입 인증 방식** — 소셜(Google/Apple/Kakao) / 일반 / 게스트 마이그레이션
- [ ] **GPT API 연동 방식·비용 정책** — 과거의 나 기능
- [ ] **iOS/Android 실기기 빌드** — 현재는 웹 검증만. EAS Build 시점
- [ ] **광장 데이터 모델** — 정의 공유 정책, 익명 닉네임, 신고/모더레이션
- [ ] **알림 푸시 인프라** — Expo Push / FCM

---

## 작업 로그 (개발)

> 개발·기능명세·디자인 시스템 구현·기술 결정 변경만 누적. 역시간순(최신 위).
> 형식: `### YYYY-MM-DD — 한 줄 요약` + 핵심 변경 + 회고가 있으면 회고.

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
