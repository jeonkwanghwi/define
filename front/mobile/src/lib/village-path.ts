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
