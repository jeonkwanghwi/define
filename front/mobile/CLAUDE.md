@AGENTS.md

# front/mobile — define RN/Expo 본 프로젝트

이 폴더는 define의 **React Native (Expo) 모바일 앱**입니다. iOS/Android 타깃, 웹은 부수적.

## 작업 전에 읽기 (필수)
- 상위 문서: `../../docs/PLANNING.md` (기획·브랜드·BM), `../../docs/DEVELOPMENT.md` (개발 맥락·기능 명세·산출물 우선순위·작업 로그)
- 폴더 지도: `./src/README.md` — 새 파일을 어디에 둘지 헷갈리면 먼저 확인
- 디자인·화면 구조의 원본 시드: `../design-source/` (HTML+React로 작성된 SSOT. RN 화면 작업 시 참조)

## 핵심 기술 스택
- **Expo SDK 56** (`expo-router` file-based routing)
- **TypeScript 6** + **React 19** + **React Native 0.85**
- **스타일링**: StyleSheet + theme 객체 (NativeWind/Tamagui 미사용)
- **라이트/다크**: `useColorScheme` 훅 + `theme/` 토큰 페어

## 작업 흐름
1. 디자인 토큰(색·타입·스페이싱)은 `src/theme/`에서 단일 출처로 관리
2. 화면 구현은 `../design-source/`의 동등 화면을 참조 후 RN으로 옮김
3. 의미 있는 변경은 `../../docs/DEVELOPMENT.md` 작업 로그에 기록 (룰: 상위 CLAUDE.md 참조)
