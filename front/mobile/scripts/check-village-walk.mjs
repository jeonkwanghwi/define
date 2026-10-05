/**
 * 길 위에서 "한 걸음도 못 가고 막히는" 자리가 얼마나 되는지 센다.
 *
 * 증상: 풀과 길의 경계에서 대각선으로 가려 하면 뾰족한 데 걸린 것처럼 아예 안 움직인다.
 * 원인: 길 격자는 그림에서 뽑아낸 칸이라 가장자리가 **계단처럼 수직·수평**이다.
 * 옛 방식은 막히면 방향을 20°씩 틀어 보기만 했는데, 그 후보들은 전부 막힌 축 성분을
 * 그대로 들고 있어 수직 벽 앞에서 하나도 통과하지 못한다.
 *
 * 그래서 옛 방식(회전만)과 지금 방식(stepAlongPath = 축 버리기 + 회전)을
 * 같은 격자·같은 지점·같은 방향에 대해 돌려 막힘 수를 비교한다.
 *
 * 실행: node --experimental-strip-types scripts/check-village-walk.mjs
 */
import { ZONE_ORDER } from '../src/data/village-zones.ts';
import { WALK_GRIDS } from '../src/data/village-grid.ts';
import { isWalkable, stepAlongPath } from '../src/lib/village-path.ts';

/** village.tsx와 같은 값 */
const SPEED_X = 0.2;
const STEP = SPEED_X * (1 / 60); // 60fps 한 프레임

/** 고치기 전의 방식 — 회전만 시도했다. 비교용으로만 남긴다. */
const OLD_ANGLES = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4];
function oldStep(grid, from, dir, step, aspect) {
  for (const a of OLD_ANGLES) {
    const ux = dir.x * Math.cos(a) - dir.y * Math.sin(a);
    const uy = dir.x * Math.sin(a) + dir.y * Math.cos(a);
    const cand = { x: from.x + ux * step, y: from.y + uy * aspect * step };
    if (isWalkable(grid, cand)) return cand;
  }
  return null;
}

/** 16방향(조이스틱을 돌려가며 미는 것과 같다) */
const DIRS = Array.from({ length: 16 }, (_, i) => {
  const t = (i / 16) * Math.PI * 2;
  return { x: Math.cos(t), y: Math.sin(t) };
});

/**
 * 한 걸음의 "전진 효율" — 실제 이동이 가려던 방향으로 얼마나 나아갔나(내적, 0~1).
 * 1 = 그대로 전진, 0 = 옆으로만 미끄러짐, 음수 = 뒤로 밀림.
 * 완전 막힘(한 걸음도 못 감)은 드문데도 체감이 나쁜 이유가 여기 있다 —
 * 80°까지 틀어 통과한 후보는 전진이 cos(80°)=0.17밖에 안 된다.
 */
function advance(from, next, dir, aspect) {
  if (!next) return 0;
  const mx = next.x - from.x;
  const my = (next.y - from.y) / aspect; // 가로 기준으로 환산해 비교
  const ml = Math.hypot(mx, my);
  const dl = Math.hypot(dir.x, dir.y);
  if (ml === 0 || dl === 0) return 0;
  return (mx * dir.x + my * dir.y) / (ml * dl);
}

let sumOld = 0;
let sumNew = 0;
let badOld = 0;
let badNew = 0;
let totTry = 0;

for (const zoneId of ZONE_ORDER) {
  const grid = WALK_GRIDS[zoneId];
  const aspect = grid.cols / grid.rows;
  let so = 0, sn = 0, bo = 0, bn = 0, tries = 0;

  for (let cy = 0; cy < grid.rows; cy += 2) {
    for (let cx = 0; cx < grid.cols; cx += 2) {
      if (grid.cells[cy * grid.cols + cx] !== 1) continue;
      const from = { x: (cx + 0.5) / grid.cols, y: (cy + 0.5) / grid.rows };
      for (const d of DIRS) {
        tries += 1;
        const a1 = advance(from, oldStep(grid, from, d, STEP, aspect), d, aspect);
        const a2 = advance(from, stepAlongPath(grid, from, d, STEP, aspect), d, aspect);
        so += a1; sn += a2;
        // 0.5 미만 = 가려던 쪽으로 절반도 못 나아간 걸음. 이게 쌓이면 "걸린 느낌"이 된다.
        if (a1 < 0.5) bo += 1;
        if (a2 < 0.5) bn += 1;
      }
    }
  }

  const pc = (n) => ((n / tries) * 100).toFixed(2) + '%';
  console.log(
    `${zoneId.padEnd(7)} 평균 전진  옛 ${(so / tries).toFixed(3)} → 지금 ${(sn / tries).toFixed(3)}   ` +
      `답답한 걸음(<0.5)  옛 ${pc(bo).padStart(6)} → 지금 ${pc(bn).padStart(6)}`,
  );
  sumOld += so; sumNew += sn; badOld += bo; badNew += bn; totTry += tries;
}

