import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import {
  ModelAggregate,
  RecordLlmInput,
  UsageAggregate,
  UsageRepository,
} from './usage.repository';

@Injectable()
export class PrismaUsageRepository extends UsageRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async record(input: RecordLlmInput): Promise<void> {
    await this.prisma.llmUsage.create({ data: input });
  }

  async totals(): Promise<UsageAggregate> {
    const r = await this.prisma.llmUsage.aggregate({
      _count: { _all: true },
      _sum: { totalTokens: true, costUsd: true },
    });
    return {
      calls: r._count._all,
      totalTokens: r._sum.totalTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
    };
  }

  async byModel(): Promise<ModelAggregate[]> {
    const rows = await this.prisma.llmUsage.groupBy({
      by: ['model'],
      _count: { _all: true },
      _sum: { totalTokens: true, costUsd: true },
    });
    return rows.map((r) => ({
      model: r.model,
      calls: r._count._all,
      totalTokens: r._sum.totalTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
    }));
  }

  async byUser(userId: string): Promise<UsageAggregate> {
    const r = await this.prisma.llmUsage.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { totalTokens: true, costUsd: true },
    });
    return {
      calls: r._count._all,
      totalTokens: r._sum.totalTokens ?? 0,
      totalCostUsd: r._sum.costUsd ?? 0,
    };
  }
}
