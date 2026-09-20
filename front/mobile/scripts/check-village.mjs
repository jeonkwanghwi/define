/**
 * 마을 데이터 검증 — 집·출구가 길 위에 있고, 서로 걸어서 오갈 수 있는지 확인한다.
 *
 * 손으로 찍은 좌표가 길을 벗어나 있어도 화면은 멀쩡해 보인다(그때 아바타만 밭을 가로지른다).
 * 그래서 눈이 아니라 격자로 검사한다. 배경 그림이나 좌표를 바꾸면 이걸 돌릴 것.
 *
 * 실행: node --experimental-strip-types scripts/check-village.mjs
 */
import { ZONES, ZONE_ORDER, entryPoint } from '../src/data/village-zones.ts';
import { WALK_GRIDS } from '../src/data/village-grid.ts';
import { findWalkRoute, isWalkable, snapToPath } from '../src/lib/village-path.ts';

let fails = 0;
const ok = (label, cond, detail = '') => {
  if (!cond) fails += 1;
  console.log(`${cond ? 'PASS ' : 'FAIL '} ${label}${detail ? `  — ${detail}` : ''}`);
};

for (const zoneId of ZONE_ORDER) {
  const zone = ZONES[zoneId];
  const grid = WALK_GRIDS[zoneId];
  const cellPx = 1 / grid.cols;

  // 1) 집 문·출구·시작 지점이 길 위(또는 코앞)인가
  const marks = [
    ...zone.slots.map((s) => [`집 ${s.id}`, s.door]),
    ...zone.exits.map((e) => [`출구 ${e.dir}→${e.to}`, e.at]),
    ['시작 지점', zone.spawn],
  ];
  const offs = [];
  for (const [name, p] of marks) {
    const snapped = snapToPath(grid, p);
    if (!snapped) { offs.push(`${name}(길 없음)`); continue; }
    const d = Math.hypot(snapped.x - p.x, snapped.y - p.y) / cellPx;
    if (d > 2.5) offs.push(`${name}(${d.toFixed(1)}칸)`);
  }
  ok(`[${zoneId}] 집·출구 ${marks.length}곳이 길 위`, offs.length === 0, offs.join(', '));

  // 2) 서로 걸어서 오갈 수 있는가 (모든 조합)
  let unreachable = 0;
  let worstOff = 0;
  let segments = 0;
  for (let i = 0; i < marks.length; i += 1) {
    for (let j = i + 1; j < marks.length; j += 1) {
      const route = findWalkRoute(grid, marks[i][1], marks[j][1]);
      if (route.length === 0) { unreachable += 1; continue; }
      // 3) 경로가 길 위에 있는가. 칸 경계를 스치는 정도(1칸 이내)는 허용하고,
      //    길에서 멀어진 만큼(칸 수)을 재서 최악값을 본다 — 밭을 가로지르면 여기서 잡힌다.
      const off = (p) => {
        if (isWalkable(grid, p)) return 0;
        const s = snapToPath(grid, p);
        return s ? Math.hypot(s.x - p.x, s.y - p.y) / cellPx : Infinity;
      };
      for (const p of route) worstOff = Math.max(worstOff, off(p));
      for (let k = 1; k < route.length; k += 1) {
        segments += 1;
        const a = route[k - 1];
        const b = route[k];
        const steps = Math.ceil(Math.hypot((b.x - a.x) * grid.cols, (b.y - a.y) * grid.rows) * 3);
        for (let t = 0; t <= steps; t += 1) {
          worstOff = Math.max(worstOff, off({ x: a.x + ((b.x - a.x) * t) / steps, y: a.y + ((b.y - a.y) * t) / steps }));
        }
      }
    }
  }
  const pairs = (marks.length * (marks.length - 1)) / 2;
  ok(`[${zoneId}] ${pairs}쌍 전부 걸어서 도달`, unreachable === 0, `실패 ${unreachable}쌍`);
  // 허용치는 원본 그림 기준 약 10px — 칸이 잘아질수록 칸 수로는 커지므로 px로 환산해 잰다.
  const allow = (10 * grid.cols) / 848;
  ok(
    `[${zoneId}] 경로 ${segments}구간이 길 위`,
    worstOff <= allow,
    `길에서 최대 ${worstOff.toFixed(2)}칸(허용 ${allow.toFixed(1)})`,
  );
}

// 4) 맵 전환으로 들어간 자리가 길 위인가
const bad = [];
for (const from of ZONE_ORDER) {
  for (const exit of ZONES[from].exits) {
    const p = entryPoint(from, exit.to);
    const snapped = snapToPath(WALK_GRIDS[exit.to], p);
    const cell = 1 / WALK_GRIDS[exit.to].cols;
    if (!snapped || Math.hypot(snapped.x - p.x, snapped.y - p.y) / cell > 2) bad.push(`${from}→${exit.to}`);
  }
}
ok('맵 전환 도착 지점이 길 위', bad.length === 0, bad.join(', '));

console.log(fails === 0 ? '\n✅ 전부 통과' : `\n❌ 실패 ${fails}건`);
process.exit(fails === 0 ? 0 : 1);
