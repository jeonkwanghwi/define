/**
 * village-path — 길 격자 위에서 걷는 길을 찾는다. 순수 로직(노드에서 그대로 검증 가능).
 *
 * 격자는 배경 그림에서 뽑아낸 "걸을 수 있는 칸"(village-grid.ts)이다. 여기서 A*로 칸을 따라간 뒤,
 * 계단처럼 꺾이는 칸 경로를 **보이는 선으로 펴서**(string pulling) 자연스러운 꺾은선으로 만든다.
 *
 * ⚠️ react-native를 import하지 않는다 — 검증 스크립트가 노드에서 이 파일을 그대로 돌린다.
 */
import type { WalkGrid } from '@/data/village-grid';
import type { Point } from '@/data/village-zones';

/** 비율좌표 → 칸 좌표. */
const toCell = (g: WalkGrid, p: Point) => ({
  cx: Math.min(g.cols - 1, Math.max(0, Math.round(p.x * g.cols - 0.5))),
  cy: Math.min(g.rows - 1, Math.max(0, Math.round(p.y * g.rows - 0.5))),
});

/** 칸 좌표 → 비율좌표(칸 한가운데). */
const toPoint = (g: WalkGrid, cx: number, cy: number): Point => ({
  x: (cx + 0.5) / g.cols,
  y: (cy + 0.5) / g.rows,
});

const walkable = (g: WalkGrid, cx: number, cy: number) =>
  cx >= 0 && cy >= 0 && cx < g.cols && cy < g.rows && g.cells[cy * g.cols + cx] === 1;

export function isWalkable(grid: WalkGrid, p: Point): boolean {
  const { cx, cy } = toCell(grid, p);
  return walkable(grid, cx, cy);
}

/** 가장 가까운 걸을 수 있는 칸. 멀리까지 없으면 null(맵 밖을 눌렀을 때). */
export function snapToPath(grid: WalkGrid, p: Point, maxRing = 14): Point | null {
  const { cx, cy } = toCell(grid, p);
  if (walkable(grid, cx, cy)) return toPoint(grid, cx, cy);
  for (let r = 1; r <= maxRing; r += 1) {
    let best: { d: number; x: number; y: number } | null = null;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!walkable(grid, cx + dx, cy + dy)) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { d, x: cx + dx, y: cy + dy };
      }
    }
    if (best) return toPoint(grid, best.x, best.y);
  }
  return null;
}

/** 두 칸 사이가 전부 걸을 수 있는 칸인지(선을 따라 훑는다). 경로 펴기에 쓴다. */
function clearLine(g: WalkGrid, a: { cx: number; cy: number }, b: { cx: number; cy: number }) {
  // 칸 단위로만 훑으면 모서리를 대각으로 스쳐 지나가는 선을 놓친다 → 두 배로 촘촘히.
  const steps = Math.max(Math.abs(b.cx - a.cx), Math.abs(b.cy - a.cy)) * 4;
  if (steps === 0) return true;
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(a.cx + ((b.cx - a.cx) * i) / steps);
    const y = Math.round(a.cy + ((b.cy - a.cy) * i) / steps);
    if (!walkable(g, x, y)) return false;
  }
  return true;
}

const H = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/**
 * 격자 위 A*. 대각선 이동은 양옆 칸이 모두 열려 있을 때만 허용한다(모서리 뚫기 방지).
 * 반환은 칸 목록. 길이 없으면 null.
 */
function astar(g: WalkGrid, start: { cx: number; cy: number }, goal: { cx: number; cy: number }) {
  const n = g.cols * g.rows;
  const idx = (x: number, y: number) => y * g.cols + x;
  const gScore = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const s = idx(start.cx, start.cy);
  const t = idx(goal.cx, goal.cy);
  gScore[s] = 0;

  // 작은 이진 힙
  const heap: [number, number][] = [[H(start.cx, start.cy, goal.cx, goal.cy), s]];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop() as [number, number];
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };

  while (heap.length) {
    const [, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === t) break;
    const x = i % g.cols;
    const y = (i / g.cols) | 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!walkable(g, nx, ny)) continue;
        // 대각선은 두 직교 칸이 모두 열려 있어야 — 집 모서리를 스쳐 지나가지 않게.
        if (dx && dy && (!walkable(g, x + dx, y) || !walkable(g, x, y + dy))) continue;
        const j = idx(nx, ny);
        if (done[j]) continue;
        const step = dx && dy ? 1.414 : 1;
        const ng = gScore[i] + step;
        if (ng < gScore[j]) {
          gScore[j] = ng;
          prev[j] = i;
          push(ng + H(nx, ny, goal.cx, goal.cy), j);
        }
      }
    }
  }
  if (!done[t]) return null;

  const cells: { cx: number; cy: number }[] = [];
  for (let i = t; i !== -1; i = prev[i]) cells.push({ cx: i % g.cols, cy: (i / g.cols) | 0 });
  return cells.reverse();
}

