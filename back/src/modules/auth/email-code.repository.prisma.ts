/**
 * PrismaEmailCodeRepository — EmailCodeRepository 계약의 Prisma 구현체.
 * 조회는 select로 EmailCodeRow 필드만 가져온다 — codeHash 말고는 서비스가 쓸 일이 없고,
 * 해시를 필요 이상으로 들고 다니지 않는다.
 */
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { EmailCodeRepository, EmailCodeRow } from './email-code.repository';

@Injectable()
export class PrismaEmailCodeRepository extends EmailCodeRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: {
    email: string;
    purpose: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.emailCode.create({ data: input });
  }

  async findLatestUnconsumed(email: string, purpose: string): Promise<EmailCodeRow | null> {
    // consumedAt: null = 아직 살아 있는 코드. 여러 건이면 가장 최근 것만 유효로 본다.
    return this.prisma.emailCode.findFirst({
      where: { email, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, expiresAt: true, attempts: true },
    });
  }

  async incrementAttempts(id: string): Promise<void> {
    await this.prisma.emailCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }

  async consume(id: string): Promise<void> {
    await this.prisma.emailCode.update({ where: { id }, data: { consumedAt: new Date() } });
  }

  async consumeAll(email: string, purpose: string): Promise<void> {
    await this.prisma.emailCode.updateMany({
      where: { email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async countSince(email: string, purpose: string, since: Date): Promise<number> {
    // 발급 건수 기준이라 consumedAt은 보지 않는다 — 쓴 코드도 상한에 포함돼야 한다.
    return this.prisma.emailCode.count({
      where: { email, purpose, createdAt: { gte: since } },
    });
  }

  async lastIssuedAt(email: string, purpose: string): Promise<Date | null> {
    const row = await this.prisma.emailCode.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  }
}
