/**
 * 글꼴 세트 — 본문 글꼴을 **갈아끼울 수 있게** 역할별로 묶어 둔다(팔레트와 같은 방식).
 *
 * 역할:
 *   serif / serifBold = 읽는 글. 제목과 본문(사용자가 쓴 정의·회상 대화).
 *     define은 사전이고 기록이다. 지금 세트(나눔명조)의 획 끝 돌기가 그 정체성과 붙는다.
 *   sans = 조작하는 글. 14px 이하 라벨·캡션·숫자·버튼.
 *     명조는 그 크기에서 획이 뭉개진다 → 크기가 아니라 **역할**로 가른다.
 * 로고("define.")는 글꼴이 아니라 SVG라 여기와 상관없다(src/data/logo.ts).
 *
 * ── 새 글꼴 세트를 넣는 법 ──
 *   1. 글꼴 파일(.ttf/.otf)을 assets/fonts/ 에 둔다. 정적 글꼴이면 두께마다 파일이 따로다.
 *   2. FONT_FILES에 "패밀리 이름: require(파일)"을 더한다(이름은 아무거나, 겹치지만 않게).
 *   3. FONT_SETS에 세트 하나를 더한다: { label, serif, serifBold, sans } — 값은 2의 패밀리 이름.
 *   4. (사용자가 고르게 하려면) 마이페이지에 고르는 줄을 붙인다 — settings-store의 setFontSet.
 *   기본값을 바꾸려면 DEFAULT_FONT_SET 한 줄.
 *
 * 한글 글꼴은 두께 하나당 ~3MB라 세트를 늘릴수록 앱이 커진다. 꼭 쓸 두께만 싣는다.
 * 정적 글꼴은 fontWeight로 두께를 못 고른다 → 두께마다 패밀리 이름이 다르다.
 */

export type FontSet = {
  /** 고르는 화면에 보일 이름 */
  label: string;
  /** 읽는 글 — 보통 두께 */
  serif: string;
  /** 읽는 글 — 굵게(제목) */
  serifBold: string;
  /** 조작하는 글 — 라벨·버튼·숫자 */
  sans: string;
};

/** 앱 시작 때 한 번에 불러오는 글꼴 파일들(_layout.tsx의 useFonts). 경로는 이 파일 기준. */
export const FONT_FILES = {
  PretendardVariable: require('../../assets/fonts/PretendardVariable.ttf'),
  NanumMyeongjo_400Regular: require('@expo-google-fonts/nanum-myeongjo/400Regular/NanumMyeongjo_400Regular.ttf'),
  NanumMyeongjo_700Bold: require('@expo-google-fonts/nanum-myeongjo/700Bold/NanumMyeongjo_700Bold.ttf'),
};

type FontFamilyName = keyof typeof FONT_FILES;

/** 세트 목록. 값은 FONT_FILES의 이름만 쓸 수 있다(오타면 타입 에러). */
export const FONT_SETS = {
  myeongjo: {
    label: '나눔명조',
    serif: 'NanumMyeongjo_400Regular',
    serifBold: 'NanumMyeongjo_700Bold',
    sans: 'PretendardVariable',
  },
} satisfies Record<string, FontSet & { serif: FontFamilyName; serifBold: FontFamilyName; sans: FontFamilyName }>;

export type FontSetId = keyof typeof FONT_SETS;
export const FONT_SET_IDS = Object.keys(FONT_SETS) as FontSetId[];
export const DEFAULT_FONT_SET: FontSetId = 'myeongjo';

/** 모르는 id(지워진 세트 등)는 기본 세트로. */
export function getFontSet(id: string): FontSet {
  return (FONT_SETS as Record<string, FontSet>)[id] ?? FONT_SETS[DEFAULT_FONT_SET];
}
