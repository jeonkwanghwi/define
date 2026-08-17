# AWS 이관 계획 (Path B: App Runner + RDS + S3/CloudFront)

> define 스테이징/운영을 **AWS**로 이관하는 실행 계획. Railway(임시)에서 종착 인프라로.
> 대상 독자: AWS를 처음 담당하는 사람 → 각 단계에 **개념 한 줄 + 우리 앱 기준 작업 + 검증**을 붙였다.
> 결정 근거·경로 비교는 DEVELOPMENT.md 작업 로그(2026-08-17) 참조.

---

## 0. 우리 앱은 뭘 필요로 하나 (실측 요약)

| 덩어리 | 실체 | AWS로 가면 |
|---|---|---|
| 프론트엔드 | Expo **웹 정적 빌드**(`expo export` → `dist/`) | **S3 + CloudFront** |
| 백엔드 | **NestJS**(무상태 Node API, `/api`, JWT, bcrypt, OpenAI 호출) | **App Runner**(컨테이너) |
| DB | SQLite 148KB(작음), 마이그레이션 11개 | **RDS PostgreSQL** |
| 시크릿 | `JWT_SECRET`·`OPENAI_API_KEY`·`DATABASE_URL` | **SSM Parameter Store** |
| 이메일(미래) | 없음(아직) | **SES** |

**특징**: 파일 업로드·웹소켓·크론이 **없음** → 백엔드가 완전 무상태라 컨테이너 오토스케일에 이상적. 옮길 실데이터도 없음(Railway DB는 무료체험 만료로 소실 → **새 출발**).

---

## 목표 아키텍처

```
        [사용자 / 팀원 브라우저]
                 │ https
                 ▼
        ┌──────────────────┐        ┌─────────────────────┐
        │   CloudFront     │──오리진→│  S3 (정적 프론트 dist) │
        │  (CDN + HTTPS)   │        └─────────────────────┘
        └──────────────────┘
   프론트: app.define... (또는 CloudFront 도메인)

        [브라우저] ──/api/*──► ┌──────────────────┐
                              │   App Runner     │  NestJS 컨테이너
                              │ (HTTPS·오토스케일) │  (min 1 인스턴스)
                              └────────┬─────────┘
                                       │ VPC 커넥터
                                       ▼
                              ┌──────────────────┐
                              │  RDS PostgreSQL  │  관리형 DB
                              └──────────────────┘
   시크릿: SSM Parameter Store → App Runner가 주입
```

**도메인 전략**: 프론트(CloudFront)와 API(App Runner)를 **서로 다른 주소**로 둔다(현재 Railway와 동일 패턴 — 프론트 URL / API URL 분리). 그래서 **CORS 필요**(우리 이미 있음). 나중에 한 도메인으로 합치려면 CloudFront가 `/api/*`를 App Runner로 프록시하는 구성으로 CORS 제거 가능(선택).

**리전**: `ap-northeast-2`(서울) 권장. ⚠️ **단, CloudFront용 ACM 인증서만은 `us-east-1`(버지니아)에서 발급해야 함**(CloudFront의 규칙) — 나머지는 전부 서울.

---

## Phase 0 — 계정·도구 준비

**개념**: **IAM** = "누가 무엇을 할 수 있는가". root 계정(가입 이메일)은 금고에 넣어두고, 일상 작업은 IAM 사용자로.

- [ ] AWS 계정 생성 → **root에 MFA(2단계) 켜기**, 이후 root 사용 안 함
- [ ] **IAM 사용자** 1개 생성(콘솔+CLI 접근). 처음엔 `AdministratorAccess`로 시작하고, 익숙해지면 최소권한으로 좁히기(학습 과제)
- [ ] **AWS CLI** 설치 + `aws configure`(액세스 키, 리전 `ap-northeast-2`)
- [ ] 리전 하나로 통일(서울). CloudFront/ACM 예외만 기억

**검증**: `aws sts get-caller-identity` 가 내 IAM 사용자 반환.

---

## Phase 1 — DB: RDS PostgreSQL

**개념**: **RDS** = 관리형 관계형 DB(백업·패치·장애복구를 AWS가 해줌). **보안그룹** = 인스턴스 앞단 방화벽(누가 접속 가능한지).

