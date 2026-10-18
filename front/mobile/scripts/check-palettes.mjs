/**
 * 팔레트 대비 검증 — 모든 팔레트 × 라이트/다크를 만들어 글자가 읽히는지(WCAG) assert로 고정.
 * 팔레트를 추가·수정하면 이걸 돌린다. 하나라도 기준 미달이면 실패한다.
 *
 * 실행: node --experimental-strip-types scripts/check-palettes.mjs
 */
import { PALETTE_IDS, getColors } from '../src/theme/palettes.ts';

// WCAG 상대 휘도 → 대비비
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [이름, 글자색, 바탕색, 최소 대비]
const checks = (c) => [
  ['placeholder/paper', c.ink.placeholder, c.paper.base, 4.5],
  ['placeholder/surface', c.ink.placeholder, c.surface.base, 4.5],
  ['secondary/paper', c.ink.secondary, c.paper.base, 4.5],
  ['onPoint/p600', c.ink.onPoint, c.point.p600, 4.5],
  ['p700/p100', c.point.p700, c.point.p100, 4.5],
  ['p600/paper', c.point.p600, c.paper.base, 4.5],
  ['ruby/paper', c.ruby.base, c.paper.base, 4.5],
  ['ruby/surface', c.ruby.base, c.surface.base, 4.5],
  ['ruby/rubySoft', c.ruby.base, c.ruby.soft, 4.5],
  ['dot(placeholder)/paper', c.ink.placeholder, c.paper.base, 3],
];

const failures = [];
const rows = [];
for (const id of PALETTE_IDS) {
  for (const mode of ['light', 'dark']) {
    const row = { palette: `${id}-${mode}` };
    for (const [name, fg, bg, min] of checks(getColors(id, mode))) {
      const r = ratio(fg, bg);
      row[name] = r.toFixed(2) + (r < min ? ' ✗' : '');
      if (r < min) failures.push(`${id}-${mode} ${name}: ${r.toFixed(2)} < ${min} (${fg} on ${bg})`);
    }
    rows.push(row);
  }
}
console.table(rows);

if (failures.length) {
  console.error('대비 미달:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('ok — 모든 팔레트 대비 통과');
