/**
 * EmailCodeService — 6자리 코드의 발급과 확인.
 *
 * 왜 서비스가 따로인가: 가입과 비밀번호 재설정이 **완전히 같은 규칙**을 쓴다
 * (6자리·10분·5회·60초 쿨다운·24시간 10회). 두 흐름에 각자 구현하면 한쪽만 고치는 사고가 난다.
 *
 * 코드는 평문으로 저장하지 않는다 — bcrypt 해시로 넣고 비교만 한다.
 */
import { randomInt } from 'node:crypto';

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { EmailCodeRepository } from './email-code.repository';
import { MailPurpose, MailService } from './mail.service';

/** 코드 유효 시간. 짧으면 메일이 늦게 오는 사람이 막히고, 길면 탈취될 창이 넓어진다. */
export const CODE_TTL_MS = 10 * 60 * 1000;
/** 한 코드에 허용하는 확인 시도. 넘으면 그 코드를 폐기한다(무차별 대입 차단). */
export const MAX_ATTEMPTS = 5;
/** 재발송 쿨다운. 버튼 연타로 같은 주소에 메일을 퍼붓지 못하게. */
export const RESEND_COOLDOWN_MS = 60 * 1000;
/** 같은 (이메일, 목적)의 24시간 발급 상한 — 남의 주소로 메일 폭탄을 보내는 걸 막는다. */
export const DAILY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailCodeService {
  constructor(
    private readonly codes: EmailCodeRepository,
    private readonly mail: MailService,
  ) {}

  /**
   * 새 코드를 발급해 메일로 보낸다. 쿨다운·상한 위반은 429.
   * 발송 실패는 삼키지 않는다 — 500으로 올려야 사용자가 "코드가 안 와요"를 겪기 전에 알 수 있다.
   */
  async issue(email: string, purpose: MailPurpose): Promise<void> {
    const lastIssued = await this.codes.lastIssuedAt(email, purpose);
    if (lastIssued && Date.now() - lastIssued.getTime() < RESEND_COOLDOWN_MS) {
      throw this.throttled();
    }
    const issuedToday = await this.codes.countSince(email, purpose, new Date(Date.now() - DAY_MS));
    if (issuedToday >= DAILY_LIMIT) {
      throw this.throttled();
    }

    // 새 코드를 내면 옛 코드는 죽어야 한다. 둘 다 살아 있으면 "다시 받기"를 누른 사용자가
    // 이전 메일의 번호로도 통과하게 되고, 유효 코드가 늘어난 만큼 추측도 쉬워진다.
    await this.codes.consumeAll(email, purpose);

    // Math.random()은 예측 가능하다 = 코드를 맞히면 남의 계정을 가져간다. 암호학적 난수를 쓴다.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.codes.create({
      email,
      purpose,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });

    await this.mail.sendCode(email, code, purpose);
  }

  /**
   * 코드 확인. 맞으면 그 코드를 소비하고 true, 그 외에는 전부 false.
   * 실패 사유(코드 없음 / 만료 / 시도 초과 / 불일치)를 구분해 돌려주지 않는다 —
   * 공격자에게 "이 주소로 코드가 나갔다"를 알려주는 정보다.
   */
  async verify(email: string, purpose: MailPurpose, code: string): Promise<boolean> {
    const row = await this.codes.findLatestUnconsumed(email, purpose);
    if (!row) return false;

    // 만료·시도초과면 그 자리에서 폐기한다. 살려두면 뒤이은 확인 요청이 계속 이 죽은 코드를
    // 집어, 사용자가 코드를 다시 받기 전까지 무조건 실패한다.
    if (row.expiresAt.getTime() <= Date.now() || row.attempts >= MAX_ATTEMPTS) {
      await this.codes.consume(row.id);
      return false;
    }

    // 비교 전에 시도를 먼저 센다 — 틀렸을 때 기록을 빼먹으면 횟수 제한이 무력해진다.
    await this.codes.incrementAttempts(row.id);
    if (!(await bcrypt.compare(code, row.codeHash))) return false;

    await this.codes.consume(row.id);
    return true;
  }

  /** @nestjs/common에 429 전용 예외 클래스가 없어 HttpException으로 직접 만든다. */
  private throttled(): HttpException {
    return new HttpException('잠시 후에 다시 시도해 주세요.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
