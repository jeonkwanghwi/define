import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CurrencyService } from '../currency/currency.service';
import { UsageService } from '../usage/usage.service';
import { RecallChatDto } from './dto/recall-chat.dto';
import { ChatMessage, OpenAiClient } from './openai.client';
import { buildSystemPrompt } from './prompt';
import { RecallEntry, RecallRepository } from './recall.repository';

/** 대화 1건 시작당 차감 잉크. */
export const RECALL_COST = 30;
/** 회상 열림 조건: 서로 다른 단어 수 (프론트 past.tsx UNLOCK_WORDS와 동일 값). */
export const RECALL_UNLOCK_WORDS = 20;
/** 프롬프트에 넣는 엔트리 상한(토큰 관리, 최신 우선). */
const MAX_ENTRIES = 60;

/** 필터를 사람이 읽는 "시절" 라벨로. 나이 우선, 없으면 연도. 둘 다 없으면 전체(undefined). */
function describePeriod(filter: RecallChatDto['filter']): string | undefined {
  if (filter.age != null) return `${filter.age}살 무렵`;
  if (filter.periodStart) return `${filter.periodStart.slice(0, 4)}년 무렵`;
  return undefined;
}

@Injectable()
export class RecallService {
  constructor(
    private readonly recall: RecallRepository,
    private readonly openai: OpenAiClient,
    private readonly currency: CurrencyService,
    private readonly usage: UsageService,
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

    // 열림 게이트 — 프론트 잠금 화면과 별개로 서버가 권위로 검사. isNewConversation은
    // 클라 주장이라 매 턴 검사(이어하기로 우회 불가). 엔트리는 아래 프롬프트에서 재사용.
    const allEntries = await this.recall.findEntries(userId);
    const distinctWords = new Set(allEntries.map((e) => e.word)).size;
    if (distinctWords < RECALL_UNLOCK_WORDS) {
      throw new HttpException(
        {
          message: `서로 다른 단어 ${RECALL_UNLOCK_WORDS}개를 모으면 회상이 열려요.`,
          code: 'RECALL_LOCKED',
        },
        HttpStatus.FORBIDDEN,
      );
    }

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

    const entries = this.applyFilter(allEntries, dto.filter, ctx.birthYear);
    const system = buildSystemPrompt({
      entries: entries.slice(0, MAX_ENTRIES),
      mode: dto.mode ?? 'free',
      focusWord: dto.focusWord,
      period: describePeriod(dto.filter),
      speechProfile: ctx.speechProfile,
    });
    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      ...dto.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const result = await this.openai.chat(messages, { maxTokens: 500 }); // 실패 시 throw → 미차감·미기록
    // 사용량·비용 기록(비치명적). 매 턴 기록 — 모든 호출이 토큰을 소비.
    await this.usage.recordLlm({
      userId,
      feature: 'recall',
      model: result.model,
      usage: result.usage,
    });

    // 성공 후 차감(새 대화 시작에만). 선검사를 통과했으니 보통 ok:true.
    let balance: number;
    if (dto.isNewConversation) {
      const spent = await this.currency.spend(userId, RECALL_COST);
      balance = spent.balance;
    } else {
      balance = await this.currency.getBalance(userId);
    }

    // 말투 프로필 갱신 — 응답을 막지 않게 백그라운드로(void = 기다리지 않음). 실패해도 비치명적.
    void this.maybeUpdateSpeechProfile(userId, dto.messages).catch((e) =>
      console.warn('[recall] 말투 프로필 갱신 실패(다음 대화에 재시도):', e),
    );

    return { message: result.content, balance };
  }

  /**
   * 사용자 발화가 3의 배수로 쌓일 때마다 말투 특징을 추출해 프로필 갱신.
   * 대화 원문은 저장하지 않는다 — 말투 요약(몇 줄)만 users.speechProfile에.
   * (매 턴 돌리면 LLM 호출이 2배가 되므로 3턴 간격으로 비용 제한)
   */
  private async maybeUpdateSpeechProfile(
    userId: string,
    messages: RecallChatDto['messages'],
  ): Promise<void> {
    const userLines = messages.filter((m) => m.role === 'user').map((m) => m.content);
    if (userLines.length < 3 || userLines.length % 3 !== 0) return;

    const result = await this.openai.chat([
      {
        role: 'system',
        content: [
          '아래는 한 사용자가 채팅에서 실제로 친 메시지들이다. 이 사람의 "말투 특징"만 2~4줄로 요약해라.',
          '- 볼 것: 반말/존댓말, 문장 길이, 자주 쓰는 어미·표현, ㅋㅋ/ㅎㅎ/이모티콘/문장부호 습관.',
          '- 대화 내용·주제·감정은 쓰지 마라. 말투만. 요약문만 출력해라.',
        ].join('\n'),
      },
      // 최근 발화만(토큰 관리) — 말투는 최근 표본으로 충분.
      { role: 'user', content: userLines.slice(-20).join('\n') },
      // 결과물이 2~4줄 고정 + 저장 시 500자 컷이므로 타이트한 상한. 백그라운드 호출이라 잘려도 무해.
    ], { maxTokens: 300 });
    await this.usage.recordLlm({
      userId,
      feature: 'recall-speech-profile',
      model: result.model,
      usage: result.usage,
    });
    const profile = result.content.trim().slice(0, 500);
    if (profile) await this.recall.updateSpeechProfile(userId, profile);
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
