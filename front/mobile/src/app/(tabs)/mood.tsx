/**
 * 회고 (Mood) — 좌2 탭 (PLANNING.md상 기능 미확정 — 후보: 오늘의 기분 / 검색 / 주간 회고).
 *
 * 기능 확정 시 본격 구현. 그때까지는 placeholder.
 */
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function MoodScreen() {
  return (
    <ScreenPlaceholder
      iconName="mood"
      title="회고"
      subtitle="이 탭의 기능은 아직 구상 중이에요"
      note="기획 확정 후 진행"
    />
  );
}