/**
 * from에서 to까지 길을 따라가는 꺾은선(비율좌표).
 * 첫 점은 출발 지점을 길 위로 끌어올린 자리, 마지막 점은 목적지(길 위로 스냅됨).
 * 길이 없거나 맵 밖이면 빈 배열.
 */
export function findWalkRoute(grid: WalkGrid, from: Point, to: Point): Point[] {
  const a = snapToPath(grid, from);
  const b = snapToPath(grid, to);
  if (!a || !b) return [];
  const start = toCell(grid, a);
  const goal = toCell(grid, b);
  if (start.cx === goal.cx && start.cy === goal.cy) return [a];

  const cells = astar(grid, start, goal);
  if (!cells) return [];

  // 계단 모양을 편다: 지금 점에서 "곧장 갈 수 있는 가장 먼 칸"까지 한 번에 잇는다.
  const out: Point[] = [toPoint(grid, cells[0].cx, cells[0].cy)];
  let anchor = 0;
  for (let i = 2; i < cells.length; i += 1) {
    if (clearLine(grid, cells[anchor], cells[i])) continue;
    out.push(toPoint(grid, cells[i - 1].cx, cells[i - 1].cy));
    anchor = i - 1;
  }
  out.push(toPoint(grid, cells[cells.length - 1].cx, cells[cells.length - 1].cy));
  return out;
}

/**
 * 막혔을 때 틀어 볼 각도(라디안). ±10°씩 ±90°까지 — 촘촘해야 벽을 부드럽게 탄다.
 * 성기면(±20°·±40°…) 매 프레임 다른 후보가 뽑혀 지그재그로 끌린다.
 */
const SLIDE_ANGLES = (() => {
  const out: number[] = [];
  for (let deg = 10; deg <= 90; deg += 10) {
    out.push((deg * Math.PI) / 180, (-deg * Math.PI) / 180);
  }
  return out;
})();

/**
 * 한 걸음 — 가려는 방향으로 나아가되, 막히면 **벽을 따라 미끄러진다**. 갈 곳이 없으면 null.
 *
 * 두 가지가 핵심이다.
 *
 * **① 통과하는 후보 중 "가장 많이 전진하는 것"을 고른다.** 먼저 통과한 걸 그냥 쓰면
 * 후보 순서가 곧 품질이 되어, 같은 벽을 타는 동안에도 프레임마다 다른 각도가 뽑힌다.
 * 그게 뾰족한 데 걸려 덜컹대는 느낌의 정체다. 전부 재보고 최선을 고르면 매 프레임 일관된다
 * (후보는 20개 남짓이라 비용은 무시할 수준).
 *
 * **② 축을 통째로 버리는 후보를 함께 둔다.** 길 격자는 그림에서 뽑아낸 칸이라 가장자리가
 * 계단처럼 수직·수평으로 각져 있다. 그런 벽 앞에서는 "막힌 축을 버리고 나머지 축으로만 간다"가
 * 정확히 맞는 답인데, 각도를 틀어 보는 후보만으로는 그 답에 닿지 못한다.
 * 남은 축의 크기는 len으로 되돌려 **속도를 보존한다** — 안 그러면 벽에 닿을 때마다 느려진다.
 *
 * @param dir   조이스틱 방향(각 성분 -1~1, 길이가 곧 세기)
 * @param step  이번 프레임에 갈 거리(가로 기준 비율)
 * @param aspect 세로 보정(grid.cols / grid.rows) — 그림이 길쭉해 같은 비율이라도 실제 거리가 다르다
 */
export function stepAlongPath(
  grid: WalkGrid,
  from: Point,
  dir: Point,
  step: number,
  aspect: number,
): Point | null {
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return null;

  const at = (ux: number, uy: number): Point => ({
    x: from.x + ux * step,
    y: from.y + uy * aspect * step,
  });

  // 가려던 그대로 갈 수 있으면 그게 언제나 최선이다 — 나머지를 재볼 것도 없다.
  const straight = at(dir.x, dir.y);
  if (isWalkable(grid, straight)) return straight;

  // 후보: 조금씩 튼 방향들 + 축을 버린 둘.
  const moves: Point[] = SLIDE_ANGLES.map((a) => ({
    x: dir.x * Math.cos(a) - dir.y * Math.sin(a),
    y: dir.x * Math.sin(a) + dir.y * Math.cos(a),
  }));
  if (dir.x !== 0) moves.push({ x: Math.sign(dir.x) * len, y: 0 });
  if (dir.y !== 0) moves.push({ x: 0, y: Math.sign(dir.y) * len });

  let best: Point | null = null;
  let bestScore = 0; // 0 이하(옆걸음·뒷걸음)는 아예 쓰지 않는다 — 가려던 쪽으로 가야 걸음이다.
  for (const m of moves) {
    const cand = at(m.x, m.y);
    if (!isWalkable(grid, cand)) continue;
    // 가려던 방향으로 얼마나 나아갔나(내적). 세로는 가로 기준으로 환산해 비교한다.
    const ml = Math.hypot(m.x, m.y);
    if (ml === 0) continue;
    const score = (m.x * dir.x + m.y * dir.y) / (ml * len);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}
