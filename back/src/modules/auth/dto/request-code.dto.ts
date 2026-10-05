/**
 * RequestCodeDto — 인증번호 발송 요청. purpose가 가입과 비밀번호 재설정을 가른다.
 * 엔드포인트를 둘로 나누지 않은 이유: 코드 규칙(6자리·10분·시도 제한)이 두 흐름에서 똑같다.
 */
import { IsEmail, IsIn } from 'class-validator';

import { MailPurpose } from '../mail.service';

export class RequestCodeDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  // 'signup' | 'reset' 외의 값은 거른다 — purpose는 DB에 그대로 들어가는 분류 키다.
  @IsIn(['signup', 'reset'], { message: '요청 종류가 올바르지 않습니다.' })
  purpose: MailPurpose;
}
