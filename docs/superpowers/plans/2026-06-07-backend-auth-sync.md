# 백엔드 auth/동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 익명우선 모델에서 이메일+비밀번호 회원가입·로그인과 로컬 단어장(entries) 서버 동기화의 백엔드를 구현한다.

**Architecture:** 마일스톤1(`GET /api/words`)의 레이어 패턴을 그대로 확장한다 — controller(HTTP) → service(로직) → repository(abstract 인터페이스) → Prisma 구현체. DB 스왑 대비 인터페이스↔구현 DI 바인딩 유지. 인증은 access-only JWT(90일), 비밀번호는 bcryptjs 해싱. 동기화는 로컬 `SavedEntry.id`를 `clientId`로 보존해 `(userId, clientId)` 유니크 upsert로 멱등 처리.

**Tech Stack:** NestJS 10 · Prisma 5 + SQLite · @nestjs/jwt · @nestjs/passport + passport-jwt · bcryptjs · class-validator

**검증 방식:** 이 백엔드엔 테스트 프레임워크가 없고 마일스톤1도 실제 구동+curl로 검증했다. 본 계획은 같은 컨벤션을 따른다 — 각 태스크는 `npm run build`(타입 통과)로, 엔드포인트 태스크는 추가로 **curl 시나리오**로 검증한다. 자동 e2e(jest/supertest) 도입은 보류(스펙 §7).

**기준 디렉터리:** 모든 명령은 `back/`에서 실행. 파일 경로는 `back/` 기준 상대.

**스펙:** [docs/superpowers/specs/2026-06-07-backend-auth-sync-design.md](../specs/2026-06-07-backend-auth-sync-design.md)

---

## File Structure

**신규 생성**
```
back/.env.example                                  # JWT_SECRET 예시 (커밋됨)
back/src/modules/auth/
  dto/signup.dto.ts            { email, password } 검증
  dto/login.dto.ts             { email, password } 검증
  dto/auth.response.ts         { token, user } 응답 형태
  entities/user.entity.ts      도메인 User (passwordHash 포함 — 내부용)
  user.repository.ts           abstract: findByEmail, create
  user.repository.prisma.ts    Prisma 구현
  auth.service.ts              bcrypt 해싱/검증 + JWT 발급
  jwt.strategy.ts              Bearer 토큰 검증 → req.user
  jwt-auth.guard.ts            보호 라우트 가드
  auth.controller.ts           POST /api/auth/signup, /login
  auth.module.ts               JwtModule/Passport 설정 + DI 바인딩
back/src/modules/journal/
  dto/import-journal.dto.ts    { entries: EntryDto[] } 중첩 검증
  entities/entry.entity.ts     도메인 Entry
  entry.repository.ts          abstract: upsert(userId, input) → {created}
  entry.repository.prisma.ts   Prisma 구현 (findUnique → create/update)
  journal.service.ts           import → {imported, updated}
  journal.controller.ts        POST /api/journal/import (JwtAuthGuard)
  journal.module.ts            DI 바인딩
```

**수정**
```
back/prisma/schema.prisma          User, Entry 모델 추가 (Word 무변경)
back/src/config/configuration.ts   jwt.secret / jwt.expiresIn 추가
back/src/app.module.ts             AuthModule, JournalModule 등록
back/package.json                  의존성 추가 (npm install이 갱신)
```

---

## Task 1: Prisma 스키마 — User & Entry 모델 + 마이그레이션

**Files:**
- Modify: `back/prisma/schema.prisma`

- [ ] **Step 1: schema.prisma 끝에 두 모델 추가** (기존 `Word` 모델은 그대로 둔다)

기존 파일 맨 아래(`Word` 모델 다음)에 추가:

