/**
 * 마을 맵 5개의 정적 정의 — 중앙 + 동(봄)·남(여름)·서(가을)·북(겨울).
 *
 * ⚠️ village-mock.ts와 같은 "월드 데이터" 층이다. 렌더링 방식과 무관하게 살아남는다.
 * 좌표는 전부 0~1 비율 — 렌더러가 보드 픽셀 크기에 곱해 환산한다(해상도 독립).
 *
 * 길은 이미지가 아니라 노드+간선 그래프다. 배경 그림을 갈아도 좌표만 다시 찍으면 되고,
 * 걷기 판정이 픽셀을 읽지 않아 가볍고 결정적이다. (설계: docs/superpowers/specs/2026-09-20-village-v1-design.md)
 *
 * ⚠️ 좌표는 배경 그림마다 따로 찍는다. 맵 5장은 지형·집 배치가 전부 달라서 공유할 수 없다.
 */
import type { ImageSourcePropType } from 'react-native';

export type ZoneId = 'center' | 'east' | 'south' | 'west' | 'north';

export type Point = { x: number; y: number };

export type Zone = {
  id: ZoneId;
  title: string;
  /** 배경 그림(앱 번들). 모든 좌표가 이 그림을 기준으로 찍혀 있다. */
  background: ImageSourcePropType;
  /**
   * 아바타 크기 배율. 맵마다 그림의 줌이 달라(겨울은 집이 크게 그려져 있다)
   * 같은 크기로 그리면 사람만 난쟁이가 된다. 중앙을 1로 두고 맞춘다.
   */
  avatarScale: number;
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
 * 중앙 맵(bg-center.png) — 배경 그림을 보고 직접 찍은 좌표.
 *
 * 길은 분수 광장을 중심으로 갈라진다. 분수 자체는 장애물이라 광장을 좌우로 우회하고(ringL/ringR),
 * 한가운데 빨간 지붕 집도 길이 양옆으로 갈라졌다가(splitL/splitR) 아래에서 합류한다.
 * 맨 아래 두 집은 지붕 위를 가로지르지 않도록 "집 앞"(frontTeal/frontOlive)을 거쳐 들어간다.
 *
 * 전환 지점 4개: 북=다리 / 서·동=좌우 가장자리 길 / 남=아래 가장자리 길.
 */
const CENTER_NODES: Record<string, Point> = {
  bridge: { x: 0.5, y: 0.225 },
  plazaN: { x: 0.5, y: 0.3 },
  ringL: { x: 0.345, y: 0.375 },
  ringR: { x: 0.655, y: 0.375 },
  plazaS: { x: 0.5, y: 0.455 },
  midC: { x: 0.5, y: 0.53 },
  westUp: { x: 0.18, y: 0.415 },
  westEdgeUp: { x: 0.04, y: 0.4 },
  eastUp: { x: 0.82, y: 0.415 },
  eastEdgeUp: { x: 0.96, y: 0.385 },
  midW: { x: 0.35, y: 0.545 },
  midE: { x: 0.65, y: 0.545 },
  westMid: { x: 0.19, y: 0.575 },
  eastMid: { x: 0.79, y: 0.575 },
  westEdge: { x: 0.025, y: 0.63 },
  eastEdge: { x: 0.975, y: 0.575 },
  splitL: { x: 0.345, y: 0.66 },
  splitR: { x: 0.655, y: 0.66 },
  belowRed: { x: 0.5, y: 0.73 },
  westLow: { x: 0.15, y: 0.775 },
  eastLow: { x: 0.84, y: 0.775 },
  lowC: { x: 0.5, y: 0.8 },
  lowW: { x: 0.31, y: 0.8 },
  lowE: { x: 0.69, y: 0.8 },
  edgeLowW: { x: 0.03, y: 0.79 },
  edgeLowE: { x: 0.97, y: 0.79 },
  lowSouth: { x: 0.5, y: 0.93 },
  frontTeal: { x: 0.33, y: 0.945 },
  frontOlive: { x: 0.67, y: 0.945 },
  gateS: { x: 0.5, y: 0.985 },
  // 집 문 앞 (지붕색으로 구분 — 배경 그림의 집과 1:1)
  dGreen: { x: 0.15, y: 0.335 },
  dBlue: { x: 0.81, y: 0.355 },
  dPurple: { x: 0.19, y: 0.545 },
  dOrange: { x: 0.79, y: 0.545 },
  dRed: { x: 0.49, y: 0.69 },
  dGold: { x: 0.115, y: 0.755 },
  dSage: { x: 0.845, y: 0.755 },
  dTeal: { x: 0.245, y: 0.925 },
  dOlive: { x: 0.73, y: 0.925 },
};

const CENTER_EDGES: [string, string][] = [
  ['bridge', 'plazaN'],
  ['plazaN', 'ringL'], ['plazaN', 'ringR'],
  ['ringL', 'plazaS'], ['ringR', 'plazaS'],
  ['ringL', 'westUp'], ['ringR', 'eastUp'],
  ['westUp', 'westEdgeUp'], ['eastUp', 'eastEdgeUp'],
  ['westUp', 'dGreen'], ['eastUp', 'dBlue'],
  ['plazaS', 'midC'],
  ['midC', 'midW'], ['midC', 'midE'],
  ['midW', 'westMid'], ['midE', 'eastMid'],
  ['westMid', 'westEdge'], ['eastMid', 'eastEdge'],
  ['westMid', 'dPurple'], ['eastMid', 'dOrange'],
  ['midW', 'splitL'], ['midE', 'splitR'],
  ['splitL', 'belowRed'], ['splitR', 'belowRed'],
  ['belowRed', 'dRed'],
  ['belowRed', 'lowC'],
  ['lowC', 'lowW'], ['lowC', 'lowE'],
  ['lowW', 'westLow'], ['lowE', 'eastLow'],
  ['westLow', 'edgeLowW'], ['eastLow', 'edgeLowE'],
  ['westLow', 'dGold'], ['eastLow', 'dSage'],
  ['lowC', 'lowSouth'],
  ['lowSouth', 'frontTeal'], ['frontTeal', 'dTeal'],
  ['lowSouth', 'frontOlive'], ['frontOlive', 'dOlive'],
  ['lowSouth', 'gateS'],
];

const CENTER_SLOTS = ['dGreen', 'dBlue', 'dPurple', 'dOrange', 'dRed', 'dGold', 'dSage', 'dTeal', 'dOlive']
  .map((door) => ({ id: `center-${door}`, door }));

/** 봄 맵(동쪽) — 개천을 따라 늘어선 마을. 두 개의 나무다리로 좌우 기슭을 오간다. */
const SPRING_NODES: Record<string, Point> = {
  treeSide: { x: 0.27, y: 0.3 },
  f1: { x: 0.43, y: 0.365 },
  f2: { x: 0.54, y: 0.455 },
  f3: { x: 0.63, y: 0.53 },
  f4: { x: 0.76, y: 0.615 },
  bridgeE: { x: 0.415, y: 0.445 },
  bridgeW: { x: 0.285, y: 0.45 },
  leftMid: { x: 0.155, y: 0.53 },
  westEdge: { x: 0.02, y: 0.55 },
  leftLow: { x: 0.15, y: 0.64 },
  lowLeft: { x: 0.22, y: 0.79 },
  lowMid: { x: 0.4, y: 0.78 },
  f5: { x: 0.49, y: 0.735 },
  bridge2W: { x: 0.565, y: 0.615 },
  bridge2E: { x: 0.66, y: 0.615 },
  dPink: { x: 0.415, y: 0.325 },
  dCream: { x: 0.55, y: 0.415 },
  dBlue: { x: 0.655, y: 0.495 },
  dPurple: { x: 0.805, y: 0.575 },
  dMint: { x: 0.49, y: 0.7 },
  dLav: { x: 0.105, y: 0.755 },
};

const SPRING_EDGES: [string, string][] = [
  ['treeSide', 'f1'],
  ['f1', 'f2'],
  ['f2', 'f3'],
  ['f3', 'f4'],
  ['f1', 'bridgeE'],
  ['bridgeE', 'bridgeW'],
  ['bridgeW', 'leftMid'],
  ['leftMid', 'westEdge'],
  ['leftMid', 'leftLow'],
  ['leftLow', 'dLav'],
  ['leftLow', 'lowLeft'],
  ['lowLeft', 'lowMid'],
  ['lowMid', 'f5'],
  ['f5', 'bridge2W'],
  ['bridge2W', 'bridge2E'],
  ['bridge2E', 'f4'],
  ['f1', 'dPink'],
  ['f2', 'dCream'],
  ['f3', 'dBlue'],
  ['f4', 'dPurple'],
  ['f5', 'dMint'],
];

const SPRING_SLOTS = ['dPink', 'dCream', 'dBlue', 'dPurple', 'dMint', 'dLav']
  .map((door) => ({ id: `spring-${door}`, door }));

/** 여름 맵(남쪽) — 호수를 둘러싼 순환로. 가운데 정자 섬은 눈으로만 본다. */
const SUMMER_NODES: Record<string, Point> = {
  gateN: { x: 0.35, y: 0.295 },
  ringN: { x: 0.45, y: 0.355 },
  ringNE: { x: 0.74, y: 0.41 },
  ringE: { x: 0.83, y: 0.52 },
  ringSE: { x: 0.72, y: 0.7 },
  ringS: { x: 0.4, y: 0.79 },
  ringSSE: { x: 0.58, y: 0.735 },
  ringSW: { x: 0.22, y: 0.73 },
  ringW: { x: 0.145, y: 0.545 },
  ringNW: { x: 0.24, y: 0.4 },
  dPurple: { x: 0.52, y: 0.3 },
  dOrange: { x: 0.845, y: 0.4 },
  dGreen: { x: 0.115, y: 0.44 },
  dGold: { x: 0.13, y: 0.775 },
  dOlive: { x: 0.5, y: 0.695 },
  dTeal: { x: 0.775, y: 0.655 },
};

const SUMMER_EDGES: [string, string][] = [
  ['ringN', 'ringNE'],
  ['ringNE', 'ringE'],
  ['ringE', 'ringSE'],
  ['ringSE', 'ringSSE'],
  ['ringSSE', 'ringS'],
  ['ringS', 'ringSW'],
  ['ringSW', 'ringW'],
  ['ringW', 'ringNW'],
  ['ringNW', 'ringN'],
  ['ringN', 'gateN'],
  ['ringN', 'dPurple'],
  ['ringNE', 'dOrange'],
  ['ringNW', 'dGreen'],
  ['ringSW', 'dGold'],
  ['ringSSE', 'dOlive'],
  ['ringSE', 'dTeal'],
];

const SUMMER_SLOTS = ['dPurple', 'dOrange', 'dGreen', 'dGold', 'dOlive', 'dTeal']
  .map((door) => ({ id: `summer-${door}`, door }));

/** 가을 맵(서쪽) — 계단식 비탈. 층마다 가로길이 있고 오른쪽 길로 중앙에 돌아간다. */
const AUTUMN_NODES: Record<string, Point> = {
  t1L: { x: 0.15, y: 0.355 },
  t1C: { x: 0.36, y: 0.335 },
  t1R: { x: 0.64, y: 0.42 },
  rRoad1: { x: 0.88, y: 0.4 },
  eastEdge: { x: 0.975, y: 0.45 },
  rRoad2: { x: 0.9, y: 0.6 },
  t2L: { x: 0.185, y: 0.56 },
  t2C: { x: 0.45, y: 0.555 },
  t2R: { x: 0.79, y: 0.56 },
  t3L: { x: 0.12, y: 0.775 },
  t3C: { x: 0.45, y: 0.785 },
  t3R: { x: 0.84, y: 0.76 },
  dOliveUp: { x: 0.15, y: 0.325 },
  dRedUp: { x: 0.645, y: 0.4 },
  dDarkRed: { x: 0.185, y: 0.535 },
  dBrown: { x: 0.79, y: 0.535 },
  dRedLow: { x: 0.485, y: 0.705 },
  dOliveLow: { x: 0.115, y: 0.735 },
  dDarkLow: { x: 0.84, y: 0.725 },
};

const AUTUMN_EDGES: [string, string][] = [
  ['t1L', 't1C'],
  ['t1C', 't1R'],
  ['t1R', 'rRoad1'],
  ['rRoad1', 'eastEdge'],
  ['rRoad1', 'rRoad2'],
  ['t2L', 't2C'],
  ['t2C', 't2R'],
  ['t2R', 'rRoad2'],
  ['t1C', 't2C'],
  ['t2C', 't3C'],
  ['t3L', 't3C'],
  ['t3C', 't3R'],
  ['t3R', 'rRoad2'],
  ['t1L', 'dOliveUp'],
  ['t1R', 'dRedUp'],
  ['t2L', 'dDarkRed'],
  ['t2R', 'dBrown'],
  ['t3C', 'dRedLow'],
  ['t3L', 'dOliveLow'],
  ['t3R', 'dDarkLow'],
  ['t2L', 't3L'],
];

const AUTUMN_SLOTS = ['dOliveUp', 'dRedUp', 'dDarkRed', 'dBrown', 'dRedLow', 'dOliveLow', 'dDarkLow']
  .map((door) => ({ id: `autumn-${door}`, door }));

/** 겨울 맵(북쪽) — 눈 치운 길이 비탈을 갈지자로 내려온다. 아래 돌다리가 중앙으로 이어진다. */
const WINTER_NODES: Record<string, Point> = {
  p1: { x: 0.6, y: 0.255 },
  p2: { x: 0.5, y: 0.325 },
  p3: { x: 0.44, y: 0.4 },
  p4: { x: 0.46, y: 0.5 },
  p5: { x: 0.43, y: 0.6 },
  rMid: { x: 0.58, y: 0.63 },
  p6: { x: 0.47, y: 0.7 },
  p7: { x: 0.46, y: 0.8 },
  gateS: { x: 0.5, y: 0.93 },
  westGreen: { x: 0.33, y: 0.365 },
  bridgeE: { x: 0.36, y: 0.555 },
  bridgeW: { x: 0.21, y: 0.565 },
  midBlue: { x: 0.6, y: 0.47 },
  rightBrown: { x: 0.72, y: 0.6 },
  lowLeft: { x: 0.3, y: 0.79 },
  lowRight: { x: 0.66, y: 0.78 },
  dLodge: { x: 0.64, y: 0.205 },
  dGreen: { x: 0.295, y: 0.335 },
  dBlue: { x: 0.615, y: 0.44 },
  dBrownUp: { x: 0.78, y: 0.565 },
  dYellow: { x: 0.21, y: 0.755 },
  dBrownLow: { x: 0.79, y: 0.765 },
};

const WINTER_EDGES: [string, string][] = [
  ['dLodge', 'p1'],
  ['p1', 'p2'],
  ['p2', 'p3'],
  ['p3', 'p4'],
  ['p4', 'p5'],
  ['p5', 'p6'],
  ['p6', 'p7'],
  ['p7', 'gateS'],
  ['p3', 'westGreen'],
  ['westGreen', 'dGreen'],
  ['p5', 'bridgeE'],
  ['bridgeE', 'bridgeW'],
  ['p4', 'midBlue'],
  ['midBlue', 'dBlue'],
  ['p5', 'rMid'],
  ['rMid', 'rightBrown'],
  ['rightBrown', 'dBrownUp'],
  ['rMid', 'lowRight'],
  ['lowRight', 'dBrownLow'],
  ['p7', 'lowLeft'],
  ['lowLeft', 'dYellow'],
];

const WINTER_SLOTS = ['dLodge', 'dGreen', 'dBlue', 'dBrownUp', 'dYellow', 'dBrownLow']
  .map((door) => ({ id: `winter-${door}`, door }));


export const ZONES: Record<ZoneId, Zone> = {
  center: {
    id: 'center',
    title: '마을 한가운데',
    background: require('../../assets/village/bg-center.png'),
    avatarScale: 1,
    nodes: CENTER_NODES,
    edges: CENTER_EDGES,
    slots: CENTER_SLOTS,
    exits: [
      { dir: 'up', node: 'bridge', to: 'north', enterAt: 'gateS' },
      { dir: 'right', node: 'eastEdge', to: 'east', enterAt: 'westEdge' },
      { dir: 'down', node: 'gateS', to: 'south', enterAt: 'gateN' },
      { dir: 'left', node: 'westEdge', to: 'west', enterAt: 'eastEdge' },
    ],
    spawn: 'plazaS',
  },
  // 바깥 4개 맵은 중앙으로 돌아가는 출구 하나씩만 갖는다(모서리로 대각 이동은 없음).
  north: {
    id: 'north',
    title: '겨울 마을',
    background: require('../../assets/village/bg-north-winter.png'),
    avatarScale: 1.6,
    nodes: WINTER_NODES,
    edges: WINTER_EDGES,
    slots: WINTER_SLOTS,
    exits: [{ dir: 'down', node: 'gateS', to: 'center', enterAt: 'bridge' }],
    spawn: 'p4',
  },
  east: {
    id: 'east',
    title: '봄 마을',
    background: require('../../assets/village/bg-east-spring.png'),
    avatarScale: 1.25,
    nodes: SPRING_NODES,
    edges: SPRING_EDGES,
    slots: SPRING_SLOTS,
    exits: [{ dir: 'left', node: 'westEdge', to: 'center', enterAt: 'eastEdge' }],
    spawn: 'f1',
  },
  south: {
    id: 'south',
    title: '여름 마을',
    background: require('../../assets/village/bg-south-summer.png'),
    avatarScale: 1,
    nodes: SUMMER_NODES,
    edges: SUMMER_EDGES,
    slots: SUMMER_SLOTS,
    exits: [{ dir: 'up', node: 'gateN', to: 'center', enterAt: 'gateS' }],
    spawn: 'ringN',
  },
  west: {
    id: 'west',
    title: '가을 마을',
    background: require('../../assets/village/bg-west-autumn.png'),
    avatarScale: 1,
    nodes: AUTUMN_NODES,
    edges: AUTUMN_EDGES,
    slots: AUTUMN_SLOTS,
    exits: [{ dir: 'right', node: 'eastEdge', to: 'center', enterAt: 'westEdge' }],
    spawn: 't2C',
  },
};
