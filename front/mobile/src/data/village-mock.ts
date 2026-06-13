/**
 * 아바타 마을 — 목업 데이터 (백엔드 0, 감/톤 검증용).
 *
 * ⚠️ 이 파일은 "월드 데이터"다. 렌더링 방식(2D/3D)과 무관하게 살아남는 층.
 * 나중에 진짜 백엔드(광장 공유)로 바꾸면 NEIGHBORS만 fetch 결과로 교체되고,
 * 렌더러(village-board)와 화면 로직은 그대로 재사용된다. → 2D→3D 전환의 핵심.
 *
 * 좌표는 0~1 비율: 렌더러가 보드 픽셀 크기에 곱해 실제 위치로 환산한다.
 * (해상도·렌더러에 독립적 → 2D 보드든 3D 씬이든 같은 좌표를 쓸 수 있음.)
 */

export type NeighborWord = {
  word: string;
  text: string;
};

/** 집 스프라이트 종류 (assets/village/<house>.png) — 지붕색으로 이웃 구분. */
export type HouseSprite = 'house-warm' | 'house-forest' | 'house-gold' | 'house-violet';

export type Neighbor = {
  id: string;
  name: string; // 마을 이웃(= 가짜 유저) 닉네임
  x: number; // 0~1 — 집의 가로 위치 비율
  y: number; // 0~1 — 집의 세로 위치 비율
  house: HouseSprite; // 집 스프라이트(지붕색)
  words: NeighborWord[];
};

/**
 * 이웃 4명. 정의는 우리 톤(사색적·주관적)으로 작성한 더미.
 * 같은 단어(행복 등)가 여러 이웃에 걸쳐 다르게 정의돼 "남들은 어떻게 정의했나"를 연출.
 */
export const NEIGHBORS: Neighbor[] = [
  {
    id: 'n1',
    name: '도서관 옆집',
    x: 0.22,
    y: 0.3,
    house: 'house-warm',
    words: [
      { word: '행복', text: '특별한 일이 없는데도 마음이 가라앉아 있는 평일 저녁 같은 것.' },
      { word: '시간', text: '아껴 쓰려 할수록 더 빨리 사라지는, 붙잡을 수 없는 모래.' },
    ],
  },
  {
    id: 'n2',
    name: '언덕 위 작업실',
    x: 0.7,
    y: 0.26,
    house: 'house-forest',
    words: [
      { word: '행복', text: '손에 쥐는 게 아니라 지나고 나서야 "그때였구나" 알게 되는 것.' },
      { word: '용기', text: '두렵지 않은 게 아니라, 두려운 채로 한 발 내딛는 일.' },
      { word: '어른', text: '책임질 일이 늘어난 만큼 변명할 곳이 줄어드는 상태.' },
    ],
  },
  {
    id: 'n3',
    name: '강가 노란 대문',
    x: 0.32,
    y: 0.6,
    house: 'house-gold',
    words: [
      { word: '외로움', text: '사람들 속에 있을 때 오히려 더 또렷해지는 감각.' },
      { word: '변화', text: '무서운 게 아니라, 멈춰 있는 게 더 무섭다는 걸 알게 되는 것.' },
    ],
  },
  {
    id: 'n4',
    name: '골목 끝 화분집',
    x: 0.78,
    y: 0.62,
    house: 'house-violet',
    words: [
      { word: '사랑', text: '상대를 바꾸려는 마음이 사라질 때 비로소 시작되는 것.' },
      { word: '습관', text: '내가 만든다고 믿지만 결국 나를 만드는 것.' },
    ],
  },
];

/** 아바타 시작 위치 (마을 입구쯤 — 아래 가운데). */
export const AVATAR_START = { x: 0.5, y: 0.84 };
