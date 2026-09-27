/**
 * KakaoLoginDto — 앱이 카카오에서 받은 인가 코드를 서버로 넘길 때의 몸통.
 *
 * codeVerifier(PKCE)는 앱에만 있던 비밀이다. 코드와 짝이 맞아야 카카오가 토큰을 준다.
 * redirectUri는 인가 요청 때 쓴 값을 그대로 다시 보낸다 — 카카오가 두 값을 대조한다.
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

export class KakaoLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  code: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  codeVerifier: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  redirectUri: string;
}
