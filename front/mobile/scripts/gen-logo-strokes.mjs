/**
 * 로고 획 미리 계산 — src/data/logo.ts → src/data/logo-strokes.generated.ts
 *
 * 인트로는 획마다 "총 길이"(stroke-dashoffset용)와 "붓끝이 지나갈 점들"이 필요하다.
 * 브라우저엔 getPointAtLength가 있지만 네이티브(react-native-svg)엔 믿고 쓸 게 없어서,
 * 여기서 한 번 재서 숫자로 박아 둔다. 의존성 없이 직접 잰다 — 경로가 M/L/C/Q/Z만 쓰기 때문.
 *
 * 사용: node --no-warnings scripts/gen-logo-strokes.mjs   (logo.ts를 고친 뒤 다시 돌릴 것)
 * Node 22.18+ 필요(.ts를 그대로 import — 타입만 지우고 실행).
 */
import fs from 'node:fs';
import { LOGO } from '../src/data/logo.ts';

const SAMPLES = 40; // 획당 붓끝 위치 샘플 수 — 화면에선 그 사이를 직선으로 잇는다
const STEPS = 64; // 곡선 한 마디를 몇 조각 직선으로 잴지(길이 정밀도)

/** 경로 → 아주 촘촘한 꺾은선(점 배열). 절대좌표 M/L/C/Q/Z만 지원(그 외면 바로 실패). */
function flatten(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g);
  const pts = [];
  let i = 0;
  let cmd = '';
  let cur = [0, 0];
  let start = [0, 0];
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      start = cur;
      pts.push({ p: cur, move: true });
      cmd = 'L'; // M 뒤에 이어지는 좌표는 L로 취급(SVG 규칙)
    } else if (cmd === 'L') {
      cur = [num(), num()];
      pts.push({ p: cur });
    } else if (cmd === 'C' || cmd === 'Q') {
      const c = cmd === 'C' ? [[num(), num()], [num(), num()]] : [[num(), num()]];
      const end = [num(), num()];
      const p0 = cur;
      for (let s = 1; s <= STEPS; s++) {
        const t = s / STEPS;
        const u = 1 - t;
        const [x, y] =
          cmd === 'C'
            ? [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * c[0][k] + 3 * u * t * t * c[1][k] + t * t * t * end[k])
            : [0, 1].map((k) => u * u * p0[k] + 2 * u * t * c[0][k] + t * t * end[k]);
        pts.push({ p: [x, y] });
      }
      cur = end;
    } else if (cmd === 'Z') {
      cur = start;
      pts.push({ p: cur });
      cmd = '';
    } else {
      throw new Error(`지원하지 않는 경로 명령 "${cmd}" — ${d.slice(0, 40)}…`);
    }
  }
  return pts;
}

/** 꺾은선의 총 길이 + 길이 기준으로 고르게 뽑은 점 SAMPLES개(dashoffset과 같은 기준이라 붓끝이 먹 끝에 붙는다). */
function measure(d) {
  const pts = flatten(d).map((x) => x.p);
  const acc = [0];
  for (let k = 1; k < pts.length; k++) {
    acc.push(acc[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const len = acc[acc.length - 1];
  const out = [];
  let k = 1;
  for (let s = 0; s < SAMPLES; s++) {
    const target = (len * s) / (SAMPLES - 1);
    while (k < acc.length - 1 && acc[k] < target) k++;
    const seg = acc[k] - acc[k - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - acc[k - 1]) / seg));
    out.push(+(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f).toFixed(2));
    out.push(+(pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f).toFixed(2));
  }
  return { len: +len.toFixed(2), pts: out };
}

// 검산: 길이 10짜리 직선, 반지름 10 반원(큐빅 근사 ≈ 31.4)
const line = measure('M0,0 L10,0');
console.assert(Math.abs(line.len - 10) < 1e-9 && line.pts.length === SAMPLES * 2, '직선 길이');
const arc = measure('M0,0 C0,13.33 20,13.33 20,0');
console.assert(Math.abs(arc.len - 31.4) < 0.6, `곡선 길이 ${arc.len}`);

const strokes = LOGO.letters.map((l) => l.strokes.map((s) => measure(s.d)));

// viewBox — 글자 윤곽 + 마침표를 딱 감싸는 상자(+여백 2). 헤더 로고가 쓸데없는 여백 없이 앉게.
const all = LOGO.letters.flatMap((l) => flatten(l.d).map((x) => x.p));
const { cx, cy, r } = LOGO.dot;
all.push([cx - r, cy - r], [cx + r, cy + r]);
const xs = all.map((p) => p[0]);
const ys = all.map((p) => p[1]);
const pad = 2;
const x0 = Math.floor(Math.min(...xs) - pad);
const y0 = Math.floor(Math.min(...ys) - pad);
const viewBox = {
  x: x0,
  y: y0,
  w: Math.ceil(Math.max(...xs) + pad) - x0,
  h: Math.ceil(Math.max(...ys) + pad) - y0,
};

const file = `// 자동 생성 — 직접 고치지 말 것. node scripts/gen-logo-strokes.mjs 로 다시 만든다.
// 원본: src/data/logo.ts. len = 획 총 길이, pts = 길이 기준 균등 샘플 [x0,y0,x1,y1,…] (${SAMPLES}점).
export const LOGO_STROKES: { len: number; pts: number[] }[][] = ${JSON.stringify(strokes)};

/** 글자+마침표를 감싸는 상자. 헤더 로고와 인트로가 같은 viewBox를 써야 착지가 딱 맞는다. */
export const LOGO_VIEWBOX = ${JSON.stringify(viewBox)};
`;
const outPath = new URL('../src/data/logo-strokes.generated.ts', import.meta.url);
fs.writeFileSync(outPath, file);
console.log('생성:', outPath.pathname, 'viewBox', viewBox, '획 길이', strokes.map((l) => l.map((s) => s.len)));
