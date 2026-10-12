/**
 * AppleLoginDto — 앱이 Apple 네이티브 시트에서 받은 값을 넘긴다.
 *
 * identityToken 하나로 **로그인은 끝난다**(Apple이 서명한 JWT라 서버가 검증만 하면 된다).
 * authorizationCode는 로그인이 아니라 **탈퇴를 위해** 받는다 — 연결 해제에는 토큰이 필요하고,
 * 그 토큰은 이 코드를 교환해야만 나오며 코드는 몇 분 만에 죽는다.
 */
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  @IsString({ message: 'Apple 로그인 정보가 올바르지 않아요.' })
  @MinLength(1, { message: 'Apple 로그인 정보가 올바르지 않아요.' })
  @MaxLength(4096, { message: 'Apple 로그인 정보가 올바르지 않아요.' })
  identityToken: string;

  /** 구버전 앱은 보내지 않는다 — 없으면 연결 해제만 못 하고 로그인은 그대로 된다. */
  @IsOptional()
  @IsString({ message: 'Apple 로그인 정보가 올바르지 않아요.' })
  @MaxLength(4096, { message: 'Apple 로그인 정보가 올바르지 않아요.' })
  authorizationCode?: string;
}
