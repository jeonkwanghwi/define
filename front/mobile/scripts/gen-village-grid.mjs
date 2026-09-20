/**
 * 마을 배경 그림 → "걸을 수 있는 칸" 격자(src/data/village-grid.ts) 생성기.
 *
 * 왜 필요한가: 길을 손으로 찍으면 곡선 길이나 에움길에서 반드시 어긋난다(실제로 어긋났다).
 * 그림에서 길 색을 직접 골라내 격자로 만들면, 앱이 그 격자 위에서만 걸으므로
 * 배경과 걷는 영역이 절대 따로 놀지 않는다. 그림을 새로 뽑으면 이 스크립트만 다시 돌리면 된다.
 *
 * 실행: node scripts/gen-village-grid.mjs        (macOS의 sips로 PNG→BMP 변환해서 읽는다)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ASSETS = new URL('../assets/village/', import.meta.url).pathname;
const OUT = new URL('../src/data/village-grid.ts', import.meta.url).pathname;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'village-grid-'));

/** 가로 칸 수. 848px 그림 기준 한 칸 8px — 길 폭이 3~4칸이라 걷기엔 충분하고 데이터도 작다. */
const COLS = 106;

const MAPS = [
  { zone: 'center', file: 'bg-center.png', rule: 'sand' },
  { zone: 'east', file: 'bg-east-spring.png', rule: 'sand' },
  { zone: 'south', file: 'bg-south-summer.png', rule: 'sand' },
  { zone: 'west', file: 'bg-west-autumn.png', rule: 'autumn' },
  {
    zone: 'north',
    file: 'bg-north-winter.png',
    rule: 'snow',
    close: [9, 4],
    // 겨울은 눈이 길을 덮어 아예 끊어 놓는다. 색으로 이을 수 없어 그림에 보이는
    // 오솔길을 따라 손으로 연결선을 그린다(비율좌표 — 마스크를 행별로 재서 맞춤).
    connectors: [
      [[0.66, 0.68], [0.63, 0.645], [0.58, 0.6], [0.53, 0.565], [0.5, 0.52],
       [0.48, 0.48], [0.47, 0.45], [0.43, 0.425], [0.44, 0.39], [0.47, 0.36],
       [0.5, 0.33], [0.55, 0.3], [0.6, 0.265], [0.635, 0.235]],
      [[0.43, 0.425], [0.38, 0.4], [0.33, 0.375], [0.3, 0.35]],
    ],
  },
];

/** 맵별 "걸을 수 있는 색" 규칙 — 실제 픽셀을 찍어보고 정한 값들. */
const RULES = {
  // 흙길(밝은 모래색) + 돌바닥(분수 광장·다리). 잔디는 g>r, 지붕·나무는 어둡다.
  sand: (c) => {
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    const dirt = c.r >= 195 && c.g >= 165 && c.r - c.b >= 50 && c.r - c.g >= 8 && c.r - c.g <= 60;
    const stone = mx >= 150 && mx - mn <= 34 && c.b <= c.r + 12;
    return dirt || stone;
  },
  // 가을은 화면 전체가 노랗다. 길·계단식 흙바닥(g≈150)과 논밭(g≈196)은 초록 채널로 갈린다.
  autumn: (c) => c.r >= 150 && c.r <= 238 && c.g >= 110 && c.g <= 188 && c.r - c.b >= 55 && c.r - c.b <= 180,
  // 겨울의 눈 치운 길은 회갈색(r≈g≈b, 170 언저리). 눈(230+)·바위(어두움)와 갈린다.
  snow: (c) => c.r >= 140 && c.r <= 205 && Math.abs(c.r - c.g) <= 14 && c.r - c.b >= -4 && c.r - c.b <= 35 && c.b <= 200,
};

function readBmp(file) {
  const buf = fs.readFileSync(file);
  const off = buf.readUInt32LE(10);
  const width = buf.readInt32LE(18);
  const raw = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const height = Math.abs(raw);
  const bottomUp = raw > 0;
  const bytes = bpp / 8;
  const rowSize = Math.floor((bpp * width + 31) / 32) * 4;
  const get = (x, y) => {
    const i = off + (bottomUp ? height - 1 - y : y) * rowSize + x * bytes;
    return { b: buf[i], g: buf[i + 1], r: buf[i + 2] };
  };
  return { width, height, get };
}

function close(m, w, h, dr, er) {
  const d = new Uint8Array(m.length);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    if (!m[y * w + x]) continue;
    for (let dy = -dr; dy <= dr; dy += 1) for (let dx = -dr; dx <= dr; dx += 1) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) d[ny * w + nx] = 1;
    }
  }
  const o = new Uint8Array(m.length);
  for (let y = er; y < h - er; y += 1) for (let x = er; x < w - er; x += 1) {
    let all = 1;
    for (let dy = -er; dy <= er && all; dy += 1) for (let dx = -er; dx <= er; dx += 1) {
      if (!d[(y + dy) * w + x + dx]) { all = 0; break; }
    }
    o[y * w + x] = all;
  }
  return o;
}

function paintConnectors(mask, w, h, lines, brush = 10) {
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const [ax, ay] = line[i - 1], [bx, by] = line[i];
      const x0 = ax * w, y0 = ay * h, x1 = bx * w, y1 = by * h;
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let k = 0; k <= n; k += 1) {
        const cx = Math.round(x0 + ((x1 - x0) * k) / n), cy = Math.round(y0 + ((y1 - y0) * k) / n);
        for (let dy = -brush; dy <= brush; dy += 1) for (let dx = -brush; dx <= brush; dx += 1) {
          if (dx * dx + dy * dy > brush * brush) continue;
          const x = cx + dx, y = cy + dy;
          if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1;
        }
      }
    }
  }
}

