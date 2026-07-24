import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
/** 이어하기(무료 턴) 대화 토큰 TTL — 발급 시점부터 고정(롤링/갱신 아님). */
const CONV_TOKEN_TTL = '2h';
/** 대화 토큰 식별 클레임 — auth 액세스 토큰과 상호 오용 차단. */
const CONV_TOKEN_PURPOSE = 'recall-conv';

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
    private readonly jwt: JwtService,
  ) {}

  /** AI 데이터 동의 기록(멱등 — 다시 부르면 시각만 갱신). */
  async consent(userId: string): Promise<{ recallConsentAt: string }> {
    const at = new Date();
    await this.recall.setConsent(userId, at);
    return { recallConsentAt: at.toISOString() };
  }

  /** 이어하기 대화 토큰 발급 — 새 대화 차감 성공 후에만 호출. */
  private signConvToken(userId: string): string {
    return this.jwt.sign(
      { sub: userId, purpose: CONV_TOKEN_PURPOSE },
      { expiresIn: CONV_TOKEN_TTL },
    );
  }

  /** 유효한 이어하기 토큰이면 true. 없음·위조·만료·타유저 → false(=새 대화 취급). */
  private isValidConvToken(token: string | undefined, userId: string): boolean {
    if (!token) return false;
    try {
      const p = this.jwt.verify<{ sub?: string; purpose?: string }>(token);
      return p.purpose === CONV_TOKEN_PURPOSE && p.sub === userId;
    } catch {
      return false;
    }
  }

  /** 과거의 나와 1턴 대화. 새 대화(유효 토큰 없음)면 동의·잔액 검사 후 30잉크 차감·토큰 발급. */
  async chat(
    userId: string,
    dto: RecallChatDto,
  ): Promise<{ message: string; balance: number; conversationToken: string }> {
    const ctx = await this.recall.findUserContext(userId);
    if (!ctx) throw new NotFoundException('사용자를 찾을 수 없습니다.');

    // 열림 게이트 — 서버 권위로 매 턴 검사. 엔트리는 아래 프롬프트에서 재사용.
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

    // 새 대화 판단 = 서버 서명 토큰 유효성(클라 주장 불신). 없음·위조·만료·타유저 → 새 대화.
    const isNew = !this.isValidConvToken(dto.conversationToken, userId);

    // 새 대화만 동의·잔액 선검사(OpenAI 낭비 방지). 실제 차감은 성공 후.
    if (isNew) {
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
    // 사용량·비용 기록(비치명적). 매 턴 기록.
    await this.usage.recordLlm({
      userId,
      feature: 'recall',
      model: result.model,
      usage: result.usage,
    });

    // 새 대화만 차감 + 새 토큰 발급. 이어하기는 유효 토큰을 그대로 에코(재서명 X = 고정 TTL 유지).
    let balance: number;
    let conversationToken: string;
    if (isNew) {
      const spent = await this.currency.spend(userId, RECALL_COST);
      balance = spent.balance;
      conversationToken = this.signConvToken(userId);
    } else {
      balance = await this.currency.getBalance(userId);
      conversationToken = dto.conversationToken as string; // isValidConvToken이 존재 보장
    }

    // 말투 프로필 갱신 — 응답 막지 않게 백그라운드(void). 실패해도 비치명적.
    void this.maybeUpdateSpeechProfile(userId, dto.messages).catch((e) =>
      console.warn('[recall] 말투 프로필 갱신 실패(다음 대화에 재시도):', e),
    );

    return { message: result.content, balance, conversationToken };
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
