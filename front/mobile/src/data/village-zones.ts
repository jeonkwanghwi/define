/**
 * 마을 맵 5개의 정적 정의 — 중앙 + 동(봄)·남(여름)·서(가을)·북(겨울).
 *
 * ⚠️ village-mock.ts와 같은 "월드 데이터" 층이다. 렌더링 방식과 무관하게 살아남는다.
 * 좌표는 전부 0~1 비율 — 렌더러가 보드 픽셀 크기에 곱해 환산한다(해상도 독립).
 *
 * 길은 이미지가 아니라 노드+간선 그래프다. 배경 그림을 갈아도 좌표만 다시 찍으면 되고,
 * 걷기 판정이 픽셀을 읽지 않아 가볍고 결정적이다. (설계: docs/superpowers/specs/2026-09-20-village-v1-design.md)
 *
 * ⚠️ 지금 좌표는 전부 **임시값**이다. 진짜 배경 그림이 나오면 그림을 보고 다시 찍는다.
 * 배경 이미지 require(...)도 아직 여기 없다 — 파일이 생기면 그때 붙인다.
 */

export type ZoneId = 'center' | 'east' | 'south' | 'west' | 'north';

export type Point = { x: number; y: number };

export type Zone = {
  id: ZoneId;
  title: string;
  /** 길 위의 점. key가 노드 id. */
  nodes: Record<string, Point>;
  /** 이어진 길. 양방향으로 취급한다(걷기 로직이 양쪽으로 푼다). */
  edges: [string, string][];
  /** 집 슬롯. door는 "문 앞" 길 노드 id — 집 자체는 배경 그림에 그려져 있다. */
  slots: { id: string; door: string }[];
  /** 가장자리 전환 지점. node에 도착하면 to 맵의 enterAt 노드로 넘어간다. */
  exits: { dir: 'up' | 'down' | 'left' | 'right'; node: string; to: ZoneId; enterAt: string }[];
  /** 이 맵에 처음 들어올 때 기본 위치(전환으로 들어올 땐 exits.enterAt이 우선). */
  spawn: string;
};

/**
 * 5개 맵이 공유하는 길 골격 — 가장자리 순환로 + 가운데 '#' 격자.
 * 진짜 배경이 나오면 맵마다 따로 찍게 되지만, 그림이 없는 지금은 한 벌을 돌려쓴다.
 *
 * 세로(y) 0.12~0.88, 가로(x) 0.12~0.88만 쓴다 — 가장자리에 여백을 둬야 전환 지점이 화면 밖으로 안 나간다.
 */
const ROAD: Record<string, Point> = {
  // 위쪽 가로줄 (북쪽 전환 지점 포함)
  'top-l': { x: 0.3, y: 0.12 },
  'gate-n': { x: 0.5, y: 0.12 },
  'top-r': { x: 0.7, y: 0.12 },
  // 첫 번째 가로줄
  'row1-l': { x: 0.12, y: 0.35 },
  'cross-a': { x: 0.3, y: 0.35 },
  'plaza-n': { x: 0.5, y: 0.35 },
  'cross-b': { x: 0.7, y: 0.35 },
  'row1-r': { x: 0.88, y: 0.35 },
  // 허리줄 (좌우 전환 지점 + 한가운데 광장)
  'gate-w': { x: 0.12, y: 0.5 },
  plaza: { x: 0.5, y: 0.5 },
  'gate-e': { x: 0.88, y: 0.5 },
  // 두 번째 가로줄
  'row2-l': { x: 0.12, y: 0.65 },
  'cross-c': { x: 0.3, y: 0.65 },
  'plaza-s': { x: 0.5, y: 0.65 },
  'cross-d': { x: 0.7, y: 0.65 },
  'row2-r': { x: 0.88, y: 0.65 },
  // 아래쪽 가로줄 (남쪽 전환 지점 포함)
  'bot-l': { x: 0.3, y: 0.88 },
  'gate-s': { x: 0.5, y: 0.88 },
  'bot-r': { x: 0.7, y: 0.88 },
};

/** 집 문 앞 노드 — 길에서 짧게 갈라져 나온 막다른 점. [문 노드, 갈라져 나온 길 노드]. */
const DOOR_SPURS: [string, string][] = [
  ['door-1', 'cross-a'],
  ['door-2', 'plaza-n'],
  ['door-3', 'cross-b'],
  ['door-4', 'cross-c'],
  ['door-5', 'plaza-s'],
  ['door-6', 'cross-d'],
  ['door-7', 'plaza'],
  ['door-8', 'plaza'],
];