```prisma
/// 가입 사용자. 익명 모델 → 가입 시 닉네임 미설정 허용(nullable).
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  nickname     String?
  createdAt    DateTime @default(now())
  entries      Entry[]

  @@map("users")
}

/// 사용자 정의 단어(entry) — 로컬 SavedEntry의 서버 쌍둥이.
/// clientId = 로컬 SavedEntry.id 보존 → (userId, clientId) 유니크로 재import 중복 방지.
model Entry {
  id         String   @id @default(cuid())
  clientId   String
  userId     String
  word       String
  text       String
  changeNote String?
  savedAt    DateTime
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, clientId])
  @@map("entries")
}
```

- [ ] **Step 2: 마이그레이션 생성·적용**

Run: `npm run prisma:migrate -- --name add_user_entry`
Expected: `prisma/migrations/<timestamp>_add_user_entry/migration.sql` 생성, "Your database is now in sync" 출력. Prisma Client 재생성됨.

- [ ] **Step 3: 빌드로 타입 확인**

Run: `npm run build`
Expected: 에러 0 (Prisma Client에 `user`/`entry` 모델 타입 생성됨).

- [ ] **Step 4: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(back): User·Entry 테이블 추가 (auth/동기화 스키마)"
```

---

## Task 2: 의존성 설치 + JWT 설정 + .env

**Files:**
- Modify: `back/package.json` (npm install이 자동 갱신)
- Modify: `back/src/config/configuration.ts`
- Create: `back/.env.example`

- [ ] **Step 1: 인증 의존성 설치**

Run:
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs
npm install -D @types/passport-jwt @types/bcryptjs
```
Expected: 설치 성공. (bcryptjs = 순수 JS, 네이티브 빌드 불필요 → macOS/CI 안정. bcrypt 대신 채택.)

- [ ] **Step 2: configuration.ts에 jwt 설정 추가**

기존 반환 객체에 `jwt` 키 추가:

```ts
export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  jwt: {
    // 운영에서는 반드시 .env의 JWT_SECRET로 덮어쓸 것. 아래는 로컬 개발 폴백.
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '90d',
  },
});
```

- [ ] **Step 3: .env.example 생성** (실제 `.env`는 gitignore됨 — 폴백이 있어 없어도 앱은 돈다)

`back/.env.example`:
```
# 실제 값은 back/.env 에 (이 파일은 예시·커밋용). configuration.ts가 폴백을 갖지만 운영은 반드시 설정.
DATABASE_URL="file:./dev.db"
JWT_SECRET="여기에-충분히-긴-랜덤-문자열"
JWT_EXPIRES_IN="90d"
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json src/config/configuration.ts .env.example
git commit -m "chore(back): 인증 의존성(jwt·passport·bcryptjs) + JWT 설정"
```

---

## Task 3: User 도메인 + repository (인터페이스 + Prisma)

**Files:**
- Create: `back/src/modules/auth/entities/user.entity.ts`
- Create: `back/src/modules/auth/user.repository.ts`
- Create: `back/src/modules/auth/user.repository.prisma.ts`

- [ ] **Step 1: user.entity.ts** (도메인 객체 — `passwordHash` 포함, 내부 전용. 응답엔 절대 안 나감)

```ts
/**
 * UserEntity — 우리 앱이 생각하는 "가입 사용자 한 명".
 * passwordHash까지 들고 있는 내부 도메인 객체 (로그인 비교에 필요).
 * 바깥(응답)으로는 절대 그대로 나가지 않는다 — AuthResponse로 추려서 내보냄.
 */
export class UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string | null;
  createdAt: Date;
}
```

- [ ] **Step 2: user.repository.ts** (계약 — word.repository.ts와 같은 abstract class 패턴)

```ts
/**
 * UserRepository — User DB 접근 "계약". 구현은 user.repository.prisma.ts.
 * service는 이 계약만 보고 일한다(DB 종류 모름). word.repository.ts와 동일 패턴.
 */
import { UserEntity } from './entities/user.entity';

export abstract class UserRepository {
  /** 이메일로 1명 조회. 없으면 null. (가입 중복 검사·로그인에 사용) */
  abstract findByEmail(email: string): Promise<UserEntity | null>;

  /** 새 사용자 생성. (해싱된 비밀번호를 받는다 — 해싱은 service 책임) */
  abstract create(input: { email: string; passwordHash: string }): Promise<UserEntity>;
}
```

