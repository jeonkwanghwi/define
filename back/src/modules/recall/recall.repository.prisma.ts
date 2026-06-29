import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  RecallEntry,
  RecallRepository,
  RecallUserContext,
} from './recall.repository';

@Injectable()
export class PrismaRecallRepository extends RecallRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findUserContext(userId: string): Promise<RecallUserContext | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { birthYear: true, recallConsentAt: true },
    });
    return row
      ? { birthYear: row.birthYear, recallConsentAt: row.recallConsentAt }
      : null;
  }

  async setConsent(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { recallConsentAt: at },
    });
  }

  async findEntries(userId: string): Promise<RecallEntry[]> {
    const rows = await this.prisma.entry.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: { word: true, text: true, savedAt: true },
    });
    return rows.map((r) => ({
      word: r.word,
      text: r.text,
      savedAt: r.savedAt.toISOString(),
    }));
  }
}
