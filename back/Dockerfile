# define API 컨테이너 이미지 — ECR에 올려 AWS App Runner가 실행한다.
# (docs/AWS-MIGRATION-PLAN.md Phase 2)
#
# 멀티스테이지: build 단계에서만 devDependencies(nest cli·typescript)를 쓰고,
# 최종 이미지에는 prod 의존성 + dist/ 만 남긴다 → 이미지가 작아지고 공격면도 준다.
#
# ⚠️ App Runner는 x86_64만 실행한다. 애플 실리콘 맥에서 그냥 빌드하면 arm64 이미지가 나오므로
#    ECR에 올릴 이미지는 반드시 플랫폼을 고정할 것:
#      docker build --platform linux/amd64 -t define-api .
#    (로컬에서 돌려보기만 할 땐 플랫폼 없이 빌드하는 게 빠르다.)

# ─── 1) build: 타입스크립트 → dist/ ───────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

# Prisma 쿼리 엔진이 libssl을 필요로 한다 (slim 이미지엔 없음).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# package.json 먼저 복사 → 소스만 바뀌면 npm ci 레이어를 캐시에서 재사용.
# schema.prisma는 postinstall의 `prisma generate`가 읽으므로 함께 복사한다.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# 단어 시드도 미리 컴파일해 둔다.
# ts-node는 devDependency라 최종 이미지에 없다 — 여기서 JS로 만들어 두면
# 운영 컨테이너가 node만으로 시드를 돌릴 수 있다(이미지도 안 커진다).
RUN npx tsc prisma/seed-words-sync.ts prisma/seed-words.ts prisma/seed-showcase.ts \
      --outDir dist-seed --module commonjs --target es2022 \
      --esModuleInterop --skipLibCheck

# ─── 2) run: 실제로 배포되는 이미지 ───────────────────────────────────
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# prisma CLI가 dependencies에 있어 --omit=dev 후에도 migrate deploy를 쓸 수 있다.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed

# root 대신 node 유저로 실행 (기본 제공 유저).
USER node

EXPOSE 3000

# 컨테이너가 뜰 때마다 미적용 마이그레이션을 반영한 뒤 서버 시작.
# 뜰 때마다: 미적용 마이그레이션 반영 → 단어 풀 동기화 → 서버 시작.
# 시드는 멱등이라(있으면 갱신, 없으면 추가, 빠진 건 비활성) 매번 돌려도 안전하고,
# 덕분에 단어를 늘리는 일이 "seed-words.ts 고치고 배포"로 끝난다.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-seed/seed-words-sync.js && node dist/main"]
