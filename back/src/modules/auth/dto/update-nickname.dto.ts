/**
 * UpdateNicknameDto — 닉네임 설정/변경 입력. PATCH /auth/nickname 용.
 * 빈 문자열 허용(= 미설정으로 되돌리기, 익명 모델). trim·null 변환은 service 책임.
 */
import { IsString, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsString({ message: '닉네임이 올바르지 않습니다.' })
  @MaxLength(16, { message: '닉네임은 16자 이하로 입력하세요.' })
  nickname: string;
}
