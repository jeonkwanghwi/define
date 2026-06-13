/**
 * 마을 픽셀아트 에셋 생성기 (CC0 — 직접 그림, 외부 에셋 0).
 *
 * 작은 베이스 해상도에 픽셀아트를 그린 뒤 정수배 업스케일(nearest)해서
 * 크리스프한 PNG로 저장한다. 스프라이트엔 1px 다크 아웃라인을 둘러 가독성 확보.
 *
 * 실행: node scripts/gen-village-art.mjs  → assets/village/*.png
 */
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'assets', 'village');
mkdirSync(OUT, { recursive: true });

const SCALE = 3; // 업스케일 배수 (화면 표시 = 베이스 * SCALE)

// ---- 작은 RGBA 캔버스 헬퍼 ----
function canvas(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) }; // 전부 투명(0)으로 시작
}
function set(c, x, y, col) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = col[3] ?? 255;
}
function rect(c, x0, y0, x1, y1, col) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(c, x, y, col);
}
function disc(c, cx, cy, r, col) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    if (x * x + y * y <= r * r + r * 0.4) set(c, cx + x, cy + y, col);
  }
}
function alphaAt(c, x, y) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return 0;
  return c.px[(y * c.w + x) * 4 + 3];
}
// 투명 픽셀이 채워진 픽셀과 4방향으로 인접하면 아웃라인 색으로 채움 (1px 테두리)
function outline(c, col) {
  const targets = [];
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (alphaAt(c, x, y) !== 0) continue;
    if (alphaAt(c, x - 1, y) || alphaAt(c, x + 1, y) || alphaAt(c, x, y - 1) || alphaAt(c, x, y + 1)) targets.push([x, y]);
  }
  for (const [x, y] of targets) set(c, x, y, col);
}
function shade(col, f) {
  return [Math.round(col[0] * f), Math.round(col[1] * f), Math.round(col[2] * f), col[3] ?? 255];
}

function save(name, c) {
  const S = SCALE;
  const png = new PNG({ width: c.w * S, height: c.h * S });
  for (let y = 0; y < c.h * S; y++) for (let x = 0; x < c.w * S; x++) {
    const sx = (x / S) | 0, sy = (y / S) | 0;
    const si = (sy * c.w + sx) * 4, di = (y * (c.w * S) + x) * 4;
    png.data[di] = c.px[si]; png.data[di + 1] = c.px[si + 1];
    png.data[di + 2] = c.px[si + 2]; png.data[di + 3] = c.px[si + 3];
  }
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(join(OUT, name));
    stream.on('finish', resolve);
    stream.on('error', reject);
    png.pack().pipe(stream);
  });
}

// ---- 팔레트 ----
const OL = [42, 34, 28, 255]; // 아웃라인 다크 브라운
const GRASS = [134, 186, 92, 255];
const GRASS_D = [118, 170, 78, 255];
const GRASS_L = [168, 206, 120, 255];

// ---- 잔디 (16x16, 이음매 없는 타일) ----
function grass() {
  const c = canvas(16, 16);
  rect(c, 0, 0, 15, 15, GRASS);
  // 가장자리 피해서 결정적 speckle (타일 이어붙여도 자연스럽게)
  const dots = [[3, 4], [10, 2], [6, 9], [13, 11], [2, 12], [9, 13], [12, 6]];
  for (const [x, y] of dots) { set(c, x, y, GRASS_D); set(c, x + 1, y, GRASS_D); }
  const lite = [[5, 3], [11, 8], [4, 10], [8, 5], [14, 13]];
  for (const [x, y] of lite) set(c, x, y, GRASS_L);
  return c;
}

// ---- 나무 (16x18) ----
function tree() {
  const c = canvas(16, 18);
  const trunk = [120, 82, 46, 255];
  rect(c, 7, 12, 9, 16, trunk);
  rect(c, 7, 12, 7, 16, shade(trunk, 0.8));
  const leaf = [78, 150, 70, 255];
  disc(c, 8, 7, 6, leaf);
  disc(c, 8, 6, 6, leaf);
  // 밝은 하이라이트 (좌상단)
  disc(c, 6, 5, 3, [108, 178, 96, 255]);
  // 어두운 음영 (우하단)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (alphaAt(c, x, y) && x + y > 18 && c.px[(y * c.w + x) * 4 + 1] > 120) set(c, x, y, [60, 126, 56, 255]);
  }
  outline(c, OL);
  return c;
}

