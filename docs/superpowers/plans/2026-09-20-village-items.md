# 마을 아이템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 잉크를 써서 자기 단어 하나를 픽셀아트 물건으로 만들고, 그 물건이 집 안 진열장에 놓여 누구나 구경할 수 있게 한다.

**Architecture:** 백엔드가 OpenAI로 "정의 글 → 사물 프롬프트 → 픽셀아트 이미지"를 만들어 S3에 올리고 URL만 DB에 남긴다. 생성은 **비동기**(요청 즉시 `pending` 응답, 뒤에서 만들고 완성되면 `ready`). 프론트는 마을 탭 안에 실내 화면을 push하고, 방 그림 위 고정 좌표 12칸에 물건을 얹는다.

**Tech Stack:** NestJS + Prisma(PostgreSQL) · OpenAI(`gpt-4.1-mini` 프롬프트 변환 + `gpt-image-1` 이미지) · AWS S3 + CloudFront · React Native(Expo Router) · 새 의존성은 `@aws-sdk/client-s3` 하나

**Spec:** `docs/superpowers/specs/2026-09-20-village-items-design.md`

## Global Constraints

- **테스트 러너가 없다.** 이 레포는 jest/vitest를 쓰지 않는다. 검증은 ⒜ `npx tsc --noEmit` ⒝ 실서버 curl ⒞ `node --experimental-strip-types` 스크립트 ⒟ 브라우저 실동작이다. **jest를 새로 깔지 말 것.**
- 백엔드 레이어: `controller / service / repository(추상) / repository.prisma(구현) / dto`. 광장(`back/src/modules/plaza`)·회상(`recall`)과 같은 모양으로.
- 주석은 **한국어**, "왜 이렇게 했는지" 위주. 기존 파일과 같은 밀도.
- 프론트 파일명 kebab-case, import는 `@/X` = `src/X`.
- 잉크 값: **생성 50 / 재생성 50**. 상수는 `VILLAGE_ITEM_COST`.
- 로컬 DB: `postgresql://define:define@localhost:5432/define` (docker compose, 컨테이너명 `define-db`).
- 개발 서버 실행: 레포 루트에서 `./dev-web.sh` (Postgres+백엔드+Expo 웹 한 번에).
- node/npm은 PATH에 없다. 모든 명령 앞에 `source ~/.nvm/nvm.sh` 또는 `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`.
- 커밋 메시지 끝에 붙일 것:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

---

## File Structure

**백엔드 (신규)**
- `back/src/modules/village/item.repository.ts` — 아이템 CRUD 계약(추상)
- `back/src/modules/village/item.repository.prisma.ts` — 구현
- `back/src/modules/village/item-image.client.ts` — 정의 글 → 프롬프트 → 이미지 Buffer (OpenAI 2단계)
- `back/src/modules/village/item-storage.ts` — S3 업로드 → 공개 URL
- `back/src/modules/village/item.service.ts` — 잉크 차감·환불, pending 생성, 백그라운드 생성 오케스트레이션
- `back/src/modules/village/dto/create-item.dto.ts`, `dto/item.response.ts`

**백엔드 (수정)**
- `back/prisma/schema.prisma` — `VillageItem` 모델 + `User.roomVariant`
- `back/src/modules/currency/currency.repository.ts` / `.prisma.ts` — `refund()` 추가
- `back/src/modules/village/village.controller.ts` / `village.module.ts` — 엔드포인트 3개 등록
- `back/src/config/configuration.ts` — S3 설정(버킷·리전·공개 URL)

**프론트 (신규)**
- `front/mobile/src/data/village-rooms.ts` — 방 그림 3종 + 진열 12칸 좌표
- `front/mobile/src/components/village/room-scene.tsx` — 방 그림 위 진열·이름표
- `front/mobile/src/components/village/make-item-sheet.tsx` — 만들 단어 고르기
- `front/mobile/src/services/village-items-api.ts`
- `front/mobile/src/app/(tabs)/village/_layout.tsx`, `village/index.tsx`, `village/house/[userId].tsx`

**프론트 (수정)**
- `front/mobile/src/app/(tabs)/village.tsx` → `village/index.tsx`로 이동(내용 유지 + 내 집 표식·push 연결)
- `front/mobile/src/data/village-zones.ts` — 중앙 맵에 내 집 슬롯 표시(`isMine`)
- `front/mobile/scripts/check-village.mjs` — 내 집 슬롯 제외 검사 추가

---

### Task 1: DB 스키마 + 잉크 환불

**Files:**
- Modify: `back/prisma/schema.prisma`
- Modify: `back/src/modules/currency/currency.repository.ts`
- Modify: `back/src/modules/currency/currency.repository.prisma.ts`
- Create: `back/prisma/migrations/<timestamp>_village_items/migration.sql` (prisma가 생성)

**Interfaces:**
- Produces: `VillageItem` 테이블, `User.roomVariant`, `CurrencyRepository.refund(userId, amount): Promise<number>`

- [ ] **Step 1: 스키마에 모델 추가**

`back/prisma/schema.prisma` 의 `Entry` 모델 아래에 추가:

```prisma
/// 단어 하나로 만든 "물건". (userId, word) 유일 — 같은 단어의 물건은 하나뿐이고 다시 만들면 교체된다.
model VillageItem {
  id            String   @id @default(cuid())
  userId        String
  word          String
  /// 어떤 정의로 만들었는지 — 물건에서 원본 글로 되짚기 위해(2026-06-28 회의 요구).
  sourceEntryId String
  /// pending(만드는 중) | ready | failed
  status        String   @default("pending")
  imageUrl      String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, word])
  @@index([userId])
}
```

같은 파일 `model User` 안에 두 줄 추가:

```prisma
  /// 집 안 방 그림 1~4. 가입 때 배정(집집마다 조금씩 다르게).
  roomVariant Int           @default(1)
  villageItems VillageItem[]
```

- [ ] **Step 2: 마이그레이션 생성·적용**

```bash
source ~/.nvm/nvm.sh
cd back && docker compose up -d && npx prisma migrate dev --name village_items
```

Expected: `VillageItem` 테이블 생성 + `User.roomVariant` 컬럼 추가, 에러 없음.

- [ ] **Step 3: 테이블이 실제로 생겼는지 확인**

```bash
docker exec define-db psql -U define -d define -c '\d "VillageItem"'
docker exec define-db psql -U define -d define -c '\d "User"' | grep roomVariant
```

Expected: 컬럼 목록에 `sourceEntryId`, `status`, `imageUrl`이 보이고 `userId, word` 유니크 인덱스가 있다. `User`에 `roomVariant | integer`.

- [ ] **Step 4: 환불 계약 추가**

`currency.repository.ts` 의 `spend` 아래에 추가:

```ts
  /** 생성 실패 시 되돌려주기. balance += amount. 갱신된 balance 반환. */
  abstract refund(userId: string, amount: number): Promise<number>;
```

`currency.repository.prisma.ts` 의 클래스 안에 추가:

```ts
  async refund(userId: string, amount: number): Promise<number> {
    // 환불은 조건이 없다(차감이 성공했을 때만 부르므로). 원자적 증가면 충분.
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });
    return row.balance;
  }
```

- [ ] **Step 5: 방 종류를 가입 때 배정 + 기존 유저 채우기**

`back/src/modules/auth/auth.service.ts` 의 회원가입에서 유저를 만들 때 `roomVariant`를 넣는다
(정확한 위치는 `signup`이 `create`를 부르는 곳 — repository 시그니처를 따라 넣을 것):

