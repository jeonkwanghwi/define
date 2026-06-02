/**
 * define 디자인 토큰 — 컬러.
 *
 * tokens.css(design-source)의 라이트/다크 변수를 RN 객체로 옮긴 것.
 * 같은 키 모양(shape)을 가진 두 페어:
 *   - lightColors: warm paper + ink typography (기본)
 *   - darkColors:  warm charcoal + off-white ink (밤 사용 1급 시민)
 *
 * 컴포넌트는 useTheme()으로 받은 theme.colors.X를 참조하므로,
 * 라이트/다크를 신경 쓰지 않고 "의미"만 쓰면 된다 (예: ink.primary, paper.base).
 *
 * 포인트 색의 다크 모드 값은 색대비 위해 라이트보다 밝게 조정됨
 * (원래 CSS color-mix(pt 60% + white 40%) 등을 미리 계산해서 박은 값).
 */

// 색 shape를 명시적으로 정의 — 라이트/다크가 같은 키를 가지도록 강제하고
// (`as const`로 잡힌 hex literal이 양쪽 충돌하는 것을 막음)
export type Colors = {
  paper: { base: string; recessed: string };
  surface: { base: string; nested: string };
  ink: { primary: string; strong: string; secondary: string; placeholder: string };
  line: { base: string; strong: string };
  point: { p700: string; p600: string; p500: string; p300: string; p100: string; p050: string };
  ruby: { base: string; soft: string };
};

// ---- Light theme: warm paper + ink ----
export const lightColors: Colors = {
  paper: {
    base: '#FCFAF6', // 페이지 배경 — 가장 따뜻한 톤
    recessed: '#F5EFE6', // 안쪽 영역 (살짝 깊은 느낌)
  },
  surface: {
    base: '#FFFEFB', // 카드 표면
    nested: '#FBF7F1', // 카드 안의 또 다른 영역
  },
  ink: {
    primary: '#211E1A', // 본문 텍스트 — 따뜻한 거의 검정
    strong: '#423D36',
    secondary: '#5C564D', // 2차 정보
    placeholder: '#918A7D', // 3차/플레이스홀더
  },
  line: {
    base: '#EAE3D7', // 헤어라인 보더 (따뜻한 톤)
    strong: '#DDD4C5',
  },
  // 포인트 색 — 슬로건 "각자의 정의"를 상징하는 단일 포인트 (딥 인디고 #2E3192)
  point: {
    p700: '#252775', // 80% pt + 20% black
    p600: '#2E3192', // base
    p500: '#6062AC', // 76% pt + 24% white
    p300: '#AFB1D5',
    p100: '#E4E4F1',
    p050: '#F2F2F8',
  },
  // 루비 (재화) — 포인트와 명확히 구분된 별도 액센트
  ruby: {
    base: '#D6456A',
    soft: '#FBE6EC',
  },
};

// ---- Dark theme: warm charcoal + off-white ----
export const darkColors: Colors = {
  paper: {
    base: '#1A1815', // warm charcoal
    recessed: '#211E1A',
  },
  surface: {
    base: '#262320',
    nested: '#2E2A26',
  },
  ink: {
    primary: '#EFEAE0', // warm off-white
    strong: '#CFC8BB',
    secondary: '#A59E90',
    placeholder: '#7C7568',
  },
  line: {
    base: '#38332C',
    strong: '#463F36',
  },
  // 다크에서는 흰색을 섞어 가독성 확보 (라이트의 p값과 의미적으로 같지만 hex 다름)
  point: {
    p700: '#6D6FB3', // 70% pt + 30% white
    p600: '#9294C6', // 52% pt + 48% white
    p500: '#8284BE',
    p300: '#1C1D58', // 어둠 강조용 (다크에서는 black mix)
    p100: '#111337',
    p050: '#0C0D26',
  },
  ruby: {
    base: '#EE85A0',
    soft: '#3A2730',
  },
};
