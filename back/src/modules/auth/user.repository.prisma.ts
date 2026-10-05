/**
 * PrismaUserRepository — UserRepository 계약의 Prisma(SQLite) 구현체.
 * interests는 관계라 include 후 string[]로 매핑한다.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { UserEntity } from './entities/user.entity';
import { UserRepository } from './user.repository';

// Prisma row(+interests 관계 포함)를 도메인 UserEntity로.
type Row = {
  id: string;
  email: string | null;
  passwordHash: string | null;
  nickname: string | null;
  birthYear: number | null;
  gender: string | null;
  createdAt: Date;
  balance: number;
  recallConsentAt: Date | null;
  interests: { interest: string }[];
};

function toEntity(row: Row): UserEntity {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    nickname: row.nickname,
    birthYear: row.birthYear,
    gender: row.gender,
    createdAt: row.createdAt,
    balance: row.balance,
    recallConsentAt: row.recallConsentAt,
    interests: row.interests.map((i) => i.interest),
  };
}

@Injectable()
export class PrismaUserRepository extends UserRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { email },
      include: { interests: true },
    });
    return row ? toEntity(row) : null;
  }

  async existsById(userId: string): Promise<boolean> {
    // 존재 여부만 필요하니 id 한 칸만 가져온다(관계 include 없음).
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return row !== null;
  }

  async create(input: {
    email: string;
    passwordHash: string;
    nickname?: string;
  }): Promise<UserEntity> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        nickname: input.nickname ?? null,
      },
      include: { interests: true },
    });
    return toEntity(row);
  }

  async updateProfile(
    userId: string,
    input: { birthYear: number; gender: string; interests: string[] },
  ): Promise<UserEntity> {
    // 관심사는 통째 교체: 기존 전부 삭제 후 재생성(멱등). createMany 미사용(SQLite 호환).
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: {
        birthYear: input.birthYear,
        gender: input.gender,
        interests: {
          deleteMany: {},
          create: input.interests.map((interest) => ({ interest })),
        },
      },
      include: { interests: true },
    });
    return toEntity(row);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async findByNickname(nickname: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({
      where: { nickname },
      include: { interests: true },
    });
    return row ? toEntity(row) : null;
  }

  async updateNickname(userId: string, nickname: string | null): Promise<UserEntity> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname },
      include: { interests: true },
    });
    return toEntity(row);
  }

  async findIdentities(userId: string): Promise<{ provider: string; providerSub: string }[]> {
    return this.prisma.authIdentity.findMany({
      where: { userId },
      select: { provider: true, providerSub: true },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    // 원장 익명화와 삭제를 한 트랜잭션으로 — 중간에 끊겨 "지워졌는데 원장엔 남는" 상태를 막는다.
    await this.prisma.$transaction([
      this.prisma.llmUsage.updateMany({ where: { userId }, data: { userId: 'deleted' } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  async findBySocial(provider: string, providerSub: string): Promise<UserEntity | null> {
    const identity = await this.prisma.authIdentity.findUnique({
      where: { provider_providerSub: { provider, providerSub } },
      include: { user: { include: { interests: true } } },
    });
    return identity ? toEntity(identity.user) : null;
  }

  async createSocial(input: {
    provider: string;
    providerSub: string;
    nickname?: string;
  }): Promise<UserEntity> {
    // 중첩 create = 한 트랜잭션. 연결 생성이 실패하면 유저도 안 생긴다.
    const row = await this.prisma.user.create({
      data: {
        nickname: input.nickname ?? null,
        identities: {
          create: { provider: input.provider, providerSub: input.providerSub },
        },
      },
      include: { interests: true },
    });
    return toEntity(row);
  }
}
