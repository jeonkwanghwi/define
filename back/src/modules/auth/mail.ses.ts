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
  private readonly configurationSet: string;

  constructor(config: ConfigService) {
    super();
    this.from = config.get<string>('mail.from') as string;
    this.configurationSet = config.get<string>('mail.configurationSet') as string;
    this.client = new SESv2Client({ region: config.get<string>('mail.region') });
  }

  async sendCode(to: string, code: string, purpose: MailPurpose): Promise<void> {
    const { subject, text } = codeMailBody(code, purpose);
    await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.from,
        Destination: { ToAddresses: [to] },
        Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: text } } } },
        // 이걸 빼면 반송·스팸신고 이벤트가 SNS로 가지 않는다 — 알림을 만들어 두고도 못 받는다.
        // 바운스율이 5%를 넘으면 AWS가 발송 자체를 끊어서 가입과 비번 찾기가 통째로 멈춘다.
        ConfigurationSetName: this.configurationSet,
      }),
    );
  }
}
