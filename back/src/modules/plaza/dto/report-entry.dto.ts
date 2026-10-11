import { IsIn } from 'class-validator';

export class ReportEntryDto {
  /**
   * 신고 사유. 자유 입력이 아니라 고정 목록인 이유: 사유별로 세어 보려면 값이 고정이어야 하고,
   * 자유 입력은 그 자체가 또 하나의 사용자 생성 콘텐츠다(또 거를 거리가 생긴다).
   */
  @IsIn(['hate', 'sexual', 'violence', 'spam', 'other']) reason: string;
}
