# back — define 백엔드 API (NestJS + Prisma)

> 기획·개발 맥락: `../docs/PLANNING.md`, `../docs/DEVELOPMENT.md` (특히 §1 스택, 작업 로그).

## 스택
- **NestJS** (TypeScript) — 프론트와 동일 언어. MVC 구조 내장(controller/service/module/dto).
- **Prisma** — DB 접근. **PostgreSQL**(로컬은 `docker-compose.yml`의 컨테이너, 배포는 AWS RDS).
- REST/JSON. 모든 라우트 `/api` 프리픽스.

## 레이어 흐름 (요청이 흐르는 순서)
```
HTTP 요청
  → controller   HTTP만 (URL→service 연결)
  → service      비즈니스 로직
  → repository    DB 접근 "인터페이스"
      └ *.prisma.ts  실제 구현체(Prisma). DB 바뀌면 이 구현체만 교체
  → DB
dto      = 바깥과 주고받는 응답/요청 형태
entity   = 내부 도메인 객체
```
**왜 repository를 인터페이스로?** service는 계약만 알고 DB 종류를 모른다 →
DB를 갈아끼워도(`word.module.ts`의 `useClass`만 교체) service/controller는 손 안 댄다.

## 폴더 지도
```
back/
├─ Dockerfile          # 배포 이미지(ECR→App Runner) 빌드 정의
├─ docker-compose.yml  # 로컬 개발용 PostgreSQL
├─ prisma/
│  ├─ schema.prisma     # DB 구조 SSOT. 바꾸면 migrate로 반영
│  └─ seed.ts           # 데모 데이터 주입 (npm run db:seed)
├─ src/
│  ├─ main.ts           # 진입점(부트스트랩)
│  ├─ app.module.ts     # 루트 모듈 (모듈 등록)
│  ├─ config/           # 환경변수 설정
│  ├─ database/         # PrismaService(+전역 모듈)
│  └─ modules/
│     └─ word/          # 기능 1덩어리 = controller+service+repository(+impl)+dto+entity+module
│        ├─ word.controller.ts
│        ├─ word.service.ts
│        ├─ word.repository.ts        # 인터페이스(abstract)
│        ├─ word.repository.prisma.ts # 구현체(Prisma)
│        ├─ dto/word.response.ts
│        ├─ entities/word.entity.ts
│        └─ word.module.ts
└─ .env                 # DATABASE_URL·JWT_SECRET 등 (추적 제외)
```

## 처음 실행 (로컬)
Docker Desktop이 필요하다 (로컬 DB = Postgres 컨테이너).
```bash
cd back
cp .env.example .env              # DATABASE_URL·JWT_SECRET 채우기 (둘 다 없으면 서버가 안 뜬다)
npm install                       # 의존성 설치
docker compose up -d              # PostgreSQL 기동 (localhost:5432)
npm run prisma:deploy             # 마이그레이션 적용 + 테이블 생성
npm run db:seed                   # 데모 단어 6개 주입
npm run start:dev                 # http://localhost:3000/api 로 기동 (watch)
```
(레포 루트의 `./dev.sh` / `./dev-web.sh`를 쓰면 DB·백엔드·프론트를 한 번에 띄운다.)
확인: `curl http://localhost:3000/api/words`

## 새 기능 추가하는 법 (패턴)
`src/modules/<도메인>/` 폴더를 만들고 word 모듈과 같은 6요소(controller/service/repository
/impl/dto/entity/module)를 둔 뒤, `app.module.ts`의 `imports`에 모듈을 추가한다.

## 다음 마일스톤
auth(회원가입/로그인) → journal 동기화 → plaza(광장). DEVELOPMENT.md 참조.
