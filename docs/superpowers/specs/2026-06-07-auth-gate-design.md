# 가입 유도 게이트 설계 (Spec)

> 작성일 2026-06-07 · 범위: **프론트 2차 — 3탭 가입 유도 게이트** (잠금 화면 방식)
> 선행: 프론트 인증 연결 1차 완료(main). 근거: [PLANNING.md](../../PLANNING.md) §5 · [DEVELOPMENT.md](../../DEVELOPMENT.md) §0·§5

## 1. 목적

익명우선 모델의 **탭 게이팅 정책**(§5)을 구현한다. 가입이 필요한 3탭(광장·회고·과거의나)에 로그아웃 사용자가 진입하면, 콘텐츠 대신 **가입 유도 잠금 화면**을 보여 `/auth`로 전환을 유도한다. 1차에서 만든 `auth-store` 상태를 소비하는 레이어 — 전환 퍼널(가입 유도 → `/auth` → 동기화)을 완성한다.

**중요 전제**: 게이트가 걸리는 3탭은 아직 전부 placeholder(실제 기능은 백엔드/GPT/기획 대기). 따라서 게이트는 "진짜 콘텐츠"를 가리는 게 아니라 **로그아웃 시 placeholder 대신 가입 유도 화면**을 노출한다. 진짜 콘텐츠가 생기면 게이트는 그대로 재사용된다.

## 2. 확정된 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|------|------|
| 시점 | 지금 구현(가릴 진짜 콘텐츠 없어도 — auth 상태 소비 레이어, 자체 완결) |
| 시각 형태 | **깔끔한 잠금 화면**(가짜 콘텐츠·블러 라이브러리 없음). 블러 티저는 진짜 콘텐츠 생길 때 후속 |
| 대상 탭 | 광장(`plaza`)·회고(`mood`)·과거의나(`past`). 기록(`index`)·단어장(`journal`)은 게이트 없음 |
| 탭바 | **숨기지 않음** — §5 "진입 시 유도". 탭 레이아웃 무변경 |
| CTA | "가입하고 시작하기" → `router.push('/auth')` |

## 3. 컴포넌트: `AuthGate`

`src/components/domain/auth-gate.tsx` — 인증 상태로 분기하는 재사용 래퍼.

```
props:
  icon: IconName          // 탭 아이콘 (plaza/mood/past)
  title: string           // 탭 이름
  description: string      // 왜/무엇이 열리는지 (탭별 유도 문구)
  children: ReactNode      // 로그인 사용자가 볼 콘텐츠 (현재는 ScreenPlaceholder)
동작:
  const token = useAuthStore((s) => s.token)
  token 있으면  → <>{children}</>
  token 없으면  → 잠금 게이트:
     탭 아이콘 + title + description + lock 아이콘 + Button "가입하고 시작하기"(→ router.push('/auth'))
```

- `useAuthStore` token 구독 → 로그인/로그아웃 시 자동 리렌더로 전환(별도 트랜지션 코드 없이 React 리렌더; UX 원칙의 부드러움은 기존 화면 전환이 담당).
- 레이아웃은 기존 `ScreenPlaceholder`의 중앙 정렬 톤을 따른다(paper bg, 중앙 정렬, 우리 `Button`, `lock` 아이콘 — 모두 기존 자산 재사용).
- 단일 책임: "인증 여부에 따라 children ↔ 가입 유도 화면을 고른다." 탭별 문구는 props로 주입 → 컴포넌트는 탭을 모른다.

## 4. 3탭 적용

각 탭 파일이 기존 placeholder를 `AuthGate`로 감싼다. 로그인 시 placeholder 그대로, 로그아웃 시 게이트.

```tsx
// 예: src/app/(tabs)/plaza.tsx
<AuthGate icon="plaza" title="광장" description="다른 사람들은 이 단어를 어떻게 정의했을까요? 가입하고 내 정의를 나누면 광장이 열려요.">
  <ScreenPlaceholder iconName="plaza" title="광장" subtitle="같은 단어, 저마다 다른 정의들" note="화면 구현은 추후 진행" />
</AuthGate>
```

### 탭별 유도 문구 (description)
- **광장(plaza)**: "다른 사람들은 이 단어를 어떻게 정의했을까요? 가입하고 내 정의를 나누면 광장이 열려요." (§5 상호주의)
- **회고(mood)**: "회고 공간을 준비하고 있어요. 가입해두면 가장 먼저 만나요." (기능 미확정 — 절제된 톤)
- **과거의 나(past)**: "과거의 정의로 '그때의 나'와 대화해요. 가입하면 만날 수 있어요."

## 5. 정책·흐름 일관성

- CTA → `/auth` → 가입/로그인 성공 시 `auth.tsx`의 `router.back()`이 **해당 탭으로 복귀** → `AuthGate`가 token을 보고 children으로 전환.
- 기록(`index`)·단어장(`journal`)은 게이트 없음(무가입 정책, §5).
- 로그아웃(마이페이지) 시 token이 null → 게이트가 다시 노출(자동).

## 6. 검증 목표 (통과 기준)

테스트 프레임워크 없음 → 기존 프론트 컨벤션(tsc + Expo Web 번들 + 동작 확인):
1. **로그아웃 상태**에서 광장/회고/과거의나 진입 → 각 탭 **잠금 게이트 + CTA** 노출(탭별 문구 확인)
2. CTA 탭 → `/auth` 진입 → 가입 또는 로그인 → **해당 탭이 placeholder로 전환**
3. 마이페이지에서 **로그아웃** → 3탭이 다시 게이트로 복귀
4. **기록·단어장** 탭은 게이트 없이 정상 동작
5. 만진 파일 `npx tsc --noEmit` 에러 0, `expo export --platform web` 번들 0에러

## 7. 파일 구조

**신규**
```
src/components/domain/auth-gate.tsx   인증 분기 래퍼 (잠금 게이트 ↔ children)
```
**수정**
```
src/app/(tabs)/plaza.tsx              AuthGate로 감쌈 + 유도 문구
src/app/(tabs)/mood.tsx               동일
src/app/(tabs)/past.tsx               동일
```

## 8. 범위 밖 / 보류 (명시)

- **블러 티저** — 진짜 콘텐츠(예: 광장 정의 카드)가 생기는 시점에 승격.
- **각 탭 실제 기능**(광장 백엔드 / 회고 기획 / 과거의나 GPT) — 별개 후속.
- **다운로드 동기화 · 닉네임 정합 · 에러 카피 다듬기** — 후속.
- 탭바에서 게이트 탭 숨기기 — §5에 반함(하지 않음).
