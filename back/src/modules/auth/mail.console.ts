/**
 * ConsoleMailService — 개발용. 메일을 보내지 않고 인증번호를 서버 로그에 찍는다.
 *
 * 왜 필요한가: SES는 발신 주소 검증·샌드박스 해제가 끝나야 쓸 수 있다. 그 전까지
 * 가입·재설정 흐름을 손으로 돌려보려면 코드를 어디선가는 읽을 수 있어야 한다.
 *
 * **운영에 들어가면 안 되는 구현이다** — 로그를 보는 사람이 남의 가입을 가로챌 수 있다.
 * 그래서 AuthModule이 MAIL_FROM이 비어 있을 때만 이쪽을 바인딩한다.
 */
import { Injectable, Logger } from '@nestjs/common';

import { MailPurpose, MailService } from './mail.service';

@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger(ConsoleMailService.name);

  async sendCode(to: string, code: string, purpose: MailPurpose): Promise<void> {
    // 한 줄로 찍는다 — 개발 중 `npm run start:dev` 로그에서 grep으로 찾기 쉽게.
    this.logger.log(`[MAIL] to=${to} purpose=${purpose} code=${code}`);
  }
}
