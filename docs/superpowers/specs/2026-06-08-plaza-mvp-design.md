# 광장 1차 (읽기 전용 MVP) 설계 (Spec)

> 작성일 2026-06-08 · 범위: **광장 읽기 전용 MVP — 컨셉1(단어 중심)** (추천·신고·컨셉2는 후속 슬라이스)
> 선행: 프론트 인증 연결 + 게이트 완료(main). 근거: [PLANNING.md](../../PLANNING.md) §4·§5 · [DEVELOPMENT.md](../../DEVELOPMENT.md) §5

## 1. 목적

"**남들은 이 단어를 어떻게 정의했나**"를 보여주는 광장의 핵심 가치를 읽기 전용으로 구현한다(§5). 시드 데이터로 콜드스타트(빈 방)를 해결하고, 단어별로 여러 유저의 정의를 묶어 보여준다. 추천/신고/싸이월드式(컨셉2)은 후속 슬라이스로 분리.

## 2. 확정된 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|------|------|
| 범위 | 읽기 전용 MVP. 추천=2차, 신고=3차, 컨셉2(아바타 마을)=별도 트랙 |
| 표시 컨셉 | **컨셉1 단어 중심**(단어 → 여러 유저의 정의) |
| 노출·상호주의 모델 | **시드 정의 + 내 정의(나에게만 강조)**. 진짜 타인 공개 자동화는 배포·다유저 시 명시적 동의로. 상호주의 게이팅 = 로그인(AuthGate + JwtAuthGuard 이중) |
| 시드 | throwaway 로컬 — 닉네임 붙은 시드 유저 ~10명 + 추천 단어에 큐레이션 정의 분배(멱등) |
| canonical 클러스터링 | `word` 문자열 그대로 그룹. 유사어 병합은 후속 |

## 3. 데이터 모델 — 신규 테이블 없음

기존 `Entry`(`userId`, `word`, `text`, `savedAt`, `changeNote?`) + `User.nickname`을 그대로 활용. 광장 = "여러 유저의 `Entry`를 `word`로 묶어 보여주기". 마이그레이션 없음.

## 4. 시드 (throwaway 로컬, `back/`)

- **시드 유저 ~10명** — 닉네임 부여(광장 표시명). 멱등 upsert(이메일 기준).
- **추천 단어 집합 ~15개**(예: 행복·사랑·시간·외로움·자유·꿈·어른·돈·친구·위로·이별·청춘·용기·불안·습관) 각각에 **관점이 다른 정의 문장 2~4개**를 시드 유저들에게 분배해 `Entry` 삽입(멱등, `clientId` = 결정적 키).
- 정의는 **그럴듯하고 다양한 문장**(노이즈 아님). 예: "행복" → "잠깐 멈춰 지금 충분하다 느끼는 순간" / "불행이 잠시 비켜간 상태" / "비교를 멈췄을 때의 고요".
- 재현 가능(스크립트). 지금은 로컬 데모용, prod 시드는 배포 시 재실행 가능하나 본 범위 밖.
- 기존 ad-hoc 테스트 유저(닉네임 없음·정의 없음)는 광장에 안 나타남(정의 0) → 무해.

## 5. 백엔드 — `modules/plaza` (word 모듈 패턴 동일)

레이어: controller → service → repository(인터페이스) → Prisma 구현. 신규 테이블 없음(Entry+User 조회). **모든 라우트 `JwtAuthGuard`**(상호주의 = 로그인).

| 엔드포인트 | 응답 | 비고 |
|---|---|---|
| `GET /api/plaza/words` | `[{ word, count }]` | 정의 1개 이상인 단어. 정의 많은 순 정렬 |
| `GET /api/plaza/words/:word` | `{ word, definitions: [{ id, nickname, text, savedAt, isMine }] }` | `isMine`(요청자 정의)는 **맨 위 강조**. 그 외는 savedAt 역순 |

- `nickname` 없으면(`null`) `"익명"`으로 응답.
- `isMine` = `entry.userId === req.user.userId`.
- repository: `Entry`를 `word`로 그룹 + `User.nickname` 조인.

## 6. 프론트 — plaza 탭을 stack으로 (journal 패턴 미러)

현재 단일 `(tabs)/plaza.tsx` → 폴더 구조로 전환:
```
(tabs)/plaza/_layout.tsx   자체 Stack (push 위함, journal/_layout.tsx와 동일 패턴)
(tabs)/plaza/index.tsx     AuthGate( 로그인 시 PlazaWordList ) — 게이트는 여기 유지
(tabs)/plaza/[word].tsx    단어별 정의 카드 목록 (내 정의 맨 위 강조)
```
- `services/plaza-api.ts` — `getPlazaWords(token)`, `getPlazaWord(token, word)` (api-client 재사용).
- 데이터 패칭 = `useEffect` + `useState`(프로젝트에 react-query 없음). **로딩·빈·에러 상태**를 우리 톤으로(시스템 다이얼로그 X).
- 토큰은 `useAuthStore`에서. 카드·타이포는 기존 단어장 컴포넌트 톤 재사용.
- `[word]` 상세는 로그인 상태에서만 진입(리스트가 게이트 뒤). 라우팅은 `useLocalSearchParams`로 word 디코드(journal `[word]` 패턴).

## 7. 검증 목표 (통과 기준)

테스트 프레임워크 없음 → 기존 컨벤션(백엔드 curl + 프론트 tsc/웹 번들/동작).
1. 시드 실행 → `GET /api/plaza/words`가 단어+count 반환(로그인 토큰으로)
2. `GET /api/plaza/words/행복` → 여러 정의 카드; 내가 '행복'을 정의했다면 그 정의가 `isMine:true`로 **맨 위**
3. 무토큰 → 401(게이팅)
4. 프론트: 로그인 상태 광장 탭 → 단어 리스트 → 탭 → 정의 카드들(내 정의 강조), 로딩/빈 상태 정상
5. 로그아웃 → 광장이 게이트로 복귀(기존 동작), tsc·`expo export --platform web` 0에러

## 8. 범위 밖 / 보류 (명시)

- **추천(좋아요) + 추천순 정렬** = 2차 슬라이스 · **신고/모더레이션** = 3차
- **유사어 canonical 클러스터링**(행복/행복함 병합) — 후속
- **명시적 공개/비공개 동의** — 진짜 다유저·배포 시 제대로 설계
- **컨셉2 싸이월드式(아바타 마을)** — 게임 레이어, 별도 트랙
- **prod 시드/배포** — 본 범위는 로컬 데모 시드까지