```ts
// 집집마다 방이 조금씩 다르게. 1~3 중 하나를 가입 때 못 박는다(나중에 바뀌면 남의 집이 달라 보인다).
roomVariant: 1 + Math.floor(Math.random() * 3),
```

기존 유저는 마이그레이션에서 한 번 채운다. `prisma/migrations/<방금 만든 폴더>/migration.sql` 맨 아래에 추가:

```sql
-- 이미 있던 유저에게도 방을 나눠준다(전부 1로 두면 모든 집이 똑같아 보인다).
UPDATE "User" SET "roomVariant" = 1 + (abs(hashtext("id")) % 3);
```

그리고 다시 적용:

```bash
cd back && npx prisma migrate reset --force && npx prisma migrate deploy && npm run db:seed && npm run db:seed:plaza
```

> `migrate reset`은 **로컬 DB를 비운다.** 시드를 다시 넣으면 되므로 로컬에선 괜찮지만,
> 이미 로컬에 테스트 계정을 쌓아 뒀다면 `UPDATE` 문만 psql로 직접 실행해도 된다.

- [ ] **Step 6: 배정 확인**

```bash
docker exec define-db psql -U define -d define -c \
  'select "roomVariant", count(*) from "User" group by 1 order by 1;'
```

Expected: 1·2·3이 고루 섞여 있다(한 종류로 몰려 있지 않다).

- [ ] **Step 7: 빌드 통과 확인**

```bash
cd back && npm run build
```

Expected: 에러 0.

- [ ] **Step 8: 커밋**

```bash
git add back/prisma back/src/modules/currency back/src/modules/auth
git commit -m "feat(village): 아이템 테이블 + 방 종류 배정 + 잉크 환불 계약

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 이미지 생성 클라이언트 (눈으로 품질 확인까지)

**Files:**
- Create: `back/src/modules/village/item-image.client.ts`
- Create: `back/scripts/try-item-image.mjs` (품질 확인용, 레포에 남긴다 — 프롬프트 튜닝 때 계속 쓴다)

**Interfaces:**
- Consumes: `OPENAI_API_KEY`(back/.env)
- Produces: `ItemImageClient.create(word: string, definition: string): Promise<{ png: Buffer; prompt: string }>`

- [ ] **Step 1: 클라이언트 작성**

`back/src/modules/village/item-image.client.ts`:

```ts
/**
 * ItemImageClient — 정의 글 하나를 "픽셀아트 사물" PNG로 만든다.
 *
 * 2단계인 이유: 정의 글은 한국어에 추상적이라 이미지 모델에 그대로 넣으면 결과가 엉망이다.
 * 먼저 글에서 **사물 하나**를 뽑아 영어 구절로 바꾸고, 그 구절에 스타일을 고정해 생성한다.
 * 배경은 마젠타로 뽑아 투명 처리한다(아바타 추출에 쓴 것과 같은 방식 — 생성 모델은 투명 배경을 못 준다).
 */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/** 마을·아바타와 같은 화풍으로 고정. 여기가 흔들리면 집 안이 잡동사니가 된다. */
const STYLE =
  '16-bit pixel art, a single object centered, no people, no text, no logos, ' +
  'muted warm palette, soft shading, crisp pixel edges, flat solid magenta (#FF00FF) background';