/** 가장 큰 연결 덩어리만 남긴다 — 하늘·호수·잡티가 통째로 떨어져 나간다. */
function keepLargestBlob(m, w, h) {
  const lab = new Int32Array(m.length).fill(-1);
  const sizes = [];
  let id = 0;
  for (let i = 0; i < m.length; i += 1) {
    if (!m[i] || lab[i] >= 0) continue;
    let n = 0; const st = [i]; lab[i] = id;
    while (st.length) {
      const p = st.pop(); n += 1; const x = p % w, y = (p / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (m[q] && lab[q] < 0) { lab[q] = id; st.push(q); }
      }
    }
    sizes.push(n); id += 1;
  }
  let best = -1, bestSize = 0;
  for (let i = 0; i < sizes.length; i += 1) if (sizes[i] > bestSize) { bestSize = sizes[i]; best = i; }
  const o = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i += 1) if (lab[i] === best) o[i] = 1;
  return o;
}

function downsample(mask, w, h, cols, rows, thresh = 0.35) {
  const cw = w / cols, ch = h / rows;
  const g = new Uint8Array(cols * rows);
  for (let gy = 0; gy < rows; gy += 1) for (let gx = 0; gx < cols; gx += 1) {
    let on = 0, tot = 0;
    for (let y = Math.floor(gy * ch); y < Math.min(h, (gy + 1) * ch); y += 1) {
      for (let x = Math.floor(gx * cw); x < Math.min(w, (gx + 1) * cw); x += 1) {
        tot += 1; if (mask[y * w + x]) on += 1;
      }
    }
    g[gy * cols + gx] = tot && on / tot >= thresh ? 1 : 0;
  }
  return g;
}

/** 런렝스 압축: "시작값:길이,길이,..."(36진수). 2천 자 남짓이라 소스에 그대로 둔다. */
function encode(g) {
  const runs = [];
  let cur = g[0], len = 0;
  for (const v of g) {
    if (v === cur) len += 1;
    else { runs.push(len.toString(36)); cur = v; len = 1; }
  }
  runs.push(len.toString(36));
  return `${g[0]}:${runs.join(',')}`;
}

const rows = [];
for (const m of MAPS) {
  const bmp = path.join(TMP, `${m.zone}.bmp`);
  execSync(`sips -s format bmp "${path.join(ASSETS, m.file)}" --out "${bmp}"`, { stdio: 'ignore' });
  const img = readBmp(bmp);
  const { width: w, height: h } = img;
  const gridRows = Math.round((COLS * h) / w);

  const tight = new Uint8Array(w * h);
  const rule = RULES[m.rule];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (rule(img.get(x, y))) tight[y * w + x] = 1;

  const [dr, er] = m.close ?? [5, 3];
  const closed = close(tight, w, h, dr, er);
  paintConnectors(closed, w, h, m.connectors ?? []);
  const road = keepLargestBlob(closed, w, h);
  const cells = keepLargestBlob(downsample(road, w, h, COLS, gridRows), COLS, gridRows);
  const walk = cells.reduce((a, b) => a + b, 0);
  console.log(`${m.zone}: ${COLS}x${gridRows}, 걸을 수 있는 칸 ${walk} (${((walk / cells.length) * 100).toFixed(0)}%)`);
  rows.push({ zone: m.zone, cols: COLS, rows: gridRows, enc: encode(cells) });
}

const ts = `/**
 * 마을 길 격자 — **자동 생성 파일이다. 손으로 고치지 말 것.**
 * 생성: node scripts/gen-village-grid.mjs (배경 그림에서 길 색을 골라 격자로 만든다)
 *
 * 1 = 걸을 수 있는 칸. 아바타는 이 칸 위로만 다니므로 배경 그림과 절대 어긋나지 않는다.
 * 문자열은 런렝스 압축("시작값:길이들", 36진수) — 5개 맵 합쳐 10KB 남짓.
 */
import type { ZoneId } from './village-zones';

type Packed = { cols: number; rows: number; enc: string };

const PACKED: Record<ZoneId, Packed> = {
${rows.map((r) => `  ${r.zone}: { cols: ${r.cols}, rows: ${r.rows}, enc: '${r.enc}' },`).join('\n')}
};

export type WalkGrid = { cols: number; rows: number; cells: Uint8Array };

function unpack({ cols, rows, enc }: Packed): WalkGrid {
  const [head, body] = enc.split(':');
  const cells = new Uint8Array(cols * rows);
  let v = Number(head);
  let i = 0;
  for (const run of body.split(',')) {
    const n = parseInt(run, 36);
    if (v) cells.fill(1, i, i + n);
    i += n;
    v = v ? 0 : 1;
  }
  return { cols, rows, cells };
}

/** 맵별 길 격자. 모듈 로드 때 한 번만 푼다. */
export const WALK_GRIDS: Record<ZoneId, WalkGrid> = {
${rows.map((r) => `  ${r.zone}: unpack(PACKED.${r.zone}),`).join('\n')}
};
`;
fs.writeFileSync(OUT, ts);
console.log(`→ ${OUT} (${(ts.length / 1024).toFixed(1)}KB)`);
