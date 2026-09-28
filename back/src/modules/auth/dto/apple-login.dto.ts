/**
 * AppleLoginDto — 앱이 Apple 네이티브 시트에서 받은 identityToken을 그대로 넘긴다.
 * (카카오와 달리 인가 코드·PKCE가 없다 — Apple이 서명된 JWT를 바로 주기 때문.)
 */
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AppleLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  identityToken: string;
}
