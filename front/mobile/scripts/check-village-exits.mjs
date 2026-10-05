/**
 * 마을 맵 전환이 되돌이표에 빠지지 않는지 검사한다.
 *
 * 증상: 중앙 → 동쪽으로 넘어가면 화면은 바뀌는데, 거기서 조금만 움직이면
 * 다시 중앙 → 동쪽 → 중앙 … 이 끝없이 반복된다.
 *
 * 원인은 기하다. 전환하면 `entryPoint()`가 **목적지 맵에서 되돌아가는 출구 좌표 그 자리**에
 * 아바타를 세운다. 그 자리는 출구와 거리가 0이라 EXIT_RADIUS 안이고,
 * village.tsx의 이동 루프는 움직일 때마다 출구 반경을 검사하므로 즉시 되돌아간다.
 *
 * 그래서 이 스크립트는 "착지 지점이 출구 반경 안인가"를 전 조합에 대해 센다.
 * 안이어도 괜찮다 — **village.tsx가 들어온 출구를 벗어날 때까지 재전환을 잠근다면.**
 * 여기서는 기하 사실만 보고하고, 잠금이 없으면 루프가 난다는 걸 드러낸다.
 *
 * 실행: node --experimental-strip-types scripts/check-village-exits.mjs
 */
import { ZONES, ZONE_ORDER, entryPoint } from '../src/data/village-zones.ts';
import { WALK_GRIDS } from '../src/data/village-grid.ts';
import { snapToPath } from '../src/lib/village-path.ts';

/** village.tsx와 같은 값이어야 한다. 바뀌면 여기도 바꾼다. */
const EXIT_RADIUS = 0.035;

let trapped = 0;
let total = 0;

for (const from of ZONE_ORDER) {
  for (const exit of ZONES[from].exits) {
    const to = exit.to;
    total += 1;

    // village.tsx의 switchZone()이 하는 그대로
    const entry = entryPoint(from, to);
    const landing = snapToPath(WALK_GRIDS[to], entry) ?? entry;

    // 거리 비교도 이동 루프와 같은 방식(세로를 가로 기준으로 환산)
    const grid = WALK_GRIDS[to];
    const aspect = grid.cols / grid.rows;
    const dist = (a) => Math.hypot(a.x - landing.x, (a.y - landing.y) * aspect);

    const hits = ZONES[to].exits.filter((e) => dist(e.at) <= EXIT_RADIUS);
    const back = hits.find((e) => e.to === from);

    if (hits.length > 0) {
      trapped += 1;
      const detail = hits
        .map((e) => `${e.dir}→${e.to} (거리 ${dist(e.at).toFixed(4)})`)
        .join(', ');
      console.log(
        `TRAP  ${from} —${exit.dir}→ ${to}: 착지 자리가 출구 반경(${EXIT_RADIUS}) 안 — ${detail}` +
          (back ? '  ※ 되돌아가는 출구라 바로 루프가 된다' : ''),
      );
    } else {
      console.log(`OK    ${from} —${exit.dir}→ ${to}: 착지 자리가 모든 출구 밖`);
    }
  }
}

console.log(
  `\n전환 ${total}개 중 ${trapped}개가 착지 즉시 출구 반경 안에 선다.` +
    (trapped
      ? '\n→ village.tsx가 "들어온 출구를 벗어나기 전까지 재전환 금지"를 하지 않으면 무한 전환이 난다.'
      : ''),
);
