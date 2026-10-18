/**
 * define 디자인 토큰 — 컬러의 **모양(Colors 타입)**.
 *
 * 실제 색 값은 palettes.ts가 만든다: 팔레트 spec(포인트·중성 계열·경고색) + 라이트/다크 →
 * buildColors()가 아래 모양의 객체 하나를 돌려준다. 포인트 색을 바꾸려면 palettes.ts만 보면 된다.
 *
 * 컴포넌트는 useTheme()으로 받은 theme.colors.X를 참조하므로,
 * 라이트/다크·팔레트를 신경 쓰지 않고 "의미"만 쓰면 된다 (예: ink.primary, paper.base).
 */

// 색 shape를 명시적으로 정의 — 모든 팔레트·모드가 같은 키를 가지도록 강제
export type Colors = {
  paper: { base: string; recessed: string };
  surface: { base: string; nested: string };
  ink: {
    primary: string;
    strong: string;
    secondary: string;
    placeholder: string;
    /** 포인트(p600) 바탕 위의 글자·아이콘. 다크의 p600은 밝아서 흰 글자가 안 읽힌다(2.9:1). */
    onPoint: string;
    /** 루비(ruby.base) 바탕 위의 글자. onPoint와 같은 이유로 다크에선 어두운 잉크. */
    onRuby: string;
  };
  line: { base: string; strong: string };
  point: { p700: string; p600: string; p500: string; p300: string; p100: string; p050: string };
  ruby: { base: string; soft: string };
  /** 모달/시트 뒤 어둡게 덮는 배경(반투명). 라이트=웜 차콜, 다크=더 진하게. */
  scrim: string;
};