- [ ] **Step 3: user.repository.prisma.ts** (SQLite 구현 — PrismaWordRepository와 같은 구조)

```ts
/**
 * PrismaUserRepository — UserRepository 계약의 Prisma(SQLite) 구현체.
 * 여기서만 Prisma를 안다. DB row → UserEntity로 변환.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ?? null;
  }

  async create(input: { email: string; passwordHash: string }): Promise<UserEntity> {
    return this.prisma.user.create({
      data: { email: input.email, passwordHash: input.passwordHash },
    });
  }
}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 에러 0. (Prisma row 타입이 UserEntity와 구조적으로 호환되어 그대로 반환 가능.)

- [ ] **Step 5: 커밋**

```bash
git add src/modules/auth/entities/user.entity.ts src/modules/auth/user.repository.ts src/modules/auth/user.repository.prisma.ts
git commit -m "feat(back): User 도메인 + repository(인터페이스/Prisma)"
```

---

## Task 4: auth DTO + service (bcrypt 해싱 + JWT 발급)

**Files:**
- Create: `back/src/modules/auth/dto/signup.dto.ts`
- Create: `back/src/modules/auth/dto/login.dto.ts`
- Create: `back/src/modules/auth/dto/auth.response.ts`
- Create: `back/src/modules/auth/auth.service.ts`

- [ ] **Step 1: signup.dto.ts** (입력 검증 — 전역 ValidationPipe가 자동 적용)

```ts
/**
 * SignupDto — 회원가입 입력. 이메일+비밀번호만 받는다(익명 모델, 저마찰).
 * class-validator 데코레이터로 형식 검증 → 위반 시 ValidationPipe가 400 반환.
 */
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password: string;
}
```

- [ ] **Step 2: login.dto.ts**

```ts
/**
 * LoginDto — 로그인 입력. 길이 규칙은 가입에서만(기존 계정 막지 않게 여기선 비어있지만 않으면 됨).
 */
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력하세요.' })
  password: string;
}
```

- [ ] **Step 3: auth.response.ts** (응답 형태 — passwordHash 제외, 토큰+공개 유저 정보만)

```ts
/**
 * AuthResponse — signup/login 성공 응답. passwordHash는 절대 포함하지 않는다.
 */
export class AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nickname: string | null;
  };
}
```

- [ ] **Step 4: auth.service.ts** (로직 — 해싱/검증/토큰 발급)

```ts
/**
 * AuthService — 인증 로직. controller(HTTP)와 repository(DB) 사이.
 *   - signup: 이메일 중복 검사 → bcrypt 해싱 → 생성 → 토큰 발급
 *   - login:  이메일 조회 → bcrypt 비교 → 토큰 발급
 * 토큰 payload: { sub: userId, email }. (sub = JWT 표준 "subject" 클레임)
 */
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AuthResponse } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({ email: dto.email, passwordHash });
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    // 이메일 없음/비번 틀림 모두 같은 메시지(계정 존재 여부 노출 방지)
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: UserEntity): AuthResponse {
    const token = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      token,
      user: { id: user.id, email: user.email, nickname: user.nickname ?? null },
    };
  }
}
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 에러 0. (아직 module 미연결이라 실행은 다음 태스크.)

- [ ] **Step 6: 커밋**

```bash
git add src/modules/auth/dto src/modules/auth/auth.service.ts
git commit -m "feat(back): auth DTO + service (bcrypt 해싱·JWT 발급)"
```

---

## Task 5: JWT 전략 + 가드

**Files:**
- Create: `back/src/modules/auth/jwt.strategy.ts`
- Create: `back/src/modules/auth/jwt-auth.guard.ts`

