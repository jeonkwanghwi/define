import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CurrencyService } from '../currency/currency.service';
import { RecallChatDto } from './dto/recall-chat.dto';
import { ChatMessage, OpenAiClient } from './openai.client';
import { buildSystemPrompt } from './prompt';
import { RecallEntry, RecallRepository } from './recall.repository';

/** 대화 1건 시작당 차감 잉크. */
export const RECALL_COST = 30;
/** 프롬프트에 넣는 엔트리 상한(토큰 관리, 최신 우선). */
const MAX_ENTRIES = 60;

@Injectable()
export class RecallService {
  constructor(
    private readonly recall: RecallRepository,
    private readonly openai: OpenAiClient,
    private readonly currency: CurrencyService,
  ) {}

  /** AI 데이터 동의 기록(멱등 — 다시 부르면 시각만 갱신). */
  async consent(userId: string): Promise<{ recallConsentAt: string }> {
    const at = new Date();
    await this.recall.setConsent(userId, at);
    return { recallConsentAt: at.toISOString() };
  }

  /** 과거의 나와 1턴 대화. 새 대화 시작이면 동의·잔액 선검사 후 성공 시 30잉크 차감. */
  async chat(
    userId: string,
    dto: RecallChatDto,
  ): Promise<{ message: string; balance: number }> {
    const ctx = await this.recall.findUserContext(userId);
    if (!ctx) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 새 대화 시작 — 동의·잔액 선검사(OpenAI 호출 낭비 방지). 실제 차감은 성공 후.
    if (dto.isNewConversation) {
      if (!ctx.recallConsentAt) {
        throw new HttpException(
          { message: '회상을 시작하려면 동의가 필요해요.', code: 'RECALL_CONSENT_REQUIRED' },
          HttpStatus.FORBIDDEN,
        );
      }
      const balance = await this.currency.getBalance(userId);
      if (balance < RECALL_COST) {
        throw new HttpException(
          { message: `잉크가 ${RECALL_COST}개 필요해요. 출석으로 모아보세요.`, code: 'INSUFFICIENT_INK' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const entries = this.applyFilter(await this.recall.findEntries(userId), dto.filter, ctx.birthYear);
    const system = buildSystemPrompt({
      entries: entries.slice(0, MAX_ENTRIES),
      mode: dto.mode ?? 'free',
      focusWord: dto.focusWord,
    });
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...dto.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const reply = await this.openai.chat(messages); // 실패 시 여기서 throw → 미차감

    // 성공 후 차감(새 대화 시작에만). 선검사를 통과했으니 보통 ok:true.
    let balance: number;
    if (dto.isNewConversation) {
      const spent = await this.currency.spend(userId, RECALL_COST);
      balance = spent.balance;
    } else {
      balance = await this.currency.getBalance(userId);
    }

    return { message: reply, balance };
  }

  /** 나이(savedAt.year - birthYear === age) 또는 기간으로 필터. 둘 다 없으면 전체. */
  private applyFilter(
    entries: RecallEntry[],
    filter: RecallChatDto['filter'],
    birthYear: number | null,
  ): RecallEntry[] {
    if (filter.age != null) {
      if (birthYear == null) {
        throw new BadRequestException('출생연도가 없어 나이 필터를 쓸 수 없어요.');
      }
      return entries.filter(
        (e) => new Date(e.savedAt).getFullYear() - birthYear === filter.age,
      );
    }
    if (filter.periodStart && filter.periodEnd) {
      return entries.filter(
        (e) =>
          e.savedAt.slice(0, 10) >= filter.periodStart! &&
          e.savedAt.slice(0, 10) <= filter.periodEnd!,
      );
    }
    return entries;
  }
}
