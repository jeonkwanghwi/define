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
  email: string;
  passwordHash: string;
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
}
