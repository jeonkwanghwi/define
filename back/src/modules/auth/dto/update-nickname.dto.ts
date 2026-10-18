/**
 * UpdateNicknameDto — 닉네임 설정/변경 입력. PATCH /auth/nickname 용.
 * 빈 문자열 허용(= 미설정으로 되돌리기, 익명 모델). trim·null 변환은 service 책임.
 */
import { IsString, Matches, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsString({ message: '닉네임이 올바르지 않습니다.' })
  @MaxLength(16, { message: '닉네임은 16자 이하로 입력하세요.' })
  // 제어문자(Cc: NUL·줄바꿈 등)와 보이지 않는 서식 문자(Cf: 폭 0 공백·글자 방향 뒤집기 등) 금지.
  // 눈에 안 보이는 글자를 끼우면 "운영자"와 똑같아 보이는 다른 닉네임을 만들 수 있다. NUL은 DB 500도 낸다.
  @Matches(/^[^\p{Cc}\p{Cf}]*$/u, { message: '닉네임에 쓸 수 없는 문자가 있어요.' })
  nickname: string;
}