@Injectable()
export class ItemImageClient {
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('openai.apiKey');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  private require(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException('지금은 물건을 만들 수 없어요. 잠시 후 다시 시도해 주세요.');
    }
    return this.client;
  }

  /** 정의 글 → 사물 한 개를 묘사하는 짧은 영어 구절. */
  async toObjectPrompt(word: string, definition: string): Promise<string> {
    const res = await this.require().chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.7,
      max_completion_tokens: 60,
      messages: [
        {
          role: 'system',
          content:
            'You turn a personal definition of a Korean word into ONE concrete physical object ' +
            'that could sit on a shelf. Answer with an English noun phrase under 15 words. ' +
            'No people, no faces, no text, no scenes — a single object only.',
        },
        { role: 'user', content: `단어: ${word}\n정의: ${definition}` },
      ],
    });
    return (res.choices[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '');
  }

  /** 사물 구절 → PNG(마젠타 배경). */
  async render(objectPrompt: string): Promise<Buffer> {
    const res = await this.require().images.generate({
      model: 'gpt-image-1',
      prompt: `${objectPrompt}. ${STYLE}`,
      size: '1024x1024',
      quality: 'low',
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new ServiceUnavailableException('물건 그림을 받지 못했어요.');
    return Buffer.from(b64, 'base64');
  }

  async create(word: string, definition: string): Promise<{ png: Buffer; prompt: string }> {
    const prompt = await this.toObjectPrompt(word, definition);
    return { png: await this.render(prompt), prompt };
  }
}
```

- [ ] **Step 2: 품질 확인 스크립트 작성**

`back/scripts/try-item-image.mjs`:

```js
/**
 * 아이템 그림을 한 장 뽑아 눈으로 확인한다(프롬프트 튜닝용).
 * 실행: node scripts/try-item-image.mjs "행복" "특별한 일이 없는데도 마음이 가라앉는 평일 저녁"
 * 결과: back/tmp/item-<단어>.png
 */
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import OpenAI from 'openai';

const [, , word, definition] = process.argv;
if (!word || !definition) {
  console.error('사용법: node scripts/try-item-image.mjs "<단어>" "<정의>"');
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const STYLE =
  '16-bit pixel art, a single object centered, no people, no text, no logos, ' +
  'muted warm palette, soft shading, crisp pixel edges, flat solid magenta (#FF00FF) background';

const chat = await client.chat.completions.create({
  model: 'gpt-4.1-mini',
  temperature: 0.7,
  max_completion_tokens: 60,
  messages: [
    {
      role: 'system',
      content:
        'You turn a personal definition of a Korean word into ONE concrete physical object ' +
        'that could sit on a shelf. Answer with an English noun phrase under 15 words. ' +
        'No people, no faces, no text, no scenes — a single object only.',
    },
    { role: 'user', content: `단어: ${word}\n정의: ${definition}` },
  ],
});
const prompt = (chat.choices[0]?.message?.content ?? '').trim();
console.log('사물 프롬프트:', prompt);

const img = await client.images.generate({
  model: 'gpt-image-1',
  prompt: `${prompt}. ${STYLE}`,
  size: '1024x1024',
  quality: 'low',
  n: 1,
});
fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
const out = path.join(process.cwd(), 'tmp', `item-${word}.png`);
fs.writeFileSync(out, Buffer.from(img.data[0].b64_json, 'base64'));
console.log('저장:', out);
```

- [ ] **Step 3: 실제로 3개 생성해 눈으로 확인**

```bash
source ~/.nvm/nvm.sh && cd back
node scripts/try-item-image.mjs "행복" "특별한 일이 없는데도 마음이 가라앉아 있는 평일 저녁 같은 것"
node scripts/try-item-image.mjs "외로움" "사람들 속에 있을 때 오히려 더 또렷해지는 감각"
node scripts/try-item-image.mjs "시간" "아껴 쓰려 할수록 더 빨리 사라지는 모래"
open tmp/
```

Expected: 세 장 모두 ⒜ **사물 하나**만 있고 ⒝ 글자·사람이 없고 ⒞ 배경이 마젠타 단색이며 ⒟ 마을 그림과 화풍이 크게 어긋나지 않는다.
**하나라도 어긋나면 `STYLE` 문자열과 system 프롬프트를 고쳐 다시 돌린다.** 여기서 맞춰두지 않으면 나중에 사용자 잉크로 실험하게 된다.

- [ ] **Step 4: `tmp/` 가 커밋되지 않게**

```bash
cd back && echo "tmp/" >> .gitignore
```

- [ ] **Step 5: 커밋**

```bash
git add back/src/modules/village/item-image.client.ts back/scripts/try-item-image.mjs back/.gitignore
git commit -m "feat(village): 아이템 그림 생성 클라이언트(사물 프롬프트 변환 + 픽셀아트 생성)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: S3 업로드

**Files:**
- Create: `back/src/modules/village/item-storage.ts`
- Modify: `back/src/config/configuration.ts`
- Modify: `back/.env.example`

**Interfaces:**
- Consumes: env `S3_BUCKET`, `S3_REGION`, `ASSET_BASE_URL`
- Produces: `ItemStorage.putPng(key: string, png: Buffer): Promise<string>` — 공개 URL 반환

- [ ] **Step 1: 의존성 추가**

```bash
source ~/.nvm/nvm.sh && cd back && npm install @aws-sdk/client-s3
```

- [ ] **Step 2: 설정 추가**

`back/src/config/configuration.ts` 의 반환 객체에 추가:

```ts
  s3: {
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'ap-northeast-2',
    // 업로드한 이미지를 읽을 공개 주소(CloudFront). 끝에 슬래시 없이.
    assetBaseUrl: process.env.ASSET_BASE_URL ?? '',
  },
```

`back/.env.example` 에 추가:

```
# 아이템 이미지 저장 (없으면 물건 만들기가 503으로 거절된다)
S3_BUCKET=define-web-staging
S3_REGION=ap-northeast-2
ASSET_BASE_URL=https://d2kejc3sjm91mt.cloudfront.net
```

- [ ] **Step 3: 업로더 작성**

`back/src/modules/village/item-storage.ts`:

```ts
/**
 * ItemStorage — 아이템 PNG를 S3에 올리고 공개 URL을 돌려준다.
 *
 * 컨테이너(ECS Fargate)는 디스크가 사라지므로 파일을 서버에 둘 수 없다.
 * 읽기는 이미 웹 프론트를 서비스 중인 CloudFront를 그대로 탄다(같은 버킷).
 */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class ItemStorage {
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('s3.bucket') ?? '';
    this.baseUrl = (config.get<string>('s3.assetBaseUrl') ?? '').replace(/\/$/, '');
    const region = config.get<string>('s3.region');
    // 자격증명은 실행 환경에서(ECS 태스크 역할 / 로컬은 ~/.aws). 코드에 키를 두지 않는다.
    this.client = this.bucket ? new S3Client({ region }) : null;
  }

  async putPng(key: string, png: Buffer): Promise<string> {
    if (!this.client || !this.baseUrl) {
      throw new ServiceUnavailableException('지금은 물건을 보관할 수 없어요.');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: png,
        ContentType: 'image/png',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.baseUrl}/${key}`;
  }
}
```

- [ ] **Step 4: 실제로 한 장 올려서 200 확인**

`back/scripts/try-s3-upload.mjs` 를 만들어 실행:

```js
import fs from 'node:fs';
import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const key = `village-items/_smoke-test.png`;
const client = new S3Client({ region: process.env.S3_REGION ?? 'ap-northeast-2' });
await client.send(
  new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fs.readFileSync(process.argv[2]),
    ContentType: 'image/png',
  }),
);
console.log(`${process.env.ASSET_BASE_URL}/${key}`);
```

```bash
source ~/.nvm/nvm.sh && cd back
node scripts/try-s3-upload.mjs tmp/item-행복.png
curl -s -o /dev/null -w "%{http_code}\n" "<위에서 출력된 URL>"
```

Expected: `200`. (403이면 버킷 정책이 CloudFront OAC만 허용하는지 확인 — `village-items/*` 경로도 같은 배포에서 읽히는지 본다.)

- [ ] **Step 5: 커밋**

```bash
git add back/src/modules/village/item-storage.ts back/src/config/configuration.ts back/.env.example back/scripts/try-s3-upload.mjs back/package.json back/package-lock.json
git commit -m "feat(village): 아이템 이미지 S3 업로드(공개 URL은 CloudFront)

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 아이템 API (잉크 차감·비동기 생성·환불)

**Files:**
- Create: `back/src/modules/village/item.repository.ts`, `item.repository.prisma.ts`, `item.service.ts`, `dto/create-item.dto.ts`, `dto/item.response.ts`
- Modify: `back/src/modules/village/village.controller.ts`, `village.module.ts`

**Interfaces:**
- Consumes: Task 1의 `VillageItem`·`refund`, Task 2의 `ItemImageClient.create`, Task 3의 `ItemStorage.putPng`
- Produces:
  - `POST /api/village/items { word } → { item }`
  - `GET /api/village/items?userId= → { roomVariant, items }`
  - `POST /api/village/items/:id/regenerate → { item }`
  - 아이템 JSON: `{ id, word, status, imageUrl, definition, savedAt }`

- [ ] **Step 1: 저장소 계약과 구현**

`item.repository.ts`:

```ts
/** VillageItem 접근 계약. 구현은 .prisma.ts. */
export type ItemRow = {
  id: string;
  userId: string;
  word: string;
  sourceEntryId: string;
  status: string;
  imageUrl: string | null;
};

export abstract class ItemRepository {
  /** 그 유저의 물건 전부(최근 만든 순). */
  abstract listByUser(userId: string): Promise<ItemRow[]>;
  /** 같은 단어의 물건이 이미 있으면 그것. */
  abstract findByWord(userId: string, word: string): Promise<ItemRow | null>;
  abstract findById(id: string): Promise<ItemRow | null>;
  /** pending 상태로 자리를 먼저 만든다. */
  abstract createPending(userId: string, word: string, sourceEntryId: string): Promise<ItemRow>;
  /** 생성 성공 — 이미지 URL과 함께 ready로. (다시 만들기면 기존 행을 덮어쓴다) */
  abstract markReady(id: string, imageUrl: string, sourceEntryId: string): Promise<void>;
  abstract markFailed(id: string): Promise<void>;
  /** 다시 만들기 시작 — 기존 행을 pending으로 되돌린다. */
  abstract markPending(id: string, sourceEntryId: string): Promise<void>;
  /** 그 유저가 쓴 단어 중 물건이 없는 것들(최신 정의와 함께). */
  abstract listMakeableWords(userId: string): Promise<{ word: string; entryId: string; text: string }[]>;
  /** 그 단어의 최신 정의. */
  abstract latestEntry(userId: string, word: string): Promise<{ id: string; text: string; savedAt: Date } | null>;
  abstract roomVariant(userId: string): Promise<number>;
}
```

`item.repository.prisma.ts`:

```ts
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { ItemRepository, type ItemRow } from './item.repository';

