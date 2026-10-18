/**
 * define 팔레트 — 포인트 색 하나 + 중성 계열 + 경고색, 이 세 값(spec)에서 색 전체를 만든다.
 *
 * 전에는 colors.ts에 라이트/다크 색 60여 개를 손으로 박았다. 포인트 색 하나를 바꾸려면
 * p700~p050·다크 값·그림자까지 따로 계산해 고쳐야 했다.
 * 이제는 **아래 PALETTES의 spec 한 줄(또는 DEFAULT_PALETTE)만 바꾸면** 앱 전체가 따라온다.
 *
 * 사용자가 마이페이지 "테마"에서 고른 팔레트가 settings-store(palette)에 저장되고,
 * useTheme()가 getColors(palette, mode)로 색을 받아 쓴다.
 *
 * 대비 검증: node --experimental-strip-types scripts/check-palettes.mjs
 */
import type { Colors } from './colors';

export type PaletteId = 'amber' | 'wine' | 'slate' | 'prussian' | 'cobalt' | 'ink';

type Neutral = 'warm' | 'cool' | 'mono';

export type PaletteSpec = {
  /** 포인트(p600, 라이트 기준) */
  point: string;
  /** 종이·글자 계열 — 포인트 색조에 맞춰 따뜻한/차가운/무채 */
  neutral: Neutral;
  /** 경고·재화(ruby.base, 라이트 기준) */
  alarm: string;
};

