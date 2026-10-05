/**
 * ResetPasswordDto — 비밀번호 재설정 입력. 코드 확인과 새 비밀번호를 **한 번에** 받는다.
 * 코드만 먼저 확인하는 단계를 두면 "확인은 끝났는데 비밀번호는 안 바뀐" 중간 상태가 생기고,
 * 그 상태를 들고 다니려면 또 다른 임시 토큰이 필요하다.
 *
 * 비밀번호 규칙은 SignupDto와 같게 유지한다 — 한쪽만 느슨하면 가입에서 막은 값이 이 문으로 들어온다.
 */
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @Length(6, 6, { message: '인증번호는 6자리입니다.' })
  @Matches(/^\d{6}$/, { message: '인증번호는 숫자 6자리입니다.' })
  code: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  @Matches(/^\S+$/, { message: '비밀번호에 공백은 사용할 수 없습니다.' })
  password: string;
}
