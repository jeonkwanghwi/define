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
import { ChatMessage, ChatResult, OpenAiClient } from './openai.client';
import { buildSystemPrompt } from './prompt';
import { RecallEntry, RecallRepository, RecallUserContext } from './recall.repository';

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
/** 대화 토큰 1개로 부를 수 있는 최대 횟수. DTO의 messages 상한(40 = 20왕복)과 맞춘 값. */
export const MAX_TURNS_PER_CONVERSATION = 20;
/** 한 사람이 하루(UTC)에 부를 수 있는 최대 횟수 — 토큰을 계속 새로 사도 OpenAI 비용이 끝없이 늘지 않게. */
export const MAX_CALLS_PER_DAY = 200;

/** 필터를 사람이 읽는 "시절" 라벨로. 나이 우선, 없으면 연도. 둘 다 없으면 전체(undefined). */
function describePeriod(filter: RecallChatDto['filter']): string | undefined {
  if (filter.age != null) return `${filter.age}살 무렵`;
  if (filter.periodStart) return `${filter.periodStart.slice(0, 4)}년 무렵`;
  return undefined;
}

@Injectable()
export class RecallService {
  /**
   * 대화 토큰별 사용 횟수 / 사용자별 오늘 호출 수. 메모리에 둔다.
   * ponytail: 컨테이너가 1대라 맞다. 2대 이상이면 대수만큼 한도가 늘어난다 → 그때 Redis/DB로.
   *   재배포하면 초기화되지만 그래 봐야 한도를 한 번 더 쓸 뿐이다.
   */
  private readonly turnsByToken = new Map<string, { count: number; expiresAt: number }>();
  private readonly callsToday = new Map<string, { day: string; count: number }>();

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
    if (isNew && !ctx.recallConsentAt) {
      throw new HttpException(
        { message: '회상을 시작하려면 동의가 필요해요.', code: 'RECALL_CONSENT_REQUIRED' },
        HttpStatus.FORBIDDEN,
      );
    }
    // 이어하기 턴 상한 — 토큰 하나로 무한정 무료 대화를 못 하게. (새 대화는 아래에서 1로 시작)
    if (!isNew && !this.takeTurn(dto.conversationToken as string)) {
      throw this.tooMany('이 대화는 여기까지예요. 새 대화를 시작해 주세요.');
    }
    if (!this.takeDailyCall(userId)) {
      throw this.tooMany('오늘은 과거의 나와 충분히 이야기했어요. 내일 다시 만나요.');
    }

    // 프롬프트를 차감 전에 만든다 — 나이 필터 400 같은 입력 오류로 잉크가 나갔다 들어오는 일이 없게.
    const messages = this.buildMessages(dto, allEntries, ctx);

    // 새 대화는 **OpenAI를 부르기 전에** 원자적으로 차감한다. 예전엔 "잔액 확인 → 호출 → 차감"이라
    // 동시에 10번 보내면 10번 다 확인을 통과하고, 차감 실패(ok:false)를 무시한 채 토큰까지 내줬다.
    // 차감에 성공한 요청만 지나간다 — 잔액 30이면 동시 요청 중 정확히 하나.
    let balance = 0;
    if (isNew) {
      const spent = await this.currency.spend(userId, RECALL_COST);
      if (!spent.ok) {
        throw new HttpException(
          { message: `잉크가 ${RECALL_COST}개 필요해요. 출석으로 모아보세요.`, code: 'INSUFFICIENT_INK' },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
      balance = spent.balance;
    }

    let result: ChatResult;
    try {
      result = await this.openai.chat(messages, { maxTokens: 500 });
    } catch (e) {
      // 돈은 받았는데 답을 못 줬다 → 되돌려준다. 이 경우 토큰도 발급하지 않는다.
      if (isNew) await this.currency.refund(userId, RECALL_COST);
      throw e;
    }
    // 사용량·비용 기록(비치명적). 매 턴 기록.
    await this.usage.recordLlm({
      userId,
      feature: 'recall',
      model: result.model,
      usage: result.usage,
    });

    // 새 대화만 새 토큰 발급(이번 호출이 1턴째). 이어하기는 유효 토큰을 그대로 에코(재서명 X = 고정 TTL 유지).
    let conversationToken: string;
    if (isNew) {
      conversationToken = this.signConvToken(userId);
      this.takeTurn(conversationToken);
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

  /** 시스템 프롬프트(필터된 내 기록) + 앱이 보낸 대화 이력. */
  private buildMessages(
    dto: RecallChatDto,
    allEntries: RecallEntry[],
    ctx: RecallUserContext,
  ): ChatMessage[] {
    const entries = this.applyFilter(allEntries, dto.filter, ctx.birthYear);
    const system = buildSystemPrompt({
      entries: entries.slice(0, MAX_ENTRIES),
      mode: dto.mode ?? 'free',
      focusWord: dto.focusWord,
      period: describePeriod(dto.filter),
      speechProfile: ctx.speechProfile,
    });
    return [
      { role: 'system', content: system },
      ...dto.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  /** 토큰 하나의 턴을 1 쓴다. 상한에 닿았으면 false. 만료된 토큰 기록은 그때그때 치운다. */
  private takeTurn(token: string): boolean {
    const now = Date.now();
    for (const [k, v] of this.turnsByToken) if (v.expiresAt <= now) this.turnsByToken.delete(k);
    // 만료 시각은 토큰 TTL(2h)과 같게 — 토큰이 죽으면 기록도 필요 없다.
    const cur = this.turnsByToken.get(token) ?? { count: 0, expiresAt: now + 2 * 60 * 60 * 1000 };
    if (cur.count >= MAX_TURNS_PER_CONVERSATION) return false;
    cur.count += 1;
    this.turnsByToken.set(token, cur);
    return true;
  }

  /** 오늘(UTC) 호출 1회를 쓴다. 상한에 닿았으면 false. */
  private takeDailyCall(userId: string): boolean {
    const day = new Date().toISOString().slice(0, 10);
    const cur = this.callsToday.get(userId);
    const count = cur?.day === day ? cur.count : 0;
    if (count >= MAX_CALLS_PER_DAY) return false;
    this.callsToday.set(userId, { day, count: count + 1 });
    return true;
  }

  private tooMany(message: string): HttpException {
    return new HttpException({ message, code: 'RECALL_LIMIT' }, HttpStatus.TOO_MANY_REQUESTS);
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