- [ ] **Step 1: jwt.strategy.ts** (Bearer 토큰을 풀어 req.user에 심는다)

```ts
/**
 * JwtStrategy — passport-jwt 전략. Authorization: Bearer <token>을 읽어
 * 서명·만료 검증 후 validate()의 반환값을 req.user로 만든다.
 * 보호 라우트(@UseGuards(JwtAuthGuard))에서 이 결과를 꺼내 쓴다.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') as string,
    });
  }

  /** payload(우리가 sign할 때 넣은 { sub, email })를 req.user 형태로 변환. */
  async validate(payload: { sub: string; email: string }): Promise<{
    userId: string;
    email: string;
  }> {
    return { userId: payload.sub, email: payload.email };
  }
}
```

- [ ] **Step 2: jwt-auth.guard.ts** (라우트 보호용 — 'jwt' 전략 사용)

```ts
/**
 * JwtAuthGuard — @UseGuards(JwtAuthGuard)로 라우트를 보호한다.
 * 토큰 없음/만료/위조면 자동 401. 통과 시 req.user 세팅(JwtStrategy.validate 결과).
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 0.

- [ ] **Step 4: 커밋**

```bash
git add src/modules/auth/jwt.strategy.ts src/modules/auth/jwt-auth.guard.ts
git commit -m "feat(back): JWT 전략 + 인증 가드"
```

---

## Task 6: auth controller + module 연결 + 실제 구동 검증

**Files:**
- Create: `back/src/modules/auth/auth.controller.ts`
- Create: `back/src/modules/auth/auth.module.ts`
- Modify: `back/src/app.module.ts`

- [ ] **Step 1: auth.controller.ts** (HTTP 매핑만 — 얇게)

```ts
/**
 * AuthController — /api/auth/* 매핑. 로직 없음, service 호출만.
 * @HttpCode로 상태코드 명시(기본 POST는 201이라 login만 200으로).
 */
import { Body, Controller, HttpCode, Post } from '@nestjs/common';

import { AuthService } from './auth.service';
import { AuthResponse } from './dto/auth.response';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/signup — 이메일+비밀번호 가입. */
  @Post('signup')
  @HttpCode(201)
  signup(@Body() dto: SignupDto): Promise<AuthResponse> {
    return this.auth.signup(dto);
  }

  /** POST /api/auth/login — 로그인. */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }
}
```

- [ ] **Step 2: auth.module.ts** (JwtModule·Passport 설정 + repository DI 바인딩)

```ts
/**
 * AuthModule — auth 한 덩어리. WordModule과 같은 DI 바인딩 패턴.
 *   - JwtModule.registerAsync: ConfigService에서 secret/만료를 읽어 토큰 서명 설정
 *   - PassportModule: passport 통합
 *   - providers: UserRepository(계약) → PrismaUserRepository(구현) 바인딩
 *   - JwtStrategy를 provider로 등록 → 앱 전역에서 'jwt' 전략 사용 가능(다른 모듈 가드도)
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrismaUserRepository } from './user.repository.prisma';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: UserRepository, useClass: PrismaUserRepository },
  ],
})
export class AuthModule {}
```

- [ ] **Step 3: app.module.ts에 AuthModule 등록**

`imports` 배열에 `AuthModule` 추가하고 상단에 import 구문 추가:

```ts
import { AuthModule } from './modules/auth/auth.module';
```
```ts
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    WordModule,
    AuthModule,
  ],
```

- [ ] **Step 4: 빌드 후 서버 기동**

Run: `npm run build` (에러 0 확인) → 별도 터미널에서 `npm run start:dev`
Expected: `define API listening on http://localhost:3000/api`

- [ ] **Step 5: curl로 auth 4스텝 검증**

```bash
# 1) 가입 → 201 + token
curl -i -s -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}'
# Expected: HTTP/1.1 201, body에 {"token":"...","user":{"id":"...","email":"a@b.com","nickname":null}}

# 2) 같은 이메일 재가입 → 409
curl -i -s -X POST http://localhost:3000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}'
# Expected: HTTP/1.1 409, "이미 가입된 이메일입니다."

# 3) 로그인 → 200 + token
curl -i -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}'
# Expected: HTTP/1.1 200, token 포함

# 4) 틀린 비번 로그인 → 401
curl -i -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"wrong"}'
# Expected: HTTP/1.1 401, "이메일 또는 비밀번호가 올바르지 않습니다."
```
스펙 §6의 1·2·3 + 로그인 실패 케이스 통과 확인.

- [ ] **Step 6: 커밋**

```bash
git add src/modules/auth/auth.controller.ts src/modules/auth/auth.module.ts src/app.module.ts
git commit -m "feat(back): auth 엔드포인트(signup/login) 동작 — 4스텝 curl 검증"
```

---

## Task 7: Entry 도메인 + repository (멱등 upsert)

**Files:**
- Create: `back/src/modules/journal/entities/entry.entity.ts`
- Create: `back/src/modules/journal/entry.repository.ts`
- Create: `back/src/modules/journal/entry.repository.prisma.ts`

- [ ] **Step 1: entry.entity.ts**

```ts
/**
 * EntryEntity — 사용자 정의 단어 한 개(서버 저장본). 로컬 SavedEntry의 쌍둥이.
 */
