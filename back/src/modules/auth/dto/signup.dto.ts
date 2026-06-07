/**
 * SignupDto — 회원가입 입력. 이메일+비밀번호만 받는다(익명 모델, 저마찰).
 * class-validator 데코레이터로 형식 검증 → 위반 시 ValidationPipe가 400 반환.
 */
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  password: string;
}