@Injectable()
export class PrismaItemRepository extends ItemRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private static select = {
    id: true,
    userId: true,
    word: true,
    sourceEntryId: true,
    status: true,
    imageUrl: true,
  } as const;

  listByUser(userId: string): Promise<ItemRow[]> {
    return this.prisma.villageItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: PrismaItemRepository.select,
    });
  }

  findByWord(userId: string, word: string): Promise<ItemRow | null> {
    return this.prisma.villageItem.findUnique({
      where: { userId_word: { userId, word } },
      select: PrismaItemRepository.select,
    });
  }

  findById(id: string): Promise<ItemRow | null> {
    return this.prisma.villageItem.findUnique({ where: { id }, select: PrismaItemRepository.select });
  }

  createPending(userId: string, word: string, sourceEntryId: string): Promise<ItemRow> {
    return this.prisma.villageItem.create({
      data: { userId, word, sourceEntryId, status: 'pending' },
      select: PrismaItemRepository.select,
    });
  }

  async markReady(id: string, imageUrl: string, sourceEntryId: string): Promise<void> {
    await this.prisma.villageItem.update({
      where: { id },
      data: { status: 'ready', imageUrl, sourceEntryId },
    });
  }

  async markFailed(id: string): Promise<void> {
    await this.prisma.villageItem.update({ where: { id }, data: { status: 'failed' } });
  }

  async markPending(id: string, sourceEntryId: string): Promise<void> {
    await this.prisma.villageItem.update({
      where: { id },
      data: { status: 'pending', sourceEntryId },
    });
  }

  async listMakeableWords(userId: string) {
    // 물건이 없는 단어만. 단어별 최신 정의 하나씩.
    const entries = await this.prisma.entry.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: { id: true, word: true, text: true },
    });
    const taken = new Set(
      (await this.prisma.villageItem.findMany({ where: { userId }, select: { word: true } })).map(
        (i) => i.word,
      ),
    );
    const seen = new Set<string>();
    const out: { word: string; entryId: string; text: string }[] = [];
    for (const e of entries) {
      if (taken.has(e.word) || seen.has(e.word)) continue;
      seen.add(e.word);
      out.push({ word: e.word, entryId: e.id, text: e.text });
    }
    return out;
  }

  latestEntry(userId: string, word: string) {
    return this.prisma.entry.findFirst({
      where: { userId, word },
      orderBy: { savedAt: 'desc' },
      select: { id: true, text: true, savedAt: true },
    });
  }

  async roomVariant(userId: string): Promise<number> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { roomVariant: true } });
    return row?.roomVariant ?? 1;
  }
}
```

- [ ] **Step 2: DTO**

`dto/create-item.dto.ts`:

```ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  word!: string;
}
```

`dto/item.response.ts`:

```ts
export type ItemJson = {
  id: string;
  word: string;
  status: string;
  imageUrl: string | null;
  /** 그 단어의 최신 정의 — 실내에서 물건을 누르면 바로 보여준다. */
  definition: string;
  savedAt: string;
};

export type HouseResponse = { roomVariant: number; items: ItemJson[] };
```

- [ ] **Step 3: 서비스 — 차감·비동기 생성·환불**

`item.service.ts`:

```ts
/**
 * ItemService — 물건 만들기의 주인.
 *
 * 생성은 **비동기**다: 잉크를 먼저 빼고 pending 자리를 만들어 바로 응답한 뒤,
 * 그림 만들기·업로드는 뒤에서 진행한다(15~30초). 실패하면 잉크를 돌려준다.
 * 큐 서버는 두지 않았다 — 건당 수십 초짜리 작업이고 동시 요청이 많지 않다(YAGNI).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { CurrencyRepository } from '../currency/currency.repository';
import { ItemImageClient } from './item-image.client';
import { ItemStorage } from './item-storage';
import { ItemRepository, type ItemRow } from './item.repository';
import type { HouseResponse, ItemJson } from './dto/item.response';

/** 물건 하나 만드는 값. 출석이 하루 +10이니 닷새치. 결과가 영구적이라 회상(30)보다 비싸다. */
export const VILLAGE_ITEM_COST = 50;

@Injectable()
export class ItemService {
  private readonly log = new Logger(ItemService.name);

  constructor(
    private readonly items: ItemRepository,
    private readonly currency: CurrencyRepository,
    private readonly image: ItemImageClient,
    private readonly storage: ItemStorage,
  ) {}

  async house(userId: string): Promise<HouseResponse> {
    const [roomVariant, rows] = await Promise.all([
      this.items.roomVariant(userId),
      this.items.listByUser(userId),
    ]);
    const items = await Promise.all(rows.map((r) => this.toJson(userId, r)));
    return { roomVariant, items };
  }

  async makeableWords(userId: string) {
    return this.items.listMakeableWords(userId);
  }

  async create(userId: string, word: string): Promise<ItemJson> {
    const existing = await this.items.findByWord(userId, word);
    if (existing) throw new ConflictException('이미 그 단어의 물건이 있어요.');
    const entry = await this.items.latestEntry(userId, word);
    if (!entry) throw new BadRequestException('아직 그 단어를 정의하지 않았어요.');

    const spent = await this.currency.spend(userId, VILLAGE_ITEM_COST);
    // 402 = 잔액 부족. Nest에 전용 예외가 없어 상태코드를 직접 준다.
    if (!spent.ok) throw new HttpException('잉크가 모자라요.', 402);

    const row = await this.items.createPending(userId, word, entry.id);
    void this.generate(row.id, userId, word, entry.text); // 기다리지 않는다
    return this.toJson(userId, row);
  }

  async regenerate(userId: string, id: string): Promise<ItemJson> {
    const row = await this.items.findById(id);
    if (!row) throw new NotFoundException('없는 물건이에요.');
    if (row.userId !== userId) throw new ForbiddenException('내 물건만 다시 만들 수 있어요.');
    const entry = await this.items.latestEntry(userId, row.word);
    if (!entry) throw new BadRequestException('정의가 없어요.');
    // 같은 정의로는 다시 만들지 않는다 — 생각이 바뀌었을 때만 의미가 있다.
    if (entry.id === row.sourceEntryId && row.status === 'ready') {
      throw new ConflictException('그 단어를 다시 정의한 다음에 만들 수 있어요.');
    }

    const spent = await this.currency.spend(userId, VILLAGE_ITEM_COST);
    if (!spent.ok) throw new HttpException('잉크가 모자라요.', 402);

    await this.items.markPending(id, entry.id);
    void this.generate(id, userId, row.word, entry.text);
    return this.toJson(userId, { ...row, status: 'pending', sourceEntryId: entry.id });
  }

  /** 뒤에서 도는 부분. 실패는 여기서 끝내고 잉크를 돌려준다(요청은 이미 응답했다). */
  private async generate(id: string, userId: string, word: string, definition: string): Promise<void> {
    try {
      const { png } = await this.image.create(word, definition);
      const url = await this.storage.putPng(`village-items/${id}.png`, png);
      const entry = await this.items.latestEntry(userId, word);
      await this.items.markReady(id, url, entry?.id ?? '');
    } catch (err) {
      this.log.warn(`아이템 생성 실패 ${id}: ${String(err)}`);
      await this.items.markFailed(id);
      await this.currency.refund(userId, VILLAGE_ITEM_COST);
    }
  }

  private async toJson(userId: string, row: ItemRow): Promise<ItemJson> {
    const entry = await this.items.latestEntry(userId, row.word);
    return {
      id: row.id,
      word: row.word,
      status: row.status,
      imageUrl: row.imageUrl,
      definition: entry?.text ?? '',
      savedAt: (entry?.savedAt ?? new Date()).toISOString(),
    };
  }
}
```

- [ ] **Step 4: 컨트롤러·모듈 배선**

`village.controller.ts` 에 추가(기존 `neighbors` 아래):

```ts
  /** GET /api/village/items?userId= — 그 집의 물건들(없으면 내 집). */
  @Get('items')
  house(
    @Req() req: { user: { userId: string } },
    @Query('userId') userId?: string,
  ): Promise<HouseResponse> {
    return this.items.house(userId ?? req.user.userId);
  }

  /** GET /api/village/items/makeable — 아직 물건이 없는 내 단어들. */
  @Get('items/makeable')
  makeable(@Req() req: { user: { userId: string } }) {
    return this.items.makeableWords(req.user.userId);
  }

  /** POST /api/village/items — 잉크 쓰고 물건 만들기 시작. */
  @Post('items')
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateItemDto): Promise<ItemJson> {
    return this.items.create(req.user.userId, dto.word);
  }

  /** POST /api/village/items/:id/regenerate — 다시 정의했을 때만. */
  @Post('items/:id/regenerate')
  regenerate(@Req() req: { user: { userId: string } }, @Param('id') id: string): Promise<ItemJson> {
    return this.items.regenerate(req.user.userId, id);
  }