export class EntryEntity {
  id: string;
  clientId: string;
  userId: string;
  word: string;
  text: string;
  changeNote: string | null;
  savedAt: Date;
  createdAt: Date;
}
```

- [ ] **Step 2: entry.repository.ts** (계약 — upsert가 created/updated를 알려줌)

```ts
/**
 * EntryRepository — Entry DB 접근 계약.
 * upsert는 (userId, clientId) 유니크로 멱등 처리하고,
 * "새로 만들었는지(created)"를 돌려준다 → service가 imported/updated 카운트에 사용.
 */
export interface EntryInput {
  clientId: string;
  word: string;
  text: string;
  changeNote?: string;
  savedAt: Date;
}

export abstract class EntryRepository {
  /** (userId, clientId) 기준 upsert. 신규면 {created:true}, 기존이면 {created:false}. */
  abstract upsert(userId: string, input: EntryInput): Promise<{ created: boolean }>;
}
```

- [ ] **Step 3: entry.repository.prisma.ts** (findUnique → create/update. Prisma upsert는 생성/갱신 구분을 안 주므로 직접 분기)

```ts
/**
 * PrismaEntryRepository — EntryRepository의 Prisma 구현.
 * Prisma의 upsert는 "생성/갱신 여부"를 반환하지 않으므로,
 * 멱등성 카운트(imported/updated)를 정확히 내려면 findUnique로 먼저 확인 후 분기한다.
 * 복합 유니크 키 입력 이름은 Prisma가 자동 생성한 `userId_clientId`.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { EntryInput, EntryRepository } from './entry.repository';

@Injectable()
export class PrismaEntryRepository extends EntryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsert(userId: string, input: EntryInput): Promise<{ created: boolean }> {
    const existing = await this.prisma.entry.findUnique({
      where: { userId_clientId: { userId, clientId: input.clientId } },
    });

    const data = {
      word: input.word,
      text: input.text,
      changeNote: input.changeNote ?? null,
      savedAt: input.savedAt,
    };

    if (existing) {
      await this.prisma.entry.update({ where: { id: existing.id }, data });
      return { created: false };
    }

    await this.prisma.entry.create({
      data: { userId, clientId: input.clientId, ...data },
    });
    return { created: true };
  }
}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 에러 0.

- [ ] **Step 5: 커밋**

```bash
git add src/modules/journal/entities/entry.entity.ts src/modules/journal/entry.repository.ts src/modules/journal/entry.repository.prisma.ts
git commit -m "feat(back): Entry 도메인 + repository(멱등 upsert)"
```

---

## Task 8: journal DTO + service + controller + module + 풀 시나리오 검증

**Files:**
- Create: `back/src/modules/journal/dto/import-journal.dto.ts`
- Create: `back/src/modules/journal/journal.service.ts`
- Create: `back/src/modules/journal/journal.controller.ts`
- Create: `back/src/modules/journal/journal.module.ts`
- Modify: `back/src/app.module.ts`

- [ ] **Step 1: import-journal.dto.ts** (중첩 배열 검증 — @ValidateNested + @Type)

```ts
/**
 * ImportJournalDto — 로컬 단어장 업로드 입력. entries 배열을 중첩 검증한다.
 * @ValidateNested + @Type 이 있어야 ValidationPipe가 배열 원소까지 검사함.
 * savedAt은 JSON이라 ISO 문자열로 받고(@IsDateString), service에서 Date로 변환.
 */
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EntryDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  changeNote?: string;

  @IsDateString()
  savedAt: string;
}

