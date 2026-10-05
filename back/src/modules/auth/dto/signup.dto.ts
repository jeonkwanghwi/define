/**
 * SignupDto — 회원가입 입력. 이메일+비밀번호+이메일로 받은 인증번호를 받는다(익명 모델, 저마찰).
 * class-validator 데코레이터로 형식 검증 → 위반 시 ValidationPipe가 400 반환.
 */
import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  // 공백 포함 비밀번호 거부 — 키보드 자동완성이 붙인 보이지 않는 공백으로
  // "가입 성공 후 로그인 실패" 나는 사고 방지. (^\S+$ = 처음부터 끝까지 공백 아닌 문자만)
  @Matches(/^\S+$/, { message: '비밀번호에 공백은 사용할 수 없습니다.' })
  password: string;

  // 가입 전에 POST /auth/email/code로 받은 6자리. 이게 맞아야 계정이 만들어진다 —
  // 그래서 "미인증 계정"이라는 상태가 아예 없다(emailVerified 컬럼이 필요 없는 이유).
  //
  // @IsOptional()인 이유: 이미 배포된 구버전 앱(1.0.0(2))은 code 없이 {email, password}만 보낸다.
  // 여기서 400으로 끊으면 그 사용자는 class-validator의 영어 메시지나 뭉뚱그린 400만 보고
  // 왜 가입이 안 되는지 알 수 없다. 그래서 형식 검증은 비켜 주고, AuthService.signup이
  // "코드 없음"을 426 + 업데이트 안내 한국어 메시지로 끊는다. 인증을 우회시키는 게 아니다 —
  // 코드가 없으면 계정은 만들어지지 않는다.
  // 구버전 앱이 전부 업데이트되면 이 @IsOptional()과 signup의 426 분기를 같이 떼면 된다.
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: '인증번호는 6자리입니다.' })
  @Matches(/^\d{6}$/, { message: '인증번호는 숫자 6자리입니다.' })
  code?: string;
}
