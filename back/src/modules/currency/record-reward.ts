/**
 * recordRewardForDay — 연속 기록 day번째 날에 주는 잉크. 스케줄·금액의 단일 출처.
 * 바꾸려면 여기만 수정(트리거·멱등·UI 무관, 마이그레이션 무). 순수 함수.
 * v2(2026-11-15): 30일 이후 10일마다(40,50,60…) +20 / 그 외 0.
 * 예전의 "1~30일 매일 +3"은 뺐다 — 정의 1개당 +3(하루 5개, CurrencyService.grantEntryRewards)과 겹친다.
 */
export function recordRewardForDay(day: number): number {
  if (day > 30 && day % 10 === 0) return 20;
  return 0;
}
