/**
 * OpenAiClient — OpenAI Chat Completions 래퍼. 키는 서버 .env에서만(프론트 노출 X).
 * 키 없으면 503(우리 톤) — 회상은 비치명적, 재시도 가능.
 */
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import type { TokenUsage } from '../usage/llm-pricing';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type ChatResult = { content: string; model: string; usage: TokenUsage & { totalTokens: number } };

@Injectable()
export class OpenAiClient {
  private readonly client: OpenAI | null;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('openai.apiKey');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  /** 메시지 배열로 1회 완성. 키 미설정이면 503. */
  async chat(messages: ChatMessage[]): Promise<ChatResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        '지금 과거의 나를 부를 수 없어요. 잠시 후 다시 시도해 주세요.',
      );
    }
    const res = await this.client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.9,
    });
    const u = res.usage;
    return {
      content: res.choices[0]?.message?.content ?? '',
      model: res.model,
      usage: {
        promptTokens: u?.prompt_tokens ?? 0,
        cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? 0,
        completionTokens: u?.completion_tokens ?? 0,
        totalTokens: u?.total_tokens ?? 0,
      },
    };
  }
}
