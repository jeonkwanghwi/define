import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { MailPurpose, MailService, codeMailBody } from './mail.service';

/**
 * SES v2 발송. 자격 증명은 SDK 기본 체인(ECS 태스크 역할 → 환경변수 → ~/.aws)에서 온다 —
 * 키를 코드·설정에 넣지 않는다.
 */
@Injectable()
export class SesMailService extends MailService {
  private readonly client: SESv2Client;
  private readonly from: string;

  constructor(config: ConfigService) {
    super();
    this.from = config.get<string>('mail.from') as string;
    this.client = new SESv2Client({ region: config.get<string>('mail.region') });
  }

  async sendCode(to: string, code: string, purpose: MailPurpose): Promise<void> {
    const { subject, text } = codeMailBody(code, purpose);
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [to] },
        Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
      }),
    );
  }
}