- [ ] RDS **PostgreSQL** 인스턴스 생성 — `db.t4g.micro`(프리티어 대상, 12개월 무료), 스토리지 20GB, 단일 AZ(스테이징이라 충분)
- [ ] 초기엔 **퍼블릭 액세스 ON**(로컬에서 마이그레이션 편하게) + 보안그룹에 **내 IP만** 인바운드 5432 허용. 운영 굳으면 프라이빗으로
- [ ] Prisma를 Postgres로 전환:
  - `schema.prisma`의 `datasource db { provider = "postgresql" }`
  - **⚠️ 마이그레이션 재베이스라인**: SQLite 마이그레이션 히스토리는 Postgres에서 재생 불가 → `prisma/migrations` 폴더를 백업 후 비우고, Postgres를 향해 `npx prisma migrate dev --name init`로 **새 초기 마이그레이션 1개** 생성(현재 스키마 그대로 반영). 운영 배포는 `prisma migrate deploy`.
  - `DATABASE_URL="postgresql://user:pw@<rds-endpoint>:5432/define?schema=public"`
- [ ] seed 필요하면 `npm run db:seed` / `db:seed:plaza`(광장 데모)

**검증**: 로컬에서 `DATABASE_URL=<rds>` 로 `prisma migrate deploy` 성공 + `prisma studio`나 curl로 테이블 확인. (SQLite→Postgres 전환 후 로컬 백엔드가 RDS 붙어 회원가입 curl 통과하면 완벽.)

---

## Phase 2 — 백엔드: 컨테이너 → ECR → App Runner

**개념**:
- **컨테이너(Docker)** = 앱 + 런타임(node)을 한 상자에 봉인 → "내 컴퓨터에선 됐는데" 방지.
- **ECR** = AWS의 프라이빗 도커 이미지 저장소.
- **App Runner** = 그 이미지를 받아 **자동으로 실행·HTTPS·오토스케일**해주는 매니지드 서비스(서버 관리 X). ECS보다 훨씬 쉬움 — 학습 입문에 딱.

- [ ] `back/Dockerfile` 작성(멀티스테이지: build → run):
  - build: `npm ci` → `npx prisma generate` → `npm run build`
  - run: `dist/` + `node_modules` 복사, `CMD ["sh","-c","npx prisma migrate deploy && node dist/main"]`
  - `.node-version` 없으니 베이스 이미지 **node:20-slim**(또는 22)로 고정
  - ⚠️ Prisma는 런타임에 **쿼리 엔진 바이너리** 필요 → `prisma generate`가 이미지 안에서 돌아야 함(위 build 단계 포함). slim 이미지면 `openssl` 설치 필요할 수 있음
- [ ] ECR 리포 생성 → 이미지 빌드·태그·`docker push`
- [ ] **App Runner 서비스** 생성:
  - 소스 = ECR 이미지, 포트 **3000**, 헬스체크 경로 `/api`(또는 가벼운 헬스 엔드포인트 신설 권장)
  - **환경변수/시크릿**: `PORT=3000`, 그리고 `JWT_SECRET`·`OPENAI_API_KEY`·`DATABASE_URL`은 **SSM Parameter Store**(SecureString)에 넣고 App Runner에서 참조
  - **RDS 연결**: RDS가 프라이빗이면 App Runner **VPC 커넥터** 필요(App Runner→VPC 내부 RDS). 퍼블릭 RDS면 커넥터 없이도 되지만 보안그룹에 App Runner 아웃바운드 고려
  - **CORS**: `main.ts`의 `origin: true` → **프론트 도메인 화이트리스트**로 변경(운영)
- [ ] ⚠️ **`JWT_SECRET` 강한 값**으로 주입(폴백 `dev-secret-change-me` 절대 금지 — 토큰 위조 뚫림)

**검증**: App Runner가 준 `https://xxx.ap-northeast-2.awsapprunner.com` 에 curl로 회원가입(201)→로그인(200)→`/api/journal` 계약 통과. (Railway 때 쓰던 curl 6스텝 재활용.)

**학습 팁**: 급하면 App Runner의 **소스(GitHub) 배포**(Dockerfile 없이 Node 런타임 자동빌드)도 가능하지만, 컨테이너를 직접 다뤄보는 게 회사에서 쓸 근육이라 Dockerfile+ECR 권장.

---

## Phase 3 — 프론트: S3 + CloudFront

**개념**: **S3** = 파일 저장소(정적 사이트 호스팅 가능). **CloudFront** = 그 파일을 전세계 엣지에서 캐시 + **HTTPS** 붙여 빠르게 서빙하는 CDN.

