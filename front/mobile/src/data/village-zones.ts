/**
 * 마을 맵 5개 — 중앙 + 동(봄)·남(여름)·서(가을)·북(겨울).
 *
 * 여기엔 **점**만 있다: 집 문, 맵 전환 지점, 처음 서는 자리. 좌표는 배경 그림 기준 0~1 비율.
 * 길은 손으로 찍지 않는다 — 그림에서 뽑아낸 격자(village-grid.ts)가 길이고,
 * 아바타는 그 격자 위로만 다닌다. (손으로 찍었더니 곡선 길·에움길에서 길을 벗어났다.)
 *
 * 좌표는 격자에 맞춰 보정돼 있다 — 그림을 새로 뽑으면 scripts/check-village.mjs가 어긋난 곳을 알려준다.
 * ⚠️ 이 파일은 노드에서 그대로 import해 검증한다(scripts/check-village.mjs).
 * 그래서 require(png)·react-native 의존을 두지 않는다 — 배경 그림은 village-backgrounds.ts에.
 */

export type ZoneId = 'center' | 'east' | 'south' | 'west' | 'north';

export type Point = { x: number; y: number };

export type Zone = {
  id: ZoneId;
  title: string;
  /**
   * 아바타 크기 배율. 맵마다 그림의 줌이 달라(겨울은 오두막이 크게 그려져 있다)
   * 같은 크기로 그리면 사람만 난쟁이가 된다. 중앙을 1로 두고 맞춘다.
   */
  avatarScale: number;
  /** 집 — door는 문 앞(그 집에 들어가려면 여기까지 걸어간다). 집 그림은 배경에 있다. */
  slots: { id: string; door: Point }[];
  /** 가장자리·다리 등 다음 맵으로 넘어가는 지점. 도착하면 to 맵으로 전환한다. */
  exits: { dir: 'up' | 'down' | 'left' | 'right'; at: Point; to: ZoneId }[];
  /** 이 맵에 그냥 들어왔을 때 서는 자리(전환으로 들어오면 반대쪽 출구 자리에 선다). */
  spawn: Point;
};

export const ZONE_ORDER: ZoneId[] = ['center', 'east', 'south', 'west', 'north'];

export const ZONES: Record<ZoneId, Zone> = {
  center: {
    id: 'center',
    title: '마을 한가운데',
    avatarScale: 1,
    slots: [
      { id: 'center-green', door: { x: 0.15, y: 0.335 } },
      { id: 'center-blue', door: { x: 0.81, y: 0.355 } },
      { id: 'center-purple', door: { x: 0.19, y: 0.545 } },
      { id: 'center-orange', door: { x: 0.79, y: 0.545 } },
      { id: 'center-red', door: { x: 0.49, y: 0.69 } },
      { id: 'center-gold', door: { x: 0.115, y: 0.755 } },
      { id: 'center-sage', door: { x: 0.845, y: 0.755 } },
      { id: 'center-teal', door: { x: 0.245, y: 0.925 } },
      { id: 'center-olive', door: { x: 0.73, y: 0.925 } },
    ],
    exits: [
      // 북쪽은 가장자리가 아니라 호수 위 돌다리다("다리를 건너 겨울 마을로").
      { dir: 'up', at: { x: 0.476, y: 0.275 }, to: 'north' },
      { dir: 'right', at: { x: 0.976, y: 0.592 }, to: 'east' },
      { dir: 'down', at: { x: 0.5, y: 0.985 }, to: 'south' },
      { dir: 'left', at: { x: 0.025, y: 0.63 }, to: 'west' },
    ],
    spawn: { x: 0.5, y: 0.455 },
  },
  east: {
    id: 'east',
    title: '봄 마을',
    avatarScale: 1.25,
    slots: [
      { id: 'east-pink', door: { x: 0.415, y: 0.325 } },
      { id: 'east-cream', door: { x: 0.55, y: 0.415 } },
      { id: 'east-blue', door: { x: 0.655, y: 0.495 } },
      { id: 'east-purple', door: { x: 0.805, y: 0.575 } },
      { id: 'east-mint', door: { x: 0.49, y: 0.7 } },
      { id: 'east-lavender', door: { x: 0.105, y: 0.755 } },
    ],
    exits: [{ dir: 'left', at: { x: 0.033, y: 0.541 }, to: 'center' }],
    spawn: { x: 0.41, y: 0.358 },
  },
  south: {
    id: 'south',
    title: '여름 마을',
    avatarScale: 1,
    slots: [
      { id: 'south-purple', door: { x: 0.52, y: 0.3 } },
      { id: 'south-orange', door: { x: 0.845, y: 0.4 } },
      { id: 'south-green', door: { x: 0.115, y: 0.44 } },
      { id: 'south-gold', door: { x: 0.13, y: 0.775 } },
      { id: 'south-olive', door: { x: 0.495, y: 0.718 } },
      { id: 'south-teal', door: { x: 0.775, y: 0.655 } },
    ],
    exits: [{ dir: 'up', at: { x: 0.382, y: 0.326 }, to: 'center' }],
    spawn: { x: 0.45, y: 0.355 },
  },
  west: {
    id: 'west',
    title: '가을 마을',
    avatarScale: 1,
    slots: [
      { id: 'west-olive-up', door: { x: 0.15, y: 0.325 } },
      { id: 'west-red-up', door: { x: 0.645, y: 0.4 } },
      { id: 'west-darkred', door: { x: 0.185, y: 0.535 } },
      { id: 'west-brown', door: { x: 0.79, y: 0.535 } },
      { id: 'west-red-low', door: { x: 0.485, y: 0.705 } },
      { id: 'west-olive-low', door: { x: 0.115, y: 0.735 } },
      { id: 'west-dark-low', door: { x: 0.84, y: 0.725 } },
    ],
    exits: [{ dir: 'right', at: { x: 0.958, y: 0.453 }, to: 'center' }],
    spawn: { x: 0.45, y: 0.555 },
  },
  north: {
    id: 'north',
    title: '겨울 마을',
    avatarScale: 1.6,
    slots: [
      { id: 'north-lodge', door: { x: 0.64, y: 0.205 } },
      { id: 'north-green', door: { x: 0.295, y: 0.335 } },
      { id: 'north-blue', door: { x: 0.618, y: 0.453 } },
      { id: 'north-brown-up', door: { x: 0.78, y: 0.565 } },
      { id: 'north-yellow', door: { x: 0.222, y: 0.756 } },
      { id: 'north-brown-low', door: { x: 0.79, y: 0.765 } },
    ],
    exits: [{ dir: 'down', at: { x: 0.5, y: 0.93 }, to: 'center' }],
    spawn: { x: 0.46, y: 0.5 },
  },
};

/**
 * `from` 맵에서 `to` 맵으로 넘어갔을 때 설 자리.
 * 도착 맵에서 "되돌아가는 출구"가 곧 들어온 문이라 그 자리에 세운다(없으면 spawn).
 */
export function entryPoint(from: ZoneId, to: ZoneId): Point {
  const back = ZONES[to].exits.find((e) => e.to === from);
  return back ? back.at : ZONES[to].spawn;
}
