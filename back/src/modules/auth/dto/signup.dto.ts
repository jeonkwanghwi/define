/**
 * SignupDto — 회원가입 입력. 이메일+비밀번호만 받는다(익명 모델, 저마찰).
 * class-validator 데코레이터로 형식 검증 → 위반 시 ValidationPipe가 400 반환.
 */
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 8자 이상이어야 합니다.' })
  // 공백 포함 비밀번호 거부 — 키보드 자동완성이 붙인 보이지 않는 공백으로
  // "가입 성공 후 로그인 실패" 나는 사고 방지. (^\S+$ = 처음부터 끝까지 공백 아닌 문자만)
  @Matches(/^\S+$/, { message: '비밀번호에 공백은 사용할 수 없습니다.' })
  password: string;
}
