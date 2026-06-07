/**
 * 회고 (Mood) — 좌2 탭 (PLANNING.md상 기능 미확정 — 후보: 오늘의 기분 / 검색 / 주간 회고).
 *
 * 가입 필요 탭 — 로그아웃 시 AuthGate가 가입 유도 화면을 보여준다.
 * 기능 확정 시 본격 구현. 그때까지 children은 placeholder.
 */
import { AuthGate } from '@/components/domain/auth-gate';
import { ScreenPlaceholder } from '@/components/domain/screen-placeholder';

export default function MoodScreen() {
  return (
    <AuthGate
      icon="mood"
      title="회고"
      description="회고 공간을 준비하고 있어요. 가입해두면 가장 먼저 만나요."
    >
      <ScreenPlaceholder
        iconName="mood"
        title="회고"
        subtitle="이 탭의 기능은 아직 구상 중이에요"
        note="기획 확정 후 진행"
      />
    </AuthGate>
  );
}