export class ImportJournalDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntryDto)
  entries: EntryDto[];
}
```

- [ ] **Step 2: journal.service.ts** (entries를 돌며 upsert → imported/updated 집계)

```ts
/**
 * JournalService — 로컬 entries를 서버로 동기화(import).
 * 각 entry를 (userId, clientId) 멱등 upsert → 신규는 imported, 기존은 updated로 집계.
 * 같은 payload를 두 번 보내도 imported=0이 되어 중복이 안 쌓이는 게 핵심 계약.
 */
import { Injectable } from '@nestjs/common';

import { ImportJournalDto } from './dto/import-journal.dto';
import { EntryRepository } from './entry.repository';

@Injectable()
export class JournalService {
  constructor(private readonly entries: EntryRepository) {}

  async import(
    userId: string,
    dto: ImportJournalDto,
  ): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;

    for (const e of dto.entries) {
      const { created } = await this.entries.upsert(userId, {
        clientId: e.clientId,
        word: e.word,
        text: e.text,
        changeNote: e.changeNote,
        savedAt: new Date(e.savedAt),
      });
      if (created) {
        imported += 1;
      } else {
        updated += 1;
      }
    }

    return { imported, updated };
  }
}
```

- [ ] **Step 3: journal.controller.ts** (JwtAuthGuard로 보호 + req.user에서 userId 추출)

```ts
/**
 * JournalController — /api/journal/import. JwtAuthGuard로 보호(토큰 필수).
 * req.user는 JwtStrategy.validate가 심은 { userId, email }.
 */
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImportJournalDto } from './dto/import-journal.dto';
import { JournalService } from './journal.service';

@Controller('journal')
@UseGuards(JwtAuthGuard)
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  /** POST /api/journal/import — 로컬 단어장 업로드(가입 직후 1회). */
  @Post('import')
  @HttpCode(200)
  import(
    @Req() req: { user: { userId: string } },
    @Body() dto: ImportJournalDto,
  ): Promise<{ imported: number; updated: number }> {
    return this.journal.import(req.user.userId, dto);
  }
}
```

- [ ] **Step 4: journal.module.ts** (DI 바인딩 — WordModule 패턴 동일)

```ts
/**
 * JournalModule — journal 한 덩어리. EntryRepository 계약↔Prisma 구현 바인딩.
 * JwtAuthGuard가 쓰는 'jwt' 전략은 AuthModule이 전역 등록하므로 여기서 import 불필요.
 */
import { Module } from '@nestjs/common';

import { EntryRepository } from './entry.repository';
import { PrismaEntryRepository } from './entry.repository.prisma';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

@Module({
  controllers: [JournalController],
  providers: [
    JournalService,
    { provide: EntryRepository, useClass: PrismaEntryRepository },
  ],
})
export class JournalModule {}
```

- [ ] **Step 5: app.module.ts에 JournalModule 등록**

상단 import 추가:
```ts
import { JournalModule } from './modules/journal/journal.module';
```
imports 배열에 추가(AuthModule 다음):
```ts
    AuthModule,
    JournalModule,
