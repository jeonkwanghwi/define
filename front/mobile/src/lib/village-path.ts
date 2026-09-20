/**
 * village-path — 마을 길(노드+간선 그래프) 위를 걷는 순수 로직. 순수 함수(검증 대상).
 *
 * ⚠️ react-native를 import하지 않는다 — 노드에서 그대로 돌려 검증하기 위해서다.
 * 화면은 "어디를 눌렀다"만 넘기고, 어디로 어떻게 갈지는 전부 여기서 정한다.
 *
 * 좌표는 village-zones와 같은 0~1 비율. 다만 보드가 세로로 길면 같은 0.1이라도
 * 세로가 화면에선 더 긴 거리다 → 그대로 재면 거리가 찌그러진다.
 * aspect(= 보드 높이 / 보드 너비)를 넘기면 y를 그만큼 늘려 재서 보정한다. 기본 1 = 보정 없음.
 */
import type { Point, Zone } from '@/data/village-zones';

const DEFAULT_ASPECT = 1;

function dist(a: Point, b: Point, aspect: number): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) * aspect);
}

/** 점 p를 선분 ab에 내린 수선. t는 0~1로 자른다(선분 밖으로 나가면 끝점). */
function projectOnSegment(a: Point, b: Point, p: Point, aspect: number) {
  const abx = b.x - a.x;
  const aby = (b.y - a.y) * aspect;
  const apx = p.x - a.x;
  const apy = (p.y - a.y) * aspect;
  const len2 = abx * abx + aby * aby;
  // 길이 0인 간선은 없지만, 있어도 죽지 않게 t=0으로 떨군다.
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / len2));
  // t는 두 공간에서 같은 값이라(y 확대는 선형) 비율 좌표에 그대로 대입하면 된다.
  const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return { t, point, d: dist(point, p, aspect) };
}

/** 임의의 탭 지점을 가장 가까운 길 위로 끌어당긴다. */
export function projectToPath(
  zone: Zone,
  p: Point,
  aspect: number = DEFAULT_ASPECT,
): { point: Point; edge: [string, string]; t: number } {
  let best = { point: p, edge: zone.edges[0], t: 0, d: Infinity };
  for (const edge of zone.edges) {
    const r = projectOnSegment(zone.nodes[edge[0]], zone.nodes[edge[1]], p, aspect);
    if (r.d < best.d) best = { point: r.point, edge, t: r.t, d: r.d };
  }
  return { point: best.point, edge: best.edge, t: best.t };
}

/** 한 노드에서 모든 노드까지의 최단거리 + 직전 노드(다익스트라). 노드 수십 개라 O(n²)로 충분. */
function shortestFrom(zone: Zone, start: string, aspect: number) {
  const adj: Record<string, string[]> = {};
  for (const id of Object.keys(zone.nodes)) adj[id] = [];
  for (const [u, v] of zone.edges) {
    adj[u].push(v);
    adj[v].push(u);
  }

  const cost: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const done: Record<string, boolean> = {};
  for (const id of Object.keys(zone.nodes)) {
    cost[id] = Infinity;
    prev[id] = null;
  }
  cost[start] = 0;

  for (;;) {
    let cur: string | null = null;
    for (const id of Object.keys(cost)) {
      if (!done[id] && cost[id] < Infinity && (cur === null || cost[id] < cost[cur])) cur = id;
    }
    if (cur === null) break;
    done[cur] = true;
    for (const next of adj[cur]) {
      const c = cost[cur] + dist(zone.nodes[cur], zone.nodes[next], aspect);
      if (c < cost[next]) {
        cost[next] = c;
        prev[next] = cur;
      }
    }
  }
  return { cost, prev };
}

function nodePath(prev: Record<string, string | null>, start: string, end: string): string[] {
  const out: string[] = [];
  for (let at: string | null = end; at !== null; at = prev[at]) out.unshift(at);
  return out[0] === start ? out : [];
}

/** 연속한 같은 점을 정리한다(출발점이 이미 길 위면 투영점이 겹친다). */
function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-9);
}

/**
 * from에서 to까지 길을 따라가는 경로를 꺾은선으로 돌려준다.
 * 첫 점 = 길 위로 올라선 지점, 마지막 점 = 목적지(탭 지점을 길 위로 끌어당긴 것).
 * 중간 점들은 전부 길 위의 노드다.
 */
export function findWalkRoute(
  zone: Zone,
  from: Point,
  to: Point,
  aspect: number = DEFAULT_ASPECT,
): Point[] {
  const a = projectToPath(zone, from, aspect);
  const b = projectToPath(zone, to, aspect);

  // 같은 간선 위면 돌아갈 이유가 없다 — 바로 직선.
  if (
    (a.edge[0] === b.edge[0] && a.edge[1] === b.edge[1]) ||
    (a.edge[0] === b.edge[1] && a.edge[1] === b.edge[0])
  ) {
    return dedupe([a.point, b.point]);
  }

  // 각 투영점의 양 끝 노드를 기점으로 잡고, (출발 끝점 → 도착 끝점) 조합 중 제일 싼 걸 고른다.
  let best: { cost: number; path: string[] } | null = null;
  for (const s of a.edge) {
    const { cost, prev } = shortestFrom(zone, s, aspect);
    const head = dist(a.point, zone.nodes[s], aspect);
    for (const e of b.edge) {
      const total = head + cost[e] + dist(zone.nodes[e], b.point, aspect);
      if (!Number.isFinite(total)) continue;
      if (best === null || total < best.cost) best = { cost: total, path: nodePath(prev, s, e) };
    }
  }

  // 그래프가 끊겨 있으면(있어선 안 되는 상태) 최소한 목적지는 돌려준다.
  if (best === null) return dedupe([a.point, b.point]);

  return dedupe([a.point, ...best.path.map((id) => zone.nodes[id]), b.point]);
}

/** 슬롯(집) 문 앞까지 가는 경로. */
export function findRouteToSlot(
  zone: Zone,
  from: Point,
  slotId: string,
  aspect: number = DEFAULT_ASPECT,
): Point[] {
  const slot = zone.slots.find((s) => s.id === slotId);
  if (!slot) return [];
  return findWalkRoute(zone, from, zone.nodes[slot.door], aspect);
}