- [ ] 프론트 빌드: `EXPO_PUBLIC_API_URL=https://<app-runner>/api` 를 **빌드 타임**에 주입하고 `npx expo export --platform web` → `dist/`
  - ⚠️ `EXPO_PUBLIC_*` 는 **빌드 시점에 번들에 박힘**(런타임 주입 아님). API 주소 바뀌면 재빌드.
- [ ] **S3 버킷** 생성(예: `define-web-prod`) → `dist/` 업로드(`aws s3 sync dist s3://...`). 버킷은 비공개로 두고 CloudFront만 접근(OAC)
- [ ] **CloudFront 배포**:
  - 오리진 = S3 버킷(OAC로 잠금), 기본 루트 객체 `index.html`
  - **SPA 폴백**: 403/404 → `/index.html`(200)로 리라이트(Expo Router가 클라 라우팅하므로 모든 경로가 index로 가야 함)
  - TLS: **ACM 인증서(us-east-1 발급)** 연결(커스텀 도메인 쓸 때)
- [ ] 배포 후 캐시 무효화(`aws cloudfront create-invalidation`) — 새 빌드 올릴 때마다

**검증**: CloudFront 도메인 열어서 앱 로딩 + 로그인/단어장/동기화가 App Runner API와 실제로 붙는지(브라우저 네트워크 탭 200) 확인.

---

## Phase 4 — 도메인·TLS·마무리 (선택)

- [ ] 도메인 있으면 **Route 53**에 등록/이관 → 프론트(CloudFront)·API(App Runner) 서브도메인 매핑
- [ ] **ACM** 인증서(프론트용은 us-east-1, API 커스텀 도메인용은 서울) 발급·연결
- [ ] CORS 최종 화이트리스트 확정, 시크릿 재점검(JWT/OpenAI)
- [ ] (한 도메인으로 합쳐 CORS 없애고 싶으면) CloudFront에 `/api/*` → App Runner 오리진 추가

---

## Phase 5 — 팀 QA

- [ ] 팀원에게 **프론트 URL 공유** → 방금 고친 **기기 간 동기화 / 닉네임** 수정 검증
- [ ] 스테이징 = 리셋 가능 샌드박스로 취급(운영 데이터 아님)

---

## 비용 대략 (서울, 최소 구성 · 확인 필요)

| 서비스 | 대략 | 비고 |
|---|---|---|
| RDS `db.t4g.micro` | **12개월 무료** → 이후 ~$12–15/월 | 프리티어 750h/월 |
| App Runner | ~$5–25/월 | **min 1 인스턴스면 상시 과금**(idle도) — 유휴 스케일 설정 확인 |
| S3 + CloudFront | ~$0–1/월 | 트래픽 적으면 프리티어 내 |
| SSM Parameter Store | 무료(standard) | |
| **합계** | 초기 **거의 무료~$10**, 이후 **~$25–40/월** | 프리티어 만료·상시 과금 리소스 주의 |

⚠️ **비용 사고 방지**: App Runner·RDS는 **꺼도 과금될 수 있는 상시 리소스**. 안 쓸 땐 App Runner 일시정지·RDS 중지(최대 7일)·또는 삭제. 예산 알림(**AWS Budgets**) 걸어두기.

---

## 공통 함정 체크리스트 (경로 무관)

1. **SQLite→Postgres 재베이스라인** — 마이그레이션 새로(히스토리 재생 X). Phase 1.
2. **`JWT_SECRET` 반드시 주입** — 폴백 방치 = auth·회상 토큰 위조. Phase 2.
3. **CORS** `origin:true` → 프론트 도메인 화이트리스트. Phase 2.
4. **`EXPO_PUBLIC_API_URL`** 빌드 타임 주입 — 바뀌면 재빌드. Phase 3.
5. **node 버전** — 백엔드 이미지 node 20+ 고정(Nest/Prisma).
6. **ACM 인증서**는 CloudFront용만 **us-east-1**.
7. **App Runner→RDS** 프라이빗이면 **VPC 커넥터** 필요.
8. **SPA 폴백**(403/404→index.html) 없으면 새로고침 시 흰 화면/404.

---

## 실행 순서 한 줄 요약

Phase 0(계정) → **1(RDS+Postgres 전환)** → **2(Docker→ECR→App Runner)** → **3(S3+CloudFront)** → 4(도메인) → 5(팀 QA).
각 Phase는 **검증 통과 후 다음으로**. 1·2가 핵심 산, 3은 정적이라 쉬움.