```

`village.module.ts` providers에 추가:

```ts
    ItemService,
    ItemImageClient,
    ItemStorage,
    { provide: ItemRepository, useClass: PrismaItemRepository },
```

- [ ] **Step 5: 빌드 + 서버 기동**

```bash
source ~/.nvm/nvm.sh && cd back && npm run build && node dist/main
```

Expected: 라우트 로그에 `/api/village/items`, `/api/village/items/makeable`, `/api/village/items/:id/regenerate` 3개가 찍힌다.

- [ ] **Step 6: curl E2E**

```bash
# 토큰
T=$(curl -s -X POST localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"village-qa@define.local","password":"test1234!"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# 정의 없는 단어 → 400
curl -s -o /dev/null -w "없는단어 %{http_code}\n" -X POST localhost:3000/api/village/items \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"word":"존재하지않는단어"}'

# 정의 하나 심고 만들기 → 200, status=pending
curl -s -X POST localhost:3000/api/journal/import -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' \
  -d '{"entries":[{"clientId":"item-1","word":"행복","text":"평일 저녁 같은 것","savedAt":"2026-09-20T00:00:00.000Z"}]}' > /dev/null
curl -s -X POST localhost:3000/api/village/items -H "Authorization: Bearer $T" \
  -H 'Content-Type: application/json' -d '{"word":"행복"}'

# 같은 단어 또 → 409
curl -s -o /dev/null -w "중복 %{http_code}\n" -X POST localhost:3000/api/village/items \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"word":"행복"}'

# 40초 뒤 ready인지
sleep 40 && curl -s "localhost:3000/api/village/items" -H "Authorization: Bearer $T"
```

Expected: 없는단어 `400` / 만들기 응답 `"status":"pending"` / 중복 `409` / 40초 뒤 `"status":"ready"` 와 `imageUrl`이 CloudFront 주소.

- [ ] **Step 7: 잉크 차감·환불 확인**

```bash
# 잔액 확인 → 만들기 → 50 줄었는지
curl -s localhost:3000/api/auth/me -H "Authorization: Bearer $T" 2>/dev/null || \
  docker exec define-db psql -U define -d define -c \
  "select email, balance from \"User\" where email='village-qa@define.local';"
```

Expected: 만들기 전후로 `balance`가 정확히 50 줄어 있다.
환불 확인은 `S3_BUCKET`을 잠깐 빈 값으로 두고 서버를 띄워 만들기를 시도한다 → `status=failed`가 되고 잔액이 되돌아온다.

- [ ] **Step 8: 커밋**

```bash
git add back/src/modules/village
git commit -m "feat(village): 아이템 API — 잉크 차감 후 비동기 생성, 실패 시 환불

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 마을 탭을 Stack으로 — 집 안으로 들어가기

**Files:**
- Create: `front/mobile/src/app/(tabs)/village/_layout.tsx`
- Move: `front/mobile/src/app/(tabs)/village.tsx` → `front/mobile/src/app/(tabs)/village/index.tsx`
- Create: `front/mobile/src/app/(tabs)/village/house/[userId].tsx` (이번 태스크에선 뼈대만)

**Interfaces:**
- Produces: 라우트 `/village/house/<userId>` (마을 탭 안에서 push — 뒤로 가면 마을 그대로)

- [ ] **Step 1: Stack 레이아웃 만들기**

`front/mobile/src/app/(tabs)/village/_layout.tsx` — 단어장 탭과 같은 방식:

```tsx
/**
 * 마을 탭 안의 Stack — 마을(index) 위에 집 안 화면을 push한다.
 * 탭을 벗어나지 않아야 뒤로 갔을 때 마을이 그대로 남는다(단어장 탭과 같은 구조).
 */
import { Stack } from 'expo-router';

export default function VillageStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: 화면 파일 옮기기**

```bash
cd front/mobile/src/app/\(tabs\)
git mv village.tsx village/index.tsx
```

- [ ] **Step 3: 집 안 화면 뼈대**

`village/house/[userId].tsx`:

```tsx
/**
 * 집 안 — 그 사람이 단어로 만든 물건들이 진열된 방.
 * 마을에서 문 앞 "들어가기"로 들어온다. (설계: docs/superpowers/specs/2026-09-20-village-items-design.md)
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

export default function HouseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();

  return (
    <ThemedView bg="paper" style={styles.root}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Icon name="back" size={22} color={theme.colors.ink.strong} />
        </Pressable>
        <ThemedText variant="h3">집 안</ThemedText>
        <View style={styles.back} />
      </View>
      <ThemedText variant="caption" tone="placeholder" style={{ textAlign: 'center' }}>
        {userId}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 4: 마을에서 push 하도록 연결**

`village/index.tsx` 의 `enterHouse()` 를 교체:

```tsx
  function enterHouse() {
    if (!nearSlot) return;
    const neighbor = bySlot[nearSlot];
    if (neighbor) router.push(`/village/house/${neighbor.id}`);
  }
```

같은 파일 상단에 `import { useRouter } from 'expo-router';` 를 추가하고 컴포넌트 안에 `const router = useRouter();`. 더 이상 쓰지 않는 `NeighborSheet`·`sheet` 상태는 **지운다**(집 안 화면이 대신한다).

- [ ] **Step 5: 타입·번들 확인**

```bash
source ~/.nvm/nvm.sh && cd front/mobile && npx tsc --noEmit && npx expo export --platform web 2>&1 | tail -5
```

Expected: 에러 0. 라우트 목록에 `/village/house/[userId]` 가 보인다.

- [ ] **Step 6: 브라우저 확인**

레포 루트에서 `./dev-web.sh` 로 띄우고 `http://localhost:8081/village` — 조이스틱으로 집 문 앞까지 가서 "들어가기" → **화면이 바뀌고** 뒤로가기를 누르면 마을이 그대로 남아 있는지.

- [ ] **Step 7: 커밋**

```bash
git add front/mobile/src/app/\(tabs\)/village
git commit -m "feat(village): 마을 탭을 Stack으로 — 집 안 화면으로 들어가기

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 방 그림 + 진열 화면

**Files:**
- Create: `front/mobile/src/data/village-rooms.ts`
- Create: `front/mobile/src/components/village/room-scene.tsx`
- Create: `front/mobile/src/services/village-items-api.ts`
- Modify: `front/mobile/src/app/(tabs)/village/house/[userId].tsx`
- Assets: `front/mobile/assets/village/room-1.png` ~ `room-3.png` (**사용자가 생성해 넣어줌**)

**Interfaces:**
- Consumes: `GET /api/village/items?userId=`
- Produces: `ROOMS: Record<number, { background: ImageSourcePropType; slots: Point[] }>` (슬롯 12개), `RoomScene`

- [ ] **Step 1: API 함수**

`village-items-api.ts`:

```ts
/** 집 안 물건들. village-api와 같은 패턴(Bearer + apiRequest). */
import { apiRequest } from './api-client';

