/**
 * MailService — 메일 발송 계약. 구현이 둘이다:
 *   - MAIL_FROM이 비면 ConsoleMailService (개발: 코드를 서버 로그에 찍는다)
 *   - 있으면 SesMailService (AWS SES v2)
 * 발송만 추상화한다. 코드 생성·만료·시도 제한은 EmailCodeService의 몫 — SES가 해주는 게 아니다.
 */
export type MailPurpose = 'signup' | 'reset';

export abstract class MailService {
  abstract sendCode(to: string, code: string, purpose: MailPurpose): Promise<void>;

  /**
   * 운영자에게 보내는 메일(버그 제보 등). 받는 사람은 설정의 mail.supportTo.
   *
   * sendCode와 같은 자리에 두는 이유: 발송 수단이 하나뿐이다 —
   * SES 클라이언트·자격증명·configuration set을 둘 다 똑같이 쓴다.
   * 따로 서비스를 만들면 배선과 configuration set만 두 군데로 늘어난다.
   */
  abstract sendSupport(subject: string, text: string): Promise<void>;
}

/** 두 구현이 같은 문구를 쓰도록 본문을 한 곳에서 만든다. */
export function codeMailBody(code: string, purpose: MailPurpose): { subject: string; text: string } {
  const what = purpose === 'signup' ? '가입' : '비밀번호 재설정';
  return {
    subject: `define ${what} 인증번호 ${code}`,
    text: [
      `인증번호는 ${code} 입니다.`,
      '',
      `define ${what}을 계속하려면 앱에 이 번호를 입력해 주세요.`,
      '10분 뒤에 만료됩니다.',
      '',
      '본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.',
    ].join('\n'),
  };
}