const DOORS: Record<string, Point> = {
  'door-1': { x: 0.2, y: 0.26 },
  'door-2': { x: 0.5, y: 0.25 },
  'door-3': { x: 0.8, y: 0.26 },
  'door-4': { x: 0.2, y: 0.74 },
  'door-5': { x: 0.5, y: 0.75 },
  'door-6': { x: 0.8, y: 0.74 },
  'door-7': { x: 0.38, y: 0.5 },
  'door-8': { x: 0.62, y: 0.5 },
};

const ROAD_EDGES: [string, string][] = [
  // 위쪽 가로줄
  ['top-l', 'gate-n'],
  ['gate-n', 'top-r'],
  // 위에서 첫 번째 줄로 내려오는 세로길
  ['top-l', 'cross-a'],
  ['top-r', 'cross-b'],
  // 첫 번째 가로줄
  ['row1-l', 'cross-a'],
  ['cross-a', 'plaza-n'],
  ['plaza-n', 'cross-b'],
  ['cross-b', 'row1-r'],
  // 양쪽 가장자리 세로길 (허리줄의 전환 지점을 지난다)
  ['row1-l', 'gate-w'],
  ['gate-w', 'row2-l'],
  ['row1-r', 'gate-e'],
  ['gate-e', 'row2-r'],
  // 가운데 세로길
  ['plaza-n', 'plaza'],
  ['plaza', 'plaza-s'],
  // 두 번째 가로줄
  ['row2-l', 'cross-c'],
  ['cross-c', 'plaza-s'],
  ['plaza-s', 'cross-d'],
  ['cross-d', 'row2-r'],
  // 아래로 내려가는 세로길
  ['cross-c', 'bot-l'],
  ['cross-d', 'bot-r'],
  // 아래쪽 가로줄
  ['bot-l', 'gate-s'],
  ['gate-s', 'bot-r'],
];

/** 공유 골격을 zone 하나 몫으로 찍어낸다. 슬롯 id는 맵별로 유일하게(zone 접두사). */
function skeleton(id: ZoneId): Pick<Zone, 'nodes' | 'edges' | 'slots'> {
  return {
    nodes: { ...ROAD, ...DOORS },
    edges: [...ROAD_EDGES, ...DOOR_SPURS.map(([door, road]): [string, string] => [road, door])],
    slots: DOOR_SPURS.map(([door], i) => ({ id: `${id}-h${i + 1}`, door })),
  };
}

export const ZONES: Record<ZoneId, Zone> = {
  center: {
    id: 'center',
    title: '마을 한가운데',
    ...skeleton('center'),
    exits: [
      { dir: 'up', node: 'gate-n', to: 'north', enterAt: 'gate-s' },
      { dir: 'right', node: 'gate-e', to: 'east', enterAt: 'gate-w' },
      { dir: 'down', node: 'gate-s', to: 'south', enterAt: 'gate-n' },
      { dir: 'left', node: 'gate-w', to: 'west', enterAt: 'gate-e' },
    ],
    spawn: 'plaza',
  },
  // 바깥 4개 맵은 중앙으로 돌아가는 출구 하나씩만 갖는다(모서리로 대각 이동은 없음).
  north: {
    id: 'north',
    title: '겨울 마을',
    ...skeleton('north'),
    exits: [{ dir: 'down', node: 'gate-s', to: 'center', enterAt: 'gate-n' }],
    spawn: 'plaza',
  },
  east: {
    id: 'east',
    title: '봄 마을',
    ...skeleton('east'),
    exits: [{ dir: 'left', node: 'gate-w', to: 'center', enterAt: 'gate-e' }],
    spawn: 'plaza',
  },
  south: {
    id: 'south',
    title: '여름 마을',
    ...skeleton('south'),
    exits: [{ dir: 'up', node: 'gate-n', to: 'center', enterAt: 'gate-s' }],
    spawn: 'plaza',
  },
  west: {
    id: 'west',
    title: '가을 마을',
    ...skeleton('west'),
    exits: [{ dir: 'right', node: 'gate-e', to: 'center', enterAt: 'gate-w' }],
    spawn: 'plaza',
  },
};
