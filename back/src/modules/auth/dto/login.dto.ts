/**
 * LoginDto — 로그인 입력. 길이 규칙은 가입에서만(기존 계정 막지 않게 여기선 비어있지만 않으면 됨).
 */
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: '비밀번호를 입력하세요.' })
  password: string;
}