const pc = (n) => ((n / totTry) * 100).toFixed(2) + '%';
console.log(
  `\n합계 ${totTry}번 — 평균 전진 ${(sumOld / totTry).toFixed(3)} → ${(sumNew / totTry).toFixed(3)}` +
    `  /  답답한 걸음 ${pc(badOld)} → ${pc(badNew)}`,
);
console.log(
  badNew < badOld
    ? `답답한 걸음 ${badOld - badNew}건 줄었다 (${(((badOld - badNew) / badOld) * 100).toFixed(1)}% 감소)`
    : '개선 없음 — 알고리즘을 다시 봐야 한다.',
);

// ─────────────────────────────────────────────────────────────
// 연속 이동 — 체감에 가장 가까운 측정.
// 한 걸음이 통과해도 다음 걸음에서 다시 걸리면 "덜컹대며 못 간다"가 된다.
// 그래서 **길 가장자리(벽에 닿은 칸)** 에서 한 방향으로 1초(60프레임) 밀어 보고,
// 가려던 방향으로 실제로 몇 %나 나아갔는지 잰다.
// ─────────────────────────────────────────────────────────────
console.log('\n── 벽을 따라 1초(60프레임) 걷기 ──');

function walk(stepFn, grid, from, dir, aspect, frames = 60) {
  let p = from;
  for (let i = 0; i < frames; i += 1) {
    const n = stepFn(grid, p, dir, STEP, aspect);
    if (!n) break;
    p = n;
  }
  const mx = p.x - from.x;
  const my = (p.y - from.y) / aspect;
  const dl = Math.hypot(dir.x, dir.y);
  // 가려던 방향으로의 전진 거리 ÷ 막힘 없이 갔을 거리
  return (mx * dir.x + my * dir.y) / dl / (STEP * frames);
}

let wOld = 0, wNew = 0, wN = 0, stallOld = 0, stallNew = 0;

for (const zoneId of ZONE_ORDER) {
  const grid = WALK_GRIDS[zoneId];
  const aspect = grid.cols / grid.rows;
  let so = 0, sn = 0, n = 0, bo = 0, bn = 0;

  for (let cy = 1; cy < grid.rows - 1; cy += 3) {
    for (let cx = 1; cx < grid.cols - 1; cx += 3) {
      if (grid.cells[cy * grid.cols + cx] !== 1) continue;
      // 벽에 닿은 칸만 — 길 한가운데는 어차피 아무 문제 없다.
      const edge =
        grid.cells[cy * grid.cols + cx - 1] !== 1 ||
        grid.cells[cy * grid.cols + cx + 1] !== 1 ||
        grid.cells[(cy - 1) * grid.cols + cx] !== 1 ||
        grid.cells[(cy + 1) * grid.cols + cx] !== 1;
      if (!edge) continue;
      const from = { x: (cx + 0.5) / grid.cols, y: (cy + 0.5) / grid.rows };
      for (const d of DIRS) {
        n += 1;
        const a = walk(oldStep, grid, from, d, aspect);
        const b = walk(stepAlongPath, grid, from, d, aspect);
        so += a; sn += b;
        if (a < 0.25) bo += 1;   // 1초 밀었는데 4분의 1도 못 간 = 사실상 갇힘
        if (b < 0.25) bn += 1;
      }
    }
  }
  const pc = (v) => ((v / n) * 100).toFixed(1) + '%';
  console.log(
    `${zoneId.padEnd(7)} 가장자리 ${String(n).padStart(6)}회  ` +
      `전진률 옛 ${pc(so).padStart(6)} → 지금 ${pc(sn).padStart(6)}   ` +
      `갇힘(<25%) 옛 ${pc(bo).padStart(6)} → 지금 ${pc(bn).padStart(6)}`,
  );
  wOld += so; wNew += sn; wN += n; stallOld += bo; stallNew += bn;
}

const pcT = (v) => ((v / wN) * 100).toFixed(1) + '%';
console.log(
  `\n합계 ${wN}회 — 전진률 ${pcT(wOld)} → ${pcT(wNew)}  /  갇힘 ${pcT(stallOld)} → ${pcT(stallNew)}`,
);
