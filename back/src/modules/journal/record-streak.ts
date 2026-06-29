/**
 * computeRecordStreak — 연속 기록일. savedAt들의 calendar day(UTC date)로
 * "가장 최근 기록일에서 끝나는 연속 런" 길이. 순수 함수. today 불필요(방금 기록 = 최신일이 앵커).
 * 중복 날짜는 1일로. 빈 배열 → 0.
 */
export function computeRecordStreak(savedAt: Date[]): number {
  if (savedAt.length === 0) return 0;
  const ords = new Set<number>();
  for (const d of savedAt) {
    const key = d.toISOString().slice(0, 10); // 'YYYY-MM-DD' (저장 시각의 날짜)
    ords.add(Date.parse(key + 'T00:00:00Z') / 86400000); // 일 단위 정수
  }
  const maxOrd = Math.max(...ords);
  let streak = 0;
  while (ords.has(maxOrd - streak)) streak++;
  return streak;
}
