import { Matches } from 'class-validator';

/** 출석 적립 요청 — 클라 로컬 날짜로 '오늘'을 판정한다. */
export class AttendanceDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'localDate는 YYYY-MM-DD 형식이어야 합니다.' })
  localDate: string;
}