/** 피커에 나오는 순서 그대로. */
export const PALETTES: Record<PaletteId, { label: string; spec: PaletteSpec }> = {
  amber: { label: '호박', spec: { point: '#8A5A1E', neutral: 'warm', alarm: '#B23A2E' } },
  wine: { label: '와인', spec: { point: '#6E2A3F', neutral: 'warm', alarm: '#9C3A2C' } },
  slate: { label: '쪽빛', spec: { point: '#2F4E6B', neutral: 'cool', alarm: '#B4372B' } },
  prussian: { label: '프러시안', spec: { point: '#1D566E', neutral: 'cool', alarm: '#B4372B' } },
  cobalt: { label: '코발트', spec: { point: '#2446B4', neutral: 'cool', alarm: '#B4372B' } },
  ink: { label: '먹', spec: { point: '#1F1E1C', neutral: 'mono', alarm: '#B03A32' } },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

/** 처음 설치한 사람이 보는 팔레트. */
export const DEFAULT_PALETTE: PaletteId = 'amber';

type Mode = 'light' | 'dark';

// 포인트·경고를 뺀 나머지(종이·글자·선). 계열마다 라이트/다크 한 벌씩.
type NeutralSet = Pick<Colors, 'paper' | 'surface' | 'line'> & {
  ink: Pick<Colors['ink'], 'primary' | 'strong' | 'secondary' | 'placeholder'>;
};

const NEUTRALS: Record<Neutral, Record<Mode, NeutralSet>> = {
  warm: {
    light: {
      paper: { base: '#FAF8F4', recessed: '#F2EEE7' },
      surface: { base: '#FFFEFB', nested: '#F6F3EE' },
      ink: { primary: '#201E1B', strong: '#3E3A35', secondary: '#58534C', placeholder: '#6E685F' },
      line: { base: '#E6E1D8', strong: '#D8D2C7' },
    },
    dark: {
      paper: { base: '#181614', recessed: '#1F1C19' },
      surface: { base: '#24211E', nested: '#2C2925' },
      ink: { primary: '#EEEAE3', strong: '#CEC8BE', secondary: '#A49E94', placeholder: '#948E84' },
      line: { base: '#36322D', strong: '#443F39' },
    },
  },
  cool: {
    light: {
      paper: { base: '#F6F7F7', recessed: '#EDEFF0' },
      surface: { base: '#FEFEFE', nested: '#F1F3F4' },
      ink: { primary: '#1C2024', strong: '#383E44', secondary: '#525A61', placeholder: '#69717A' },
      line: { base: '#E0E4E6', strong: '#D2D7DA' },
    },
    dark: {
      paper: { base: '#141719', recessed: '#1A1D20' },
      surface: { base: '#1F2326', nested: '#262B2F' },
      ink: { primary: '#E8EBED', strong: '#C6CCD1', secondary: '#99A2A9', placeholder: '#89929A' },
      line: { base: '#30363B', strong: '#3B4248' },
    },
  },
  mono: {
    light: {
      paper: { base: '#F8F7F4', recessed: '#EFEDE8' },
      surface: { base: '#FEFEFC', nested: '#F4F3EF' },
      ink: { primary: '#1A1A18', strong: '#383733', secondary: '#55534E', placeholder: '#6D6B65' },
      line: { base: '#E4E2DC', strong: '#D4D1CA' },
    },
    dark: {
      paper: { base: '#141413', recessed: '#1A1A18' },
      surface: { base: '#201F1D', nested: '#282725' },
      ink: { primary: '#EDECE8', strong: '#CCCAC4', secondary: '#A3A09A', placeholder: '#918E88' },
      line: { base: '#34322F', strong: '#403E3A' },
    },
  },
};

// 먹(mono)은 포인트 = 글자색이라 섞어서 만들면 단계가 뭉개진다 → 눈으로 맞춘 값을 박는다.
const MONO_POINT: Record<Mode, Colors['point']> = {
  light: { p700: '#1A1A18', p600: '#1F1E1C', p500: '#4A4844', p300: '#B9B6AE', p100: '#E8E6E0', p050: '#F1EFEA' },
  dark: { p700: '#F2F0EB', p600: '#E8E6E0', p500: '#B8B5AE', p300: '#4A4844', p100: '#33312E', p050: '#2B2A27' },
};

/** 두 hex 색을 섞는다. t=0이면 a, t=1이면 b (sRGB에서 직선으로). */
export function mix(a: string, b: string, t: number): string {
  const ca = parseInt(a.slice(1), 16);
  const cb = parseInt(b.slice(1), 16);
  let out = '#';
  for (const shift of [16, 8, 0]) {
    const x = (ca >> shift) & 255;
    const y = (cb >> shift) & 255;
    out += Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  }
  return out.toUpperCase();
}

/** spec 하나 + 모드 → 앱이 쓰는 색 전체. 순수 함수(같은 입력이면 같은 결과). */
export function buildColors(spec: PaletteSpec, mode: Mode): Colors {
  const n = NEUTRALS[spec.neutral][mode];
  const { point, alarm } = spec;

  if (mode === 'light') {
    return {
      ...n,
      ink: { ...n.ink, onPoint: spec.neutral === 'mono' ? n.paper.base : '#FFFFFF', onRuby: '#FFFFFF' },
      point:
        spec.neutral === 'mono'
          ? MONO_POINT.light
          : {
              p700: mix(point, '#000000', 0.2),
              p600: point,
              p500: mix(point, '#FFFFFF', 0.3),
              p300: mix(point, '#FFFFFF', 0.62),
              p100: mix(point, n.surface.base, 0.88),
              p050: mix(point, n.surface.base, 0.94),
            },
      ruby: { base: alarm, soft: mix(alarm, n.surface.base, 0.93) },
      scrim: 'rgba(20,18,15,0.45)',
    };
  }

  // 다크: 어두운 바탕 위라 흰색을 섞어 밝힌다. 밝아진 포인트·루비 위 글자는 페이지 바탕색으로.
  return {
    ...n,
    ink: { ...n.ink, onPoint: n.paper.base, onRuby: n.paper.base },
    point:
      spec.neutral === 'mono'
        ? MONO_POINT.dark
        : {
            p700: mix(point, '#FFFFFF', 0.68),
            p600: mix(point, '#FFFFFF', 0.5),
            p500: mix(point, '#FFFFFF', 0.4),
            p300: mix(point, n.surface.nested, 0.55),
            p100: mix(point, n.surface.nested, 0.72),
            p050: mix(point, n.surface.nested, 0.8),
          },
    ruby: { base: mix(alarm, '#FFFFFF', 0.45), soft: mix(alarm, n.surface.nested, 0.8) },
    scrim: 'rgba(0,0,0,0.6)',
  };
}

// 팔레트 × 모드는 12가지뿐이고 결과가 안 변한다 → 한 번 만들어 두고 같은 객체를 돌려준다.
// (같은 객체여야 렌더마다 새 색 객체가 생겨 화면이 쓸데없이 다시 그려지는 일이 없다)
const cache: Partial<Record<string, Colors>> = {};

export function getColors(id: PaletteId, mode: Mode): Colors {
  const key = `${id}-${mode}`;
  return (cache[key] ??= buildColors((PALETTES[id] ?? PALETTES[DEFAULT_PALETTE]).spec, mode));
}
