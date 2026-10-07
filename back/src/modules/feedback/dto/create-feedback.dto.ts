import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateFeedbackDto {
  /** 메일 제목에 그대로 들어간다. 100자를 넘으면 받은편지함에서 어차피 잘린다. */
  @IsString() @Length(1, 100) title: string;

  /** 제보 본문. 2000자면 장문의 설명도 담긴다. */
  @IsString() @Length(1, 2000) body: string;

  /**
   * 기기·버전 메타. 전부 optional인 이유: 앱이 못 알아낼 수 있다(웹·시뮬레이터에서는 비는 값이 있다).
   * 메타가 없다고 제보 자체를 막으면 본말전도다 — 없으면 "미확인"으로 적고 받는다.
   */
  @IsOptional() @IsString() @MaxLength(100) appVersion?: string;
  @IsOptional() @IsString() @MaxLength(100) platform?: string;
  @IsOptional() @IsString() @MaxLength(100) osVersion?: string;
  @IsOptional() @IsString() @MaxLength(100) deviceModel?: string;
}
