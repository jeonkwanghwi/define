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