export type VillageItem = {
  id: string;
  word: string;
  status: 'pending' | 'ready' | 'failed';
  imageUrl: string | null;
  definition: string;
  savedAt: string;
};

export type House = { roomVariant: number; items: VillageItem[] };

/** userId가 'me'면 서버가 본인 집을 준다(쿼리를 아예 안 붙인다). */
export function getHouse(token: string, userId: string): Promise<House> {
  const q = userId === 'me' ? '' : `?userId=${encodeURIComponent(userId)}`;
  return apiRequest<House>(`/village/items${q}`, { method: 'GET', token });
}
```

`apiRequest`의 시그니처는 `apiRequest<T>(path, { method, body?, token? })` 이다(`src/services/api-client.ts`).
`method`는 **생략할 수 없다.**

- [ ] **Step 2: 방 데이터**

`village-rooms.ts` — 슬롯 12개는 **그림을 보고 찍는다**. 그림이 아직 없으면 아래 균등 배치로 시작하고, 그림이 들어온 뒤 Task 6-7에서 다시 찍는다.

```ts
/**
 * 집 안 방 — 그림 3종과 진열 자리 12칸.
 * 좌표는 마을과 같은 0~1 비율(그림 기준). 물건은 이 자리에 발밑이 오도록 얹는다.
 */
import type { ImageSourcePropType } from 'react-native';

export type Point = { x: number; y: number };

/** 한 화면에 보이는 진열 자리 수. 넘으면 다음 페이지. */
export const SLOTS_PER_PAGE = 12;

const GRID: Point[] = [0, 1, 2].flatMap((row) =>
  [0, 1, 2, 3].map((col) => ({ x: 0.16 + col * 0.23, y: 0.34 + row * 0.2 })),
);

export const ROOMS: Record<number, { background: ImageSourcePropType; slots: Point[] }> = {
  1: { background: require('../../assets/village/room-1.png'), slots: GRID },
  2: { background: require('../../assets/village/room-2.png'), slots: GRID },
  3: { background: require('../../assets/village/room-3.png'), slots: GRID },
};

export const roomOf = (variant: number) => ROOMS[variant] ?? ROOMS[1];
```

- [ ] **Step 3: 진열 화면 컴포넌트**

`room-scene.tsx` — 마을 씬과 같은 `containFit` 방식으로 그림을 깔고, 슬롯 좌표에 물건과 이름표를 얹는다.

```tsx
/**
 * RoomScene — 방 그림 위에 물건을 진열한다.
 * 좌표 환산은 마을(village-scene)과 같은 방식: 그림이 놓인 사각형을 구해 비율 좌표를 px로 편다.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { roomOf, SLOTS_PER_PAGE } from '@/data/village-rooms';
import type { VillageItem } from '@/services/village-items-api';
import { useTheme } from '@/theme';

type Props = {
  roomVariant: number;
  items: VillageItem[];
  page: number;
  onTapItem: (item: VillageItem) => void;
};

export function RoomScene({ roomVariant, items, page, onTapItem }: Props) {
  const theme = useTheme();
  const room = roomOf(roomVariant);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boardRef = useRef<View>(null);

  // 웹에서 onLayout이 안 오는 경우가 있어 직접 잰다(마을에서 겪은 문제와 같다).
  useEffect(() => {
    const id = setTimeout(() => {
      boardRef.current?.measureInWindow((_x, _y, w, h) => {
        if (w > 0 && h > 0) setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    }, 0);
    return () => clearTimeout(id);
  });

  const fit = useMemo(() => {
    const src = Image.resolveAssetSource
      ? Image.resolveAssetSource(room.background as ImageSourcePropType)
      : (room.background as { width?: number; height?: number });
    if (!src?.width || !src?.height) return { w: box.w, h: box.h, x: 0, y: 0 };
    const scale = Math.min(box.w / src.width, box.h / src.height);
    const w = src.width * scale;
    const h = src.height * scale;
    return { w, h, x: (box.w - w) / 2, y: (box.h - h) / 2 };
  }, [room.background, box]);

  const visible = items.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE);
  const size = Math.round(fit.w * 0.17);

  return (
    <View ref={boardRef} style={styles.board}>
      <Image
        source={room.background}
        style={{ position: 'absolute', left: fit.x, top: fit.y, width: fit.w, height: fit.h }}
        resizeMode="stretch"
      />
      {visible.map((item, i) => {
        const slot = room.slots[i];
        if (!slot) return null;
        const left = fit.x + slot.x * fit.w - size / 2;
        const top = fit.y + slot.y * fit.h - size;
        return (
          <Pressable
            key={item.id}
            onPress={() => onTapItem(item)}
            style={[styles.slot, { left, top, width: size }]}
            accessibilityRole="button"
            accessibilityLabel={`${item.word} 물건`}
          >
            {item.status === 'ready' && item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={{ width: size, height: size }} resizeMode="contain" />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  {
                    width: size,
                    height: size,
                    borderColor: theme.colors.line.base,
                    borderRadius: theme.radii.md,
                  },
                ]}
              >
                <ThemedText variant="caption" tone="placeholder">
                  {item.status === 'pending' ? '만드는 중' : '실패'}
                </ThemedText>
              </View>
            )}
            <View style={[styles.label, { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base }]}>
              <ThemedText variant="caption" tone="strong" numberOfLines={1}>
                {item.word}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, overflow: 'hidden' },
  slot: { position: 'absolute', alignItems: 'center' },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed' },
  label: { marginTop: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
});
```

- [ ] **Step 4: 집 안 화면에 붙이기**

`house/[userId].tsx` 전체를 교체:

```tsx
/**
 * 집 안 — 그 사람이 단어로 만든 물건들이 진열된 방.
 * userId가 'me'면 내 집(서버가 본인 것을 준다).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/primitives';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RoomScene } from '@/components/village/room-scene';
import { SLOTS_PER_PAGE } from '@/data/village-rooms';
import { Icon } from '@/icons';
import { getHouse, type VillageItem } from '@/services/village-items-api';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function HouseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const isMine = userId === 'me';

  const [roomVariant, setRoomVariant] = useState(1);
  const [items, setItems] = useState<VillageItem[]>([]);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<VillageItem | null>(null);

  const load = useCallback(() => {
    if (!token || !userId) return;
    getHouse(token, userId)
      .then((house) => {
        setRoomVariant(house.roomVariant);
        setItems(house.items);
      })
      .catch(() => {
        /* 비치명적 — 빈 방으로 보인다. */
      });
  }, [token, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(items.length / SLOTS_PER_PAGE));

  return (
    <ThemedView bg="paper" style={styles.root}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.icon}>
          <Icon name="back" size={22} color={theme.colors.ink.strong} />
        </Pressable>
        <ThemedText variant="h3">{isMine ? '내 집' : '이웃의 집'}</ThemedText>
        <View style={styles.icon} />
      </View>

      <View style={styles.board}>
        <RoomScene roomVariant={roomVariant} items={items} page={page} onTapItem={setPicked} />
        {items.length === 0 ? (
          <View pointerEvents="none" style={styles.empty}>
            <ThemedText variant="caption" tone="placeholder">
              {isMine ? '첫 물건을 만들어 보세요' : '아직 아무것도 만들지 않았어요'}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {pages > 1 ? (
        <View style={styles.pager}>
          <PressableScale onPress={() => setPage((p) => Math.max(0, p - 1))} hitSlop={10}>
            <Icon name="back" size={20} color={theme.colors.ink.secondary} />
          </PressableScale>
          <ThemedText variant="caption" tone="secondary">
            {page + 1} / {pages}
          </ThemedText>
          <PressableScale onPress={() => setPage((p) => Math.min(pages - 1, p + 1))} hitSlop={10}>
            <View style={{ transform: [{ scaleX: -1 }] }}>
              <Icon name="back" size={20} color={theme.colors.ink.secondary} />
            </View>
          </PressableScale>
        </View>
      ) : null}

      {/* 물건을 누르면 그 단어의 정의 — 시스템 Alert 금지(우리 톤 모달). */}
      <Modal visible={picked !== null} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <Pressable style={styles.scrim} onPress={() => setPicked(null)} />
        <View style={styles.cardWrap} pointerEvents="box-none">
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.paper.base, borderRadius: theme.radii.lg },
              theme.shadows.md,
            ]}
          >
            <ThemedText variant="h3">{picked?.word}</ThemedText>
            <ThemedText variant="body" style={{ marginTop: theme.spacing.s2, lineHeight: 24 }}>
              {picked?.definition}
            </ThemedText>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  board: { flex: 1 },
  empty: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 10 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  cardWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  card: { padding: 20 },
});
```

- [ ] **Step 5: 타입·번들 확인**

```bash
source ~/.nvm/nvm.sh && cd front/mobile && npx tsc --noEmit && npx expo export --platform web 2>&1 | tail -3
```

- [ ] **Step 6: 브라우저 확인**

Task 4에서 만들어 둔 "행복" 물건이 내 집에 **선반 위에 놓이고**, 밑에 이름표가 보이고, 누르면 정의가 뜨는지. 물건이 13개 이상일 때 페이지가 넘어가는지(임시로 seed를 늘려 확인).

- [ ] **Step 7: 커밋**

```bash
git add front/mobile/src/data/village-rooms.ts front/mobile/src/components/village/room-scene.tsx \
        front/mobile/src/services/village-items-api.ts front/mobile/src/app/\(tabs\)/village/house
