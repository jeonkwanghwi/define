# `src/` — 폴더 지도

> 모든 앱 코드는 여기 안에 있습니다. 새 코드를 추가하기 전에 어느 폴더가 맞는지 이 문서로 확인하세요.
> import 시 `@/` 별칭 = `src/` 입니다 (예: `import { useTheme } from '@/theme'`).

## 폴더 한눈에 보기

| 폴더 | 무엇이 들어가나 | 예시 |
|------|----------------|------|
| `app/` | **Expo Router 라우트**. 파일 하나 = 화면 하나. `_layout.tsx`는 그 폴더의 공통 레이아웃 | `app/(tabs)/index.tsx` (메인 기록 화면) |
| `components/primitives/` | **재사용 가능한 UI 빌딩 블록**. 도메인 모름. 어느 앱에서도 쓸 수 있는 것 | `Button.tsx`, `Card.tsx`, `Input.tsx`, `Sheet.tsx` |
| `components/domain/` | **define에만 의미 있는 UI 컴포넌트**. 단어·정의·기록 등 도메인 개념을 다룸 | `WordHero.tsx`, `EntryComposer.tsx`, `TimelineEntry.tsx` |
| `theme/` | **디자인 토큰**. 색, 타입 스케일, 스페이싱, 라운드, 섀도우. ThemeProvider, useTheme | `colors.ts`, `typography.ts`, `spacing.ts`, `index.ts` |
| `icons/` | **define 전용 아이콘 컴포넌트** (SVG 기반) | `PlazaIcon.tsx`, `FeatherIcon.tsx` |
| `hooks/` | **커스텀 React 훅**. UI/상태 로직을 재사용할 때 | `useTheme`, `useColorScheme`, `useToday` |
| `lib/` | **순수 유틸 함수**. React 의존 X, 입력→출력만 | `formatDate.ts`, `compareWords.ts` |
| `services/` | **외부 API 호출 클라이언트** (백엔드 붙으면 채워짐) | `wordApi.ts`, `authApi.ts` |
| `data/` | **mock 데이터** (백엔드 붙기 전 임시) | `mockJournal.ts`, `recommendedWords.ts` |
| `types/` | **도메인 타입 정의**. 여러 곳에서 공유하는 타입 | `Word`, `Entry`, `User` |

> 비디자인 상수(요일명, 라우트 이름 같은 고정값)가 필요해지면 `lib/constants.ts` 또는 `lib/`의 적절한 파일에 둡니다. 초기엔 폴더 분리 안 함.

## 새 파일 어디에 둘지 헷갈릴 때

- "이게 화면이야?" → `app/`
- "이게 버튼/카드/입력창 같은 일반 UI야?" → `components/primitives/`
- "이게 단어/정의/광장처럼 define만의 개념을 다루는 UI야?" → `components/domain/`
- "이게 색·폰트·간격 같은 디자인 값이야?" → `theme/`
- "이게 함수인데 React를 쓰지 않아?" → `lib/`
- "이게 함수인데 React 훅(`use~`)을 쓰거나 만들어?" → `hooks/`
- "이게 백엔드 통신이야?" → `services/`
- "이게 타입/인터페이스야?" → `types/`

## 네이밍 컨벤션

- 파일/폴더: **kebab-case** (`themed-text.tsx`, `use-color-scheme.ts`) — Expo 기본 스타일을 따름
- 컴포넌트 이름: **PascalCase** (`ThemedText`, `WordHero`)
- 훅 이름: **camelCase + `use` 접두사** (`useTheme`)
- 타입/인터페이스: **PascalCase** (`Word`, `EntryProps`)
