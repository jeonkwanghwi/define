/**
 * FeedbackService — 버그 제보를 메일 한 통으로 만들어 운영자에게 보낸다.
 *
 * 발송 수단은 새로 만들지 않는다 — AuthModule이 이미 MAIL_FROM 유무로 SES/콘솔을 갈라
 * 바인딩해 두었고(DKIM·반송 알림까지 붙어 있다), 여기서는 그 MailService를 주입받아 쓴다.
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../auth/mail.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

/** 같은 사람이 연달아 보내지 못하게. 메일 폭주와 오발송을 막는 최소 장치다. */
const COOLDOWN_MS = 30_000;

@Injectable()
export class FeedbackService {
  /**
   * 쿨다운 기록을 프로세스 메모리에 둔다. 지금 컨테이너가 한 대라 이걸로 충분하고,
   * 재시작하면 초기화되지만 그래 봐야 한 번 더 보낼 수 있을 뿐이다 — 테이블을 만들 일이 아니다.
   * **컨테이너가 두 대 이상으로 늘면 이 Map은 무력해진다**(인스턴스마다 따로 센다).
   * 그때는 Redis나 DB로 옮겨야 한다.
   */
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * 제보 한 건을 발송한다. 쿨다운 위반은 429.
   * 발송 실패는 삼키지 않는다 — 500으로 올려야 사용자가 "보냈는데 안 왔다"를 겪지 않는다.
   */
  async submit(userId: string, dto: CreateFeedbackDto): Promise<void> {
    const last = this.lastSentAt.get(userId);
    if (last !== undefined && Date.now() - last < COOLDOWN_MS) {
      // @nestjs/common에 429 전용 예외 클래스가 없어 HttpException으로 직접 만든다.
      throw new HttpException('잠시 후에 다시 보내주세요.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true, email: true },
    });

    const text = [
      dto.body,
      '',
      '────────────────',
      // 답장할 주소가 아니라 "누가 어떤 환경에서 겪었는지"가 핵심이다 — 재현에 필요한 값만 적는다.
      `보낸 사람: ${user?.nickname ?? '(닉네임 없음)'} / ${user?.email ?? '(이메일 없음, 소셜 로그인)'}`,
      `userId: ${userId}`,
      `앱 버전: ${dto.appVersion ?? '미확인'}`,
      `플랫폼: ${dto.platform ?? '미확인'}`,
      `OS: ${dto.osVersion ?? '미확인'}`,
      `기기: ${dto.deviceModel ?? '미확인'}`,
      `받은 시각(KST): ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
    ].join('\n');

    await this.mail.sendSupport(`[define 제보] ${dto.title}`, text);

    // 발송이 성공한 뒤에 기록한다 — 실패한 시도로 쿨다운을 먹이면 다시 보낼 수가 없다.
    this.lastSentAt.set(userId, Date.now());
  }
}