git commit -m "feat(village): 집 안 진열 화면 — 방 그림 위 물건 12칸 + 이름표

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 내 집 — 마을 중앙 고정 슬롯 + 문 앞 표식

**Files:**
- Modify: `front/mobile/src/data/village-zones.ts`
- Modify: `front/mobile/src/app/(tabs)/village/index.tsx`
- Modify: `front/mobile/src/components/village/village-scene.tsx`
- Modify: `front/mobile/scripts/check-village.mjs`

**Interfaces:**
- Produces: `Zone.slots[].isMine?: boolean` (중앙 맵의 빨간 지붕 집 한 칸), 문 앞 팻말·바닥 빛 렌더

- [ ] **Step 1: 데이터에 내 집 표시**

`village-zones.ts` 중앙 맵 슬롯 중 `center-red` 를 내 집으로:

```ts
      { id: 'center-red', door: { x: 0.49, y: 0.69 }, isMine: true },
```

`Zone` 타입의 slots에 `isMine?: boolean` 추가. 주석:

```ts
  /** 집 — door는 문 앞. isMine이면 내 집(이웃을 앉히지 않고, 문 앞에 팻말이 선다). */
```

- [ ] **Step 2: 이웃 배정에서 내 집 제외**

`village/index.tsx` 의 `assign()` 과 `TOTAL_SLOTS` 를 내 집 제외로:

```ts
const NEIGHBOR_SLOTS = ZONE_ORDER.flatMap((id) => ZONES[id].slots.filter((s) => !s.isMine));
const TOTAL_SLOTS = NEIGHBOR_SLOTS.length;

function assign(list: VillageNeighbor[]): Record<string, VillageNeighbor> {
  const out: Record<string, VillageNeighbor> = {};
  NEIGHBOR_SLOTS.forEach((slot, i) => {
    const neighbor = list[i];
    if (neighbor) out[slot.id] = neighbor;
  });
  return out;
}
```

- [ ] **Step 3: 문 앞 표식 렌더**

`village-scene.tsx` 에 내 집 슬롯을 그리는 부분 추가(배경 위, 아바타 아래):

```tsx
      {zone.slots
        .filter((s) => s.isMine)
        .map((s) => (
          <View
            key={s.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: fit.offX + s.door.x * fit.dispW - 14,
              top: fit.offY + s.door.y * fit.dispH - 10,
              width: 28,
              height: 20,
              alignItems: 'center',
            }}
          >
            {/* 바닥 빛 — 은은하게(브랜드 톤: 요란한 표식 금지) */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                width: 26,
                height: 10,
                borderRadius: 5,
                backgroundColor: 'rgba(255, 214, 120, 0.45)',
              }}
            />
            {/* 팻말 */}
            <View style={{ width: 3, height: 12, backgroundColor: '#6B4A2B' }} />
            <View
              style={{
                position: 'absolute',
                top: 0,
                width: 18,
                height: 9,
                borderRadius: 2,
                backgroundColor: '#C89B62',
                borderWidth: 1,
                borderColor: '#6B4A2B',
              }}
            />
          </View>
        ))}
```

- [ ] **Step 4: 내 집에 들어가면 내 방으로**

`enterHouse()` 를 내 집 분기까지:

```tsx
  function enterHouse() {
    if (!nearSlot) return;
    const slot = zone.slots.find((s) => s.id === nearSlot);
    if (slot?.isMine) {
      router.push('/village/house/me');
      return;
    }
    const neighbor = bySlot[nearSlot];
    if (neighbor) router.push(`/village/house/${neighbor.id}`);
  }
```

`house/[userId].tsx` 는 `userId === 'me'` 이면 내 것으로 조회한다(서버는 `userId` 생략 시 본인을 준다 — Task 4 참고).
문 앞 버튼 문구도 내 집이면 "내 집 들어가기"로.

- [ ] **Step 5: 검증 스크립트 갱신**

`check-village.mjs` 에 한 줄 추가 — 내 집이 정확히 하나이고 중앙에 있는지:

```js
const mine = ZONE_ORDER.flatMap((z) => ZONES[z].slots.filter((s) => s.isMine));
ok('내 집은 중앙 맵에 정확히 하나', mine.length === 1, `${mine.length}개`);
```

- [ ] **Step 6: 검증 실행**

```bash
source ~/.nvm/nvm.sh && cd front/mobile
npx tsc --noEmit
node --experimental-strip-types scripts/check-village.mjs
```

Expected: 전부 PASS(내 집 1개 포함). 이웃 슬롯 합계가 이전보다 하나 줄어 있다.

- [ ] **Step 7: 브라우저 확인**

중앙 마을 빨간 지붕 집 문 앞에 **팻말과 바닥 빛**이 보이고, 가까이 가면 "내 집 들어가기"가 뜨고, 들어가면 내 물건이 보이는지.

- [ ] **Step 8: 커밋**

```bash
git add front/mobile/src/data/village-zones.ts front/mobile/src/app/\(tabs\)/village/index.tsx \
        front/mobile/src/components/village/village-scene.tsx front/mobile/scripts/check-village.mjs
git commit -m "feat(village): 중앙 마을에 내 집 — 문 앞 팻말·바닥 빛, 이웃 배정에서 제외

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 물건 만들기 흐름

**Files:**
- Create: `front/mobile/src/components/village/make-item-sheet.tsx`
- Modify: `front/mobile/src/services/village-items-api.ts`
- Modify: `front/mobile/src/app/(tabs)/village/house/[userId].tsx`

**Interfaces:**
- Consumes: `GET /api/village/items/makeable`, `POST /api/village/items`, `POST /api/village/items/:id/regenerate`
- Produces: 만들기 시트 + pending 폴링

- [ ] **Step 1: API 함수 추가**

`village-items-api.ts` 에:

```ts
export type MakeableWord = { word: string; entryId: string; text: string };