// ---- 집 (32x30), 지붕색 파라미터 ----
function house(roof) {
  const c = canvas(32, 30);
  const wall = [240, 224, 196, 255];
  const wallSh = [216, 196, 160, 255];
  const door = [110, 74, 44, 255];
  const win = [150, 208, 224, 255];
  // 벽
  rect(c, 4, 13, 27, 29, wall);
  rect(c, 4, 13, 7, 29, wallSh); // 좌측 음영
  // 지붕 (사다리꼴): y=2(좁게)~12(넓게)
  for (let y = 2; y <= 12; y++) {
    const t = (y - 2) / 10;
    const x0 = Math.round(14 - t * 12); // 2..14
    const x1 = Math.round(18 + t * 12); // 18..30
    rect(c, x0, y, x1, y, roof);
    rect(c, x0, y, x0 + 1, y, shade(roof, 0.78)); // 좌측 음영
    if (y === 2) rect(c, x0, y, x1, y, shade(roof, 1.12)); // 용마루 하이라이트
  }
  // 문
  rect(c, 14, 21, 18, 29, door);
  rect(c, 14, 21, 14, 29, shade(door, 0.8));
  set(c, 17, 25, [232, 200, 96, 255]); // 손잡이
  // 창문 2개 (십자 프레임)
  for (const wx of [8, 22]) {
    rect(c, wx, 16, wx + 3, 19, win);
    rect(c, wx + 1, 16, wx + 1, 19, OL); // 세로 프레임
    rect(c, wx, 17, wx + 3, 17, OL); // 가로 프레임
  }
  outline(c, OL);
  return c;
}

// ---- 캐릭터 (14x18), 정면 ----
function char() {
  const c = canvas(14, 18);
  const skin = [242, 200, 160, 255];
  const hair = [92, 62, 34, 255];
  const shirt = [74, 111, 176, 255];
  const pants = [58, 58, 74, 255];
  const shoe = [40, 36, 32, 255];
  // 다리/신발
  rect(c, 4, 14, 6, 16, pants); rect(c, 7, 14, 9, 16, pants);
  rect(c, 4, 17, 6, 17, shoe); rect(c, 7, 17, 9, 17, shoe);
  // 몸통(셔츠) + 팔
  rect(c, 3, 9, 10, 14, shirt);
  rect(c, 3, 9, 3, 13, shade(shirt, 0.82)); rect(c, 10, 9, 10, 13, shade(shirt, 0.82));
  // 머리
  rect(c, 4, 3, 9, 8, skin);
  // 머리카락
  rect(c, 3, 2, 10, 3, hair); rect(c, 3, 3, 3, 5, hair); rect(c, 10, 3, 10, 5, hair);
  // 눈
  set(c, 5, 6, OL); set(c, 8, 6, OL);
  outline(c, OL);
  return c;
}

// ---- 작은 꽃 데코 (8x8) ----
function flower() {
  const c = canvas(8, 8);
  rect(c, 3, 4, 4, 7, [86, 140, 60, 255]); // 줄기
  const petal = [236, 120, 150, 255];
  set(c, 3, 2, petal); set(c, 4, 2, petal); set(c, 2, 3, petal); set(c, 5, 3, petal); set(c, 3, 4, petal); set(c, 4, 4, petal);
  set(c, 3, 3, [248, 220, 96, 255]); set(c, 4, 3, [248, 220, 96, 255]); // 꽃술
  return c;
}

// 이웃 지붕색 (village-mock.ts와 동일)
const ROOFS = {
  'house-warm': [199, 125, 90, 255],
  'house-forest': [90, 140, 119, 255],
  'house-gold': [201, 162, 75, 255],
  'house-violet': [142, 107, 176, 255],
};

await save('grass.png', grass());
await save('tree.png', tree());
await save('char.png', char());
await save('flower.png', flower());
for (const [name, col] of Object.entries(ROOFS)) await save(`${name}.png`, house(col));

console.log('generated village art ->', OUT);