```

- [ ] **Step 6: 빌드 후 서버 기동**

Run: `npm run build` (에러 0) → `npm run start:dev`
Expected: 정상 기동.

- [ ] **Step 7: 풀 시나리오 — 멱등성 포함 (스펙 §6 전체)**

```bash
# 깨끗한 검증을 위해 새 이메일로 가입 후 토큰 추출
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@b.com","password":"password123"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')
echo "token=$TOKEN"

# 4) import 3개 → {imported:3, updated:0}
curl -s -X POST http://localhost:3000/api/journal/import \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"entries":[
    {"clientId":"c1","word":"행복","text":"첫 정의","savedAt":"2026-06-01T00:00:00.000Z"},
    {"clientId":"c2","word":"사랑","text":"두번째","savedAt":"2026-06-02T00:00:00.000Z"},
    {"clientId":"c3","word":"시간","text":"세번째","changeNote":"변함","savedAt":"2026-06-03T00:00:00.000Z"}
  ]}'
# Expected: {"imported":3,"updated":0}

# 5) 같은 payload 재import → {imported:0, updated:3}  ★ 멱등성 증명
curl -s -X POST http://localhost:3000/api/journal/import \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"entries":[
    {"clientId":"c1","word":"행복","text":"첫 정의","savedAt":"2026-06-01T00:00:00.000Z"},
    {"clientId":"c2","word":"사랑","text":"두번째","savedAt":"2026-06-02T00:00:00.000Z"},
    {"clientId":"c3","word":"시간","text":"세번째","changeNote":"변함","savedAt":"2026-06-03T00:00:00.000Z"}
  ]}'
# Expected: {"imported":0,"updated":3}

# 6) 토큰 없이 import → 401
curl -i -s -X POST http://localhost:3000/api/journal/import \
  -H 'Content-Type: application/json' \
  -d '{"entries":[{"clientId":"c1","word":"행복","text":"x","savedAt":"2026-06-01T00:00:00.000Z"}]}'
# Expected: HTTP/1.1 401
```
세 응답이 위 Expected와 정확히 일치하면 **스펙 §6 6스텝 전부 통과 = 백엔드 범위 완료**.

- [ ] **Step 8: 커밋**

```bash
git add src/modules/journal src/app.module.ts
git commit -m "feat(back): journal/import 동기화 — 멱등성 포함 풀 시나리오 검증"
```

---

## Self-Review 결과 (작성자 점검)

- **스펙 커버리지**: §3 데이터모델→T1, 의존성/JWT설정→T2, User repo→T3, auth service/DTO→T4, JWT전략/가드→T5, auth API(signup/login)→T6, Entry repo 멱등→T7, journal/import→T8. §5 API 계약 3개 모두 태스크 있음. §6 검증 6스텝 모두 curl로 매핑(1·2·3·로그인실패→T6, 4·5·6→T8). 누락 없음.
- **타입 일관성**: `UserEntity`/`EntryEntity`/`AuthResponse` 필드, repository 시그니처(`findByEmail`/`create`/`upsert`), JWT payload `{sub,email}`↔strategy `{userId,email}`↔controller `req.user.userId` 전 구간 일치 확인.
- **Placeholder**: 없음. 모든 코드 블록 실제 구현.
- **범위**: 백엔드 단일 subsystem. 프론트는 명시적 분리(후속 계획).

---

## 보류 / 후속 (이 계획 밖)

- 프론트 연결: `auth-store` + 가입 유도 게이트(plaza/mood/past) + 가입·로그인 화면 → **다음 계획**
- 자동 e2e 테스트(jest/supertest) 도입
- 소셜 로그인 · refresh 토큰 · canonical 단어 연결(`Entry.wordId`) · 로그아웃/탈퇴 · 다중기기 양방향 동기화
- 분석용 프로필 필드(`gender`/`birthYear`) — nullable 컬럼 또는 `Profile` 1:1 테이블로 향후