export function getMakeableWords(token: string): Promise<MakeableWord[]> {
  return apiRequest<MakeableWord[]>('/village/items/makeable', { token });
}

export function createItem(token: string, word: string): Promise<VillageItem> {
  return apiRequest<VillageItem>('/village/items', { token, method: 'POST', body: { word } });
}

export function regenerateItem(token: string, id: string): Promise<VillageItem> {
  return apiRequest<VillageItem>(`/village/items/${id}/regenerate`, { token, method: 'POST' });
}
```

- [ ] **Step 2: 단어 고르기 시트**

`make-item-sheet.tsx` — `neighbor-sheet.tsx`의 Modal·scrim 패턴을 그대로 따른다:

```tsx
/**
 * MakeItemSheet — 아직 물건이 없는 내 단어 중 하나를 골라 물건을 만든다.
 * 잉크를 쓰는 행동이라 값(50)을 화면에 분명히 적는다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { MakeableWord } from '@/services/village-items-api';
import { Icon } from '@/icons';
import { useTheme } from '@/theme';

type Props = {
  visible: boolean;
  words: MakeableWord[];
  cost: number;
  onPick: (word: string) => void;
  onClose: () => void;
};

export function MakeItemSheet({ visible, words, cost, onPick, onClose }: Props) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.paper.base,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
          },
        ]}
        onStartShouldSetResponder={() => true}
      >
        <View style={styles.handle} />
        <View style={styles.head}>
          <ThemedText variant="h3">어떤 단어로 만들까요</ThemedText>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={20} color={theme.colors.ink.secondary} />
          </Pressable>
        </View>
        <ThemedText variant="caption" tone="placeholder">
          하나에 {cost}잉크가 들어요
        </ThemedText>

        <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
          {words.length === 0 ? (
            <ThemedText variant="body" tone="secondary">
              물건으로 만들 수 있는 단어가 없어요. 먼저 단어를 기록해 보세요.
            </ThemedText>
          ) : (
            words.map((w) => (
              <Pressable
                key={w.word}
                onPress={() => onPick(w.word)}
                style={[
                  styles.row,
                  { backgroundColor: theme.colors.surface.base, borderColor: theme.colors.line.base, borderRadius: theme.radii.lg },
                ]}
              >
                <ThemedText variant="bodyMd" tone="strong">
                  {w.word}
                </ThemedText>
                <ThemedText variant="body" numberOfLines={1} style={{ marginTop: 2 }}>
                  {w.text}
                </ThemedText>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#00000022', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16 },
});
```

- [ ] **Step 3: 집 안 화면에 만들기 버튼(내 집만)**

`house/[userId].tsx` 에 상태와 버튼을 추가한다:

```tsx
  const [makeable, setMakeable] = useState<MakeableWord[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function openMake() {
    if (!token) return;
    getMakeableWords(token)
      .then((list) => {
        setMakeable(list);
        setSheetOpen(true);
      })
      .catch(() => setNotice('목록을 불러오지 못했어요'));
  }

  function make(word: string) {
    if (!token) return;
    setSheetOpen(false);
    createItem(token, word)
      .then((item) => setItems((prev) => [...prev, item]))
      .catch((err: { status?: number }) => {
        setNotice(err?.status === 402 ? '잉크가 모자라요' : '물건을 만들지 못했어요');
      });
  }
```

렌더 하단(페이저 아래)에:

```tsx
      {isMine ? (
        <View style={styles.makeWrap}>
          <PressableScale
            onPress={openMake}
            style={[
              styles.make,
              { backgroundColor: theme.colors.point.p500, borderRadius: theme.radii.pill },
              theme.shadows.sm,
            ]}
            accessibilityRole="button"
            accessibilityLabel="새 물건 만들기"
          >
            <ThemedText variant="bodyMd" style={{ color: theme.colors.paper.base }}>
              새 물건 만들기 · 50잉크
            </ThemedText>
          </PressableScale>
          {notice ? (
            <ThemedText variant="caption" tone="secondary" style={{ marginTop: 6 }}>
              {notice}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <MakeItemSheet
        visible={sheetOpen}
        words={makeable}
        cost={50}
        onPick={make}
        onClose={() => setSheetOpen(false)}
      />
```

스타일에 추가:

```tsx
  makeWrap: { alignItems: 'center', paddingBottom: 18 },
  make: { paddingVertical: 12, paddingHorizontal: 22 },
```

- [ ] **Step 4: 폴링**

pending이 하나라도 있으면 5초마다 `getHouse` 재호출, 전부 ready/failed면 멈춘다. 화면을 벗어나면 정리한다:

```tsx
  useEffect(() => {
    if (!items.some((i) => i.status === 'pending')) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [items, load]);
```

- [ ] **Step 5: 실패 표시**

`room-scene.tsx` 의 placeholder 문구를 실패까지 구분하게 고친다(Step 3에서 이미 402는 인라인 안내로 처리했다):

```tsx
                <ThemedText variant="caption" tone="placeholder" style={{ textAlign: 'center' }}>
                  {item.status === 'pending' ? '만드는 중' : '실패 · 잉크는\n돌려드렸어요'}
                </ThemedText>
```

실패한 자리를 누르면 `regenerateItem`으로 다시 시도할 수 있게 `onTapItem`에서 분기한다:

```tsx
  function tapItem(item: VillageItem) {
    if (item.status === 'failed' && isMine && token) {
      regenerateItem(token, item.id)
        .then(() => load())
        .catch(() => setNotice('다시 만들지 못했어요'));
      return;
    }
    setPicked(item);
  }
```

- [ ] **Step 6: 검증**

```bash
source ~/.nvm/nvm.sh && cd front/mobile && npx tsc --noEmit
```

브라우저에서: 내 집 → 새 물건 만들기 → 단어 선택 → **잉크가 50 줄고** 자리에 "만드는 중"이 생기고, 30초 안팎에 **물건으로 바뀌는지**. 잉크를 0으로 만들어 두고 시도하면 "잉크가 모자라요"가 뜨는지.

- [ ] **Step 7: 커밋**

```bash
git add front/mobile/src/components/village/make-item-sheet.tsx \
        front/mobile/src/services/village-items-api.ts \
        front/mobile/src/app/\(tabs\)/village/house
git commit -m "feat(village): 물건 만들기 — 단어 고르기·잉크 차감·만드는 중 폴링

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: 문서·회귀

**Files:**
- Modify: `docs/DEVELOPMENT.md`, `docs/PLANNING.md`

- [ ] **Step 1: 작업 로그**

`DEVELOPMENT.md` 작업 로그 맨 위에 항목 추가 — 무엇을/왜/검증 결과/남은 것. `§0` 완성 목록과 `§4` 화면 표도 갱신.
`PLANNING.md` 에는 잉크 가격과 "다시 만들기" 정책을 BM 관점에서 한 줄.

- [ ] **Step 2: 회귀 확인**

```bash
source ~/.nvm/nvm.sh
cd front/mobile && npx tsc --noEmit && node --experimental-strip-types scripts/check-village.mjs
cd ../../back && npm run build
```

- [ ] **Step 3: 커밋**

```bash
git add docs
git commit -m "docs(village): 아이템 기능 작업 로그

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## 사용자가 해줘야 하는 것 (Task 6 전까지)

방 그림 **3장**. 프롬프트는 대화에 있다. 파일명:
`front/mobile/assets/village/room-1.png`, `room-2.png`, `room-3.png`
